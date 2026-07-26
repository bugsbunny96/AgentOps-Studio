/**
 * Knowledge Base Service
 *
 * All operations are scoped to the authenticated owner's organization.
 * Org lookup follows the same pattern as agent.service.ts:
 *   MembershipModel.findOne({ userId, role: 'Owner' }).populate('organizationId')
 *
 * Functions:
 *   listDocs(userId)                          → paginated KB document list
 *   createDoc(userId, dto)                    → create + enqueue ingest job
 *   deleteDoc(userId, docId)                  → soft delete (hard delete in DB)
 *   getKbStatus(userId)                       → doc count + crawl status
 *   getKbContext(orgId)                       → formatted text for system prompt injection
 *   triggerResync(userId)                     → queue website re-crawl
 *   syncKbToVapi(orgId)                       → rebuild system prompt + PATCH Vapi assistant
 *   importFaqsToKb(orgId)                     → upsert org FAQs as faq_import documents (called after crawl)
 */

import mongoose from 'mongoose';
import { MembershipModel, OrganizationModel, type IOrganization } from '../organization/organization.model';
import { KbDocumentModel, KbCategoryModel, type IKbDocument, type IKbCategory, type KbSourceType, type KbDocStatus } from './kb.model';
import { VoiceAgentModel }                     from '../agents/agent.model';
import { kbQueue }                             from '../../jobs/kb.queue';
import { crawlQueue }                          from '../../jobs/crawl.queue';
// Import from prompt.utils — NOT from agent.service — to avoid a circular dependency:
//   agent.service → kb.service (getKbContext)
//   kb.service    → agent.service (generateSystemPrompt)  ← cycle broken by moving to prompt.utils
import { generateSystemPrompt }                from '../agents/prompt.utils';
import { vapiUpdateAssistant }                 from '../agents/vapi.service';
import { NotFound, BadRequest, Forbidden }      from '../../middleware/errorHandler';
import { PLAN_LIMITS }                         from '../billing/billing.service';
import type { Plan }                           from '../organization/organization.model';
import { logger }                              from '../../utils/logger';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function resolveOwnerOrg(userId: string): Promise<{
  org: IOrganization;
  orgId: mongoose.Types.ObjectId;
}> {
  const membership = await MembershipModel
    .findOne({ userId, role: 'Owner' })
    .populate<{ organizationId: IOrganization }>('organizationId');
  if (!membership) throw NotFound('Organization');
  const org = membership.organizationId as IOrganization;
  return { org, orgId: org._id };
}

// ─── getKbContext ─────────────────────────────────────────────────────────────

/**
 * Returns a formatted Knowledge Base string suitable for injection into a Vapi system prompt.
 *
 * Strategy (MVP — text-based, no vector search):
 *   • Pull up to MAX_DOCS ready documents, ordered newest first
 *   • Truncate each document's content to MAX_CHARS_PER_DOC characters
 *   • Total output capped at MAX_TOTAL_CHARS to keep prompts within token budget
 *
 * Returns empty string if no ready documents exist (caller must handle).
 */
const MAX_DOCS          = 20;
const MAX_CHARS_PER_DOC = 1_200;   // matches compressPageText() output cap — no further truncation needed
const MAX_TOTAL_CHARS   = 10_000;  // ~2,500 tokens — generous enough for 8-10 compressed pages

export async function getKbContext(orgId: mongoose.Types.ObjectId | string): Promise<string> {
  const docs = await KbDocumentModel.find(
    { organizationId: orgId, status: 'ready' },
    { title: 1, content: 1, sourceType: 1 },
  )
    .sort({ updatedAt: -1 })
    .limit(MAX_DOCS)
    .lean();

  if (!docs.length) return '';

  const sections: string[] = [];
  let totalChars = 0;

  for (const doc of docs) {
    const snippet = doc.content.slice(0, MAX_CHARS_PER_DOC).trim();
    const entry   = `### ${doc.title}\n${snippet}`;

    if (totalChars + entry.length > MAX_TOTAL_CHARS) break;
    sections.push(entry);
    totalChars += entry.length + 2; // +2 for newlines between entries
  }

  if (!sections.length) return '';

  return `## Knowledge Base\n\n${sections.join('\n\n')}`;
}

