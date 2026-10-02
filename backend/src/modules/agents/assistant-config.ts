/**
 * Assistant config — builds the system prompt + Vapi `model` block for an org.
 *
 * Every place that pushes a prompt to Vapi (provision, adopt, voice/language
 * update, config update, KB sync) goes through buildAgentPrompt() + buildVapiModel()
 * so the model choice and prompt-size rules live in one file.
 *
 * Prompt-size rules (cost reduction, step 2):
 *   • The system prompt is resent to the LLM on EVERY turn of every call, so each
 *     character costs (turns per call × calls per month).
 *   • Small catalogs (≤ PROMPT_CATALOG_INLINE_MAX_ITEMS) stay inline in a compact
 *     one-line-per-item format. Larger catalogs are replaced by a short category
 *     summary + the `search_catalog` tool, which returns only matching items.
 *   • A short KB (≤ PROMPT_KB_INLINE_MAX_CHARS) stays inline. A longer KB is
 *     replaced by a list of document titles + the `search_knowledge_base` tool.
 *   • The prompt contains nothing per-call (no dates, times, caller data), so it is
 *     byte-identical on every turn and the provider's automatic prompt cache
 *     (≥1,024-token prefixes, ~50% off cached input on OpenAI) applies from turn 2.
 *
 * Lookup tools need a public URL for this API (PUBLIC_API_URL or RENDER_EXTERNAL_URL).
 * Without one, everything stays inline — the previous behaviour.
 */

import mongoose from 'mongoose';
import type { IOrganization } from '../organization/organization.model';
import { KbDocumentModel } from '../knowledge-base/kb.model';
import { findAll as findAllCatalogItems } from '../catalog/catalog.service';
import type { ICatalogItem } from '../catalog/catalog.model';
import { generateSystemPrompt } from './prompt.utils';
import type { VapiInlineTool, VapiModel } from './vapi.service';
import { env } from '../../config/env';
import {
  getVoiceAgentModel,
  VOICE_AGENT_MAX_TOKENS,
  VOICE_AGENT_TEMPERATURE,
} from '../../config/llm';

// ─── KB context (moved here from kb.service so kb.service can depend on this file) ──

const KB_MAX_DOCS          = 20;
const KB_MAX_CHARS_PER_DOC = 1_200;   // matches compressPageText() output cap
const KB_MAX_TOTAL_CHARS   = 10_000;  // hard ceiling when the KB is inlined

/**
 * Formatted "## Knowledge Base" block for prompt injection.
 * Newest ready docs first; each truncated to 1,200 chars; total ≤ 10,000 chars.
 * Returns '' when the org has no ready documents.
 */
export async function getKbContext(orgId: mongoose.Types.ObjectId | string): Promise<string> {
  // faq_import docs are a copy of org.faqs, which generateSystemPrompt already
  // includes — skipping them removes the duplicate FAQ block (gaps.md OPS-08).
  const docs = await KbDocumentModel.find(
    { organizationId: orgId, status: 'ready', sourceType: { $ne: 'faq_import' } },
    { title: 1, content: 1, sourceType: 1 },
  )
    .sort({ updatedAt: -1 })
    .limit(KB_MAX_DOCS)
    .lean();

  if (!docs.length) return '';

  const sections: string[] = [];
  let totalChars = 0;

  for (const doc of docs) {
    const snippet = doc.content.slice(0, KB_MAX_CHARS_PER_DOC).trim();
    const entry   = `### ${doc.title}\n${snippet}`;
    if (totalChars + entry.length > KB_MAX_TOTAL_CHARS) break;
    sections.push(entry);
    totalChars += entry.length + 2;
  }

  if (!sections.length) return '';
  return `## Knowledge Base\n\n${sections.join('\n\n')}`;
}

// ─── Catalog formatting ───────────────────────────────────────────────────────