// ─── listDocs ─────────────────────────────────────────────────────────────────

export interface KbDocListItem {
  id:             string;
  organizationId: string;
  title:          string;
  sourceType:     KbSourceType;
  sourceUrl?:     string;
  status:         KbDocStatus;
  tokenEstimate:  number;
  errorMessage?:  string;
  createdAt:      Date;
  updatedAt:      Date;
}

export interface ListDocsResult {
  docs:       KbDocListItem[];
  total:      number;
  readyCount: number;
}

export async function listDocs(userId: string): Promise<ListDocsResult> {
  const { orgId } = await resolveOwnerOrg(userId);

  const raw = await KbDocumentModel
    .find({ organizationId: orgId })
    .sort({ updatedAt: -1 })
    .select('-content')        // exclude large content field from list view
    .lean<Pick<IKbDocument, '_id' | 'organizationId' | 'title' | 'sourceType' | 'sourceUrl' | 'status' | 'tokenEstimate' | 'errorMessage' | 'createdAt' | 'updatedAt'>[]>();

  const docs: KbDocListItem[] = raw.map((d) => ({
    id:             d._id.toString(),
    organizationId: d.organizationId.toString(),
    title:          d.title,
    sourceType:     d.sourceType,
    sourceUrl:      d.sourceUrl,
    status:         d.status,
    tokenEstimate:  d.tokenEstimate,
    errorMessage:   d.errorMessage,
    createdAt:      d.createdAt,
    updatedAt:      d.updatedAt,
  }));

  return { docs, total: docs.length, readyCount: docs.filter((d) => d.status === 'ready').length };
}

// ─── createDoc ────────────────────────────────────────────────────────────────

export interface CreateKbDocDto {
  title:      string;
  content:    string;
  sourceType: 'manual_text';   // only manual_text via API; website_page is created by crawler
}

export async function createDoc(userId: string, dto: CreateKbDocDto): Promise<IKbDocument> {
  const { org, orgId } = await resolveOwnerOrg(userId);

  if (!dto.title?.trim())    throw BadRequest('Title is required');
  if (!dto.content?.trim())  throw BadRequest('Content is required');
  if (dto.content.length > 50_000) throw BadRequest('Content exceeds 50,000 character limit');

  // ── Plan limit check ──────────────────────────────────────────────
  const plan: Plan  = (org as unknown as { plan?: Plan }).plan ?? 'free';
  const kbDocLimit  = PLAN_LIMITS[plan].kbDocs;
  if (kbDocLimit !== Infinity) {
    const currentCount = await KbDocumentModel.countDocuments({ organizationId: orgId });
    if (currentCount >= kbDocLimit) {
      throw Forbidden(
        `Your ${plan} plan allows up to ${kbDocLimit} Knowledge Base document${kbDocLimit === 1 ? '' : 's'}. ` +
        'Upgrade your plan to add more.',
        'KB_PLAN_LIMIT_REACHED',
      );
    }
  }

  const doc = await KbDocumentModel.create({
    organizationId: orgId,
    title:          dto.title.trim(),
    content:        dto.content.trim(),
    sourceType:     'manual_text',
    status:         'pending',
    tokenEstimate:  0,
  });

  // Enqueue for ingestion (worker sets status=ready + computes tokenEstimate)
  await kbQueue.add('ingest', { docId: doc._id.toString(), orgId: orgId.toString() });

  logger.info('KB doc created', { docId: doc._id.toString(), orgId: orgId.toString() });
  return doc;
}

// ─── deleteDoc ────────────────────────────────────────────────────────────────

export async function deleteDoc(userId: string, docId: string): Promise<void> {
  const { orgId } = await resolveOwnerOrg(userId);

  const doc = await KbDocumentModel.findOne({
    _id:            docId,
    organizationId: orgId,
  });
  if (!doc) throw NotFound('Knowledge Base document');

  await KbDocumentModel.deleteOne({ _id: docId });
  logger.info('KB doc deleted', { docId, orgId: orgId.toString() });

  // DRIFT-2 fix: rebuild Vapi prompt without the deleted document.
  // Fire-and-forget — non-fatal if Vapi sync fails; KB is already deleted in DB.
  syncKbToVapi(orgId.toString()).catch((err) => {
    logger.error('syncKbToVapi after delete failed', {
      orgId: orgId.toString(),
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

// ─── getDoc ───────────────────────────────────────────────────────────────────

/** Returns a single document with full content — used for preview / edit modal. */
export async function getDoc(userId: string, docId: string): Promise<IKbDocument> {
  const { orgId } = await resolveOwnerOrg(userId);

  const doc = await KbDocumentModel.findOne({ _id: docId, organizationId: orgId });
  if (!doc) throw NotFound('Knowledge Base document');
  return doc;
}

// ─── updateDoc ────────────────────────────────────────────────────────────────

export interface UpdateKbDocDto {
  title?:   string;
  content?: string;
}

/** Update title/content for a manual_text document. Re-queues ingest on content change. */
export async function updateDoc(
  userId: string,
  docId:  string,
  dto:    UpdateKbDocDto,
): Promise<IKbDocument> {
  const { orgId } = await resolveOwnerOrg(userId);

  const doc = await KbDocumentModel.findOne({ _id: docId, organizationId: orgId });
  if (!doc) throw NotFound('Knowledge Base document');

  if (doc.sourceType !== 'manual_text') {
    throw BadRequest('Only manual text documents can be edited');
  }

  const updates: Partial<Pick<IKbDocument, 'title' | 'content' | 'status' | 'tokenEstimate'>> = {};

  if (dto.title !== undefined) {
    if (!dto.title.trim()) throw BadRequest('Title cannot be empty');
    updates.title = dto.title.trim().slice(0, 300);
  }
  if (dto.content !== undefined) {
    if (!dto.content.trim()) throw BadRequest('Content cannot be empty');
    if (dto.content.length > 50_000) throw BadRequest('Content exceeds 50,000 character limit');
    updates.content      = dto.content.trim();
    updates.status       = 'pending';   // re-process to update tokenEstimate
    updates.tokenEstimate = 0;
  }

  if (Object.keys(updates).length === 0) return doc;

  const updated = await KbDocumentModel.findByIdAndUpdate(
    docId,
    { $set: updates },
    { new: true },
  );
  if (!updated) throw NotFound('Knowledge Base document');

  if (dto.content !== undefined) {
    await kbQueue.add('ingest', { docId, orgId: orgId.toString() });
  }

  logger.info('KB doc updated', { docId, orgId: orgId.toString() });
  return updated;
}

// ─── getKbStatus ──────────────────────────────────────────────────────────────

export async function getKbStatus(userId: string) {
  const { org, orgId } = await resolveOwnerOrg(userId);

  const [total, readyCount, pendingCount] = await Promise.all([
    KbDocumentModel.countDocuments({ organizationId: orgId }),
    KbDocumentModel.countDocuments({ organizationId: orgId, status: 'ready' }),
    KbDocumentModel.countDocuments({ organizationId: orgId, status: 'pending' }),
  ]);

  return {
    total,
    readyCount,
    pendingCount,
    crawlStatus:   org.crawlStatus,
    crawlEnabled:  org.crawlEnabled,
    websiteUrl:    org.websiteUrl ?? null,
    lastCrawledAt: org.lastCrawledAt ?? null,
  };
}

// ─── triggerResync ────────────────────────────────────────────────────────────

export async function triggerResync(userId: string): Promise<{ jobId: string }> {
  const { org, orgId } = await resolveOwnerOrg(userId);

  if (!org.websiteUrl) throw BadRequest('No website URL configured for this organization');
  if (!org.crawlEnabled) throw BadRequest('Website crawl is not enabled for this organization');

  if (org.crawlStatus === 'processing') {
    throw BadRequest('A crawl is already in progress. Wait for it to complete before re-syncing.');
  }

  // Mark org as pending immediately so the UI reflects it
  await OrganizationModel.findByIdAndUpdate(orgId, {
    $set: { crawlStatus: 'pending' },
  });

  // The crawl worker (crawl.worker.ts) calls crawlWebsite(), which writes KB docs.
  const job = await crawlQueue.add('crawl', {
    orgId:      orgId.toString(),
    websiteUrl: org.websiteUrl,
  });

  logger.info('KB re-sync triggered', { orgId: orgId.toString(), jobId: job.id });
  return { jobId: job.id ?? 'queued' };
}

// ─── syncKbToVapi ─────────────────────────────────────────────────────────────

/**
 * Rebuilds the system prompt with current KB content and pushes it to Vapi.
 * Called after KB changes (new doc created, doc deleted, re-sync complete).
 *
 * Safe to call even if vapiAssistantId is not set — it no-ops with a warning.
 */
export async function syncKbToVapi(orgId: string): Promise<void> {
  const org = await OrganizationModel.findById(orgId);
  if (!org) {
    logger.warn('syncKbToVapi: org not found', { orgId });
    return;
  }
  if (!org.vapiAssistantId) {
    logger.warn('syncKbToVapi: no vapiAssistantId — skipping Vapi sync', { orgId });
    return;
  }

  try {
    const kbContext    = await getKbContext(org._id);
    const systemPrompt = generateSystemPrompt(org, kbContext);

    await vapiUpdateAssistant(org.vapiAssistantId, {
      model: {
        provider: 'openai',
        model:    'gpt-4o',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.65,
        maxTokens:   300,
      },
    });

    // DRIFT-3 fix: write the new prompt back to the VoiceAgent record so the DB
    // stays in sync with what Vapi actually has. Without this, VoiceAgent.systemPrompt
    // is permanently the provision-time snapshot (which had no KB context).
    await VoiceAgentModel.findOneAndUpdate(
      { organizationId: org._id },
      { $set: { systemPrompt } },
    );

    logger.info('Vapi assistant system prompt updated with KB', {
      orgId,
      vapiAssistantId: org.vapiAssistantId,
      kbChars: kbContext.length,
    });
  } catch (err) {
    // Non-fatal: KB is still stored; just log and continue
    logger.error('syncKbToVapi failed — KB stored but Vapi not updated', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── listCategories ───────────────────────────────────────────────────────────

export interface KbCategoryListItem {
  id:            string;
  slug:          string;
  name:          string;
  tier:          number;
  type:          'system' | 'auto-created';
  documentCount: number;
}

/**
 * Returns all KB categories for this org, sorted by tier (P1 first).
 * Includes document counts (pre-computed on KbCategoryModel.documentCount).
 */
export async function listCategories(userId: string): Promise<KbCategoryListItem[]> {
  const { orgId } = await resolveOwnerOrg(userId);

  const cats = await KbCategoryModel
    .find({ organizationId: orgId })
    .sort({ tier: 1, name: 1 })
    .lean<Pick<IKbCategory, '_id' | 'slug' | 'name' | 'tier' | 'type' | 'documentCount'>[]>();

  return cats.map((c) => ({
    id:            c._id.toString(),
    slug:          c.slug,
    name:          c.name,
    tier:          c.tier,
    type:          c.type,
    documentCount: c.documentCount,
  }));
}

// ─── importFaqsToKb ──────────────────────────────────────────────────────────

/**
 * Upserts the org's onboarding FAQs into the KB as 'faq_import' documents.
 * Called by the crawl worker after a successful crawl or by the onboarding complete hook.
 *
 * Each FAQ becomes one KbDocument with title = Q and content = A.
 * Existing faq_import docs for the org are replaced (deleteMany + createMany).
 */
export async function importFaqsToKb(orgId: string): Promise<void> {
  const org = await OrganizationModel.findById(orgId);
  if (!org || !org.faqs?.length) return;

  // Remove stale faq_import docs
  await KbDocumentModel.deleteMany({ organizationId: orgId, sourceType: 'faq_import' });

  const docs = org.faqs
    .filter((f) => f.question?.trim() && f.answer?.trim())
    .map((f) => ({
      organizationId: new mongoose.Types.ObjectId(orgId),
      title:          f.question.trim().slice(0, 300),
      content:        `Q: ${f.question.trim()}\nA: ${f.answer.trim()}`,
      sourceType:     'faq_import' as const,
      status:         'ready' as const,
      tokenEstimate:  Math.ceil((f.question.length + f.answer.length) / 4),
    }));

  if (docs.length === 0) return;

  await KbDocumentModel.insertMany(docs);
  logger.info('FAQs imported to KB', { orgId, count: docs.length });
}