/** One compact line per item: "- LED Bulb 9W (Philips) — ₹129 per piece · stock 40". */
export function formatCatalogItemLine(item: Pick<ICatalogItem, 'name' | 'brand' | 'price' | 'unit' | 'stock'>): string {
  const brand = item.brand ? ` (${item.brand})` : '';
  const stock = item.stock > 0 ? `stock ${item.stock}` : 'OUT OF STOCK';
  return `- ${item.name}${brand} — ₹${item.price} per ${item.unit} · ${stock}`;
}

/**
 * Compact catalog grouped by category. Roughly half the tokens of the old
 * 7-column markdown table (no item IDs, no repeated category per row).
 */
export function formatCatalogCompact(items: ICatalogItem[]): string {
  if (!items.length) return '';
  const byCategory = new Map<string, ICatalogItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const blocks = [...byCategory.entries()].map(
    ([category, list]) => `### ${category}\n${list.map(formatCatalogItemLine).join('\n')}`,
  );
  return `## Product Catalog (authoritative — quote prices only from here)\n\n${blocks.join('\n\n')}`;
}

/** Summary used when the catalog is too large to inline. */
export function formatCatalogLookupSection(items: ICatalogItem[]): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  const categories = [...counts.entries()].map(([c, n]) => `${c} (${n})`).join(', ');
  return (
    `## Product Catalog\n` +
    `We stock ${items.length} products in these categories: ${categories}.\n` +
    `The full list is NOT in this prompt. Before you quote a price, confirm a product, or check stock, ` +
    `call the search_catalog tool with short English keywords (e.g. "ceiling fan 1200mm", "LED bulb 9W"). ` +
    `Quote prices ONLY from the tool result. If the tool returns no match, say you'll check and offer a callback.`
  );
}

/** Summary used when the KB is too large to inline. */
export function formatKbLookupSection(titles: string[]): string {
  return (
    `## Knowledge Base\n` +
    `Reference documents available: ${titles.map((t) => `"${t}"`).join(', ')}.\n` +
    `Their content is NOT in this prompt. For questions about policies, delivery, warranty, ` +
    `services or anything not covered above, call the search_knowledge_base tool with short ` +
    `English keywords and answer only from its result.`
  );
}

// ─── Lookup tools ─────────────────────────────────────────────────────────────

export const LOOKUP_TOOL_PATH = '/api/v1/tools/lookup';

/** Base URL for tool callbacks, or null when none is configured. */
export function getPublicApiUrl(): string | null {
  const raw = env.PUBLIC_API_URL ?? env.RENDER_EXTERNAL_URL;
  return raw ? raw.replace(/\/+$/, '') : null;
}

function lookupServer(baseUrl: string): VapiInlineTool['server'] {
  return {
    url: `${baseUrl}${LOOKUP_TOOL_PATH}`,
    timeoutSeconds: 10,
    ...(env.VAPI_TOOL_WEBHOOK_SECRET
      ? { headers: { 'x-webhook-secret': env.VAPI_TOOL_WEBHOOK_SECRET } }
      : {}),
  };
}

export function buildSearchCatalogTool(baseUrl: string): VapiInlineTool {
  return {
    type: 'function',
    function: {
      name: 'search_catalog',
      description:
        'Search the shop product catalog. Returns matching products with brand, price per unit and stock. ' +
        'Call before quoting any price or confirming any product.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Short English keywords for the product, e.g. "ceiling fan 1200mm" or "Havells MCB 32A".',
          },
        },
        required: ['query'],
      },
    },
    server: lookupServer(baseUrl),
  };
}

export function buildSearchKnowledgeBaseTool(baseUrl: string): VapiInlineTool {
  return {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description:
        'Search the business knowledge base (policies, delivery, warranty, services, FAQs). ' +
        'Returns the most relevant passages.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Short English keywords, e.g. "delivery charges" or "warranty claim".',
          },
        },
        required: ['query'],
      },
    },
    server: lookupServer(baseUrl),
  };
}

// ─── Prompt assembly ──────────────────────────────────────────────────────────

export interface AgentPromptResult {
  systemPrompt: string;
  /** Inline tools to attach to the model block (empty when everything is inline). */
  tools:        VapiInlineTool[];
  catalogMode:  'inline' | 'lookup' | 'none';
  kbMode:       'inline' | 'lookup' | 'none';
}

/**
 * Pure decision + assembly step (no DB) — unit-testable.
 */
export function assembleAgentPrompt(
  org: IOrganization,
  kbContext: string,
  kbTitles: string[],
  catalogItems: ICatalogItem[],
  baseUrl: string | null = getPublicApiUrl(),
): AgentPromptResult {
  const lookupAvailable = env.PROMPT_LOOKUP_TOOLS_ENABLED && baseUrl !== null;

  const catalogMode: AgentPromptResult['catalogMode'] =
    catalogItems.length === 0 ? 'none'
      : lookupAvailable && catalogItems.length > env.PROMPT_CATALOG_INLINE_MAX_ITEMS ? 'lookup'
        : 'inline';

  const kbMode: AgentPromptResult['kbMode'] =
    !kbContext.trim() ? 'none'
      : lookupAvailable && kbContext.length > env.PROMPT_KB_INLINE_MAX_CHARS ? 'lookup'
        : 'inline';

  const catalogSection =
    catalogMode === 'inline' ? formatCatalogCompact(catalogItems)
      : catalogMode === 'lookup' ? formatCatalogLookupSection(catalogItems)
        : '';

  const kbSection =
    kbMode === 'inline' ? kbContext
      : kbMode === 'lookup' ? formatKbLookupSection(kbTitles)
        : '';

  const systemPrompt = generateSystemPrompt(org, undefined, undefined, undefined, {
    catalogSection,
    kbSection,
  });

  const tools: VapiInlineTool[] = [];
  if (baseUrl && catalogMode === 'lookup') tools.push(buildSearchCatalogTool(baseUrl));
  if (baseUrl && kbMode === 'lookup')      tools.push(buildSearchKnowledgeBaseTool(baseUrl));

  return { systemPrompt, tools, catalogMode, kbMode };
}

/**
 * Loads KB + catalog for the org and returns the prompt + any lookup tools.
 * Use this everywhere a prompt is pushed to Vapi.
 */
export async function buildAgentPrompt(org: IOrganization): Promise<AgentPromptResult> {
  const [kbContext, kbTitleDocs, catalogItems] = await Promise.all([
    getKbContext(org._id),
    KbDocumentModel.find(
      { organizationId: org._id, status: 'ready', sourceType: { $ne: 'faq_import' } },
      { title: 1 },
    )
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(),
    findAllCatalogItems(org._id),
  ]);
  return assembleAgentPrompt(org, kbContext, kbTitleDocs.map((d) => d.title), catalogItems);
}

// ─── Model block ──────────────────────────────────────────────────────────────

/**
 * Vapi `model` block for live voice agents. Model comes from LLM_MODEL
 * (config/llm.ts); temperature and max tokens are fixed for all pushes so
 * provision and later updates can no longer drift apart (was 0.3 vs 0.65).
 */
export function buildVapiModel(
  systemPrompt: string,
  opts: { toolIds?: string[]; tools?: VapiInlineTool[] } = {},
): VapiModel {
  const llm = getVoiceAgentModel();
  return {
    provider:    llm.provider,
    model:       llm.model,
    messages:    [{ role: 'system', content: systemPrompt }],
    temperature: VOICE_AGENT_TEMPERATURE,
    maxTokens:   VOICE_AGENT_MAX_TOKENS,
    ...(opts.toolIds?.length ? { toolIds: opts.toolIds } : {}),
    ...(opts.tools?.length   ? { tools:   opts.tools }   : {}),
  };
}

/** Default pre-attached tool IDs (end call + submit order) from env. */
export function defaultToolIds(): string[] {
  return [env.VAPI_TOOL_ID_END_CALL, env.VAPI_TOOL_ID_SUBMIT_ORDER].filter(Boolean) as string[];
}
