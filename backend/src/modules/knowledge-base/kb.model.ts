/**
 * Knowledge Base Models
 *
 * KbDocument — a single unit of knowledge in the org's Knowledge Base.
 *
 * Source types:
 *   website_page  — a page crawled from the org's website (auto-populated during onboarding + re-sync)
 *   website_crawl — combined markdown document for the entire site
 *   manual_text   — text entered manually by the founder
 *   faq_import    — FAQs imported from the org's onboarding configuration
 *
 * Pipeline:
 *   create doc (status=pending) → enqueue kb-ingest job → worker sets status=ready
 *   For MVP: worker is a no-op beyond setting status (no vector embedding).
 *   The content is injected into the system prompt as plain text via getKbContext().
 *
 * Delta detection (re-sync):
 *   urlHash     — SHA-256 of the normalized URL (stable cross-session document identity)
 *   contentHash — SHA-256 of the cleaned page text (change detection — UNCHANGED if equal)
 *   version     — increments only when contentHash changes or doc is deleted
 *
 * KbCategory — one category row per org per category slug.
 *   Seeded from SYSTEM_CATEGORIES on first crawl.
 *   Additional categories auto-created when needed.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { createHash } from 'crypto';

// ─── Utility ───────────────────────────────────────────────────────────────────

/** Stable SHA-256 hex string from any string input. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// ─── Categories ────────────────────────────────────────────────────────────────

export const KB_CATEGORIES = [
  { slug: 'company-overview',       name: 'Company Overview',        tier: 2 },
  { slug: 'products',               name: 'Products',                tier: 2 },
  { slug: 'services',               name: 'Services',                tier: 2 },
  { slug: 'faqs',                   name: 'FAQs',                    tier: 2 },
  { slug: 'contact-information',    name: 'Contact Information',     tier: 1 },
  { slug: 'business-hours',         name: 'Business Hours',          tier: 1 },
  { slug: 'locations',              name: 'Locations',               tier: 1 },
  { slug: 'pricing',                name: 'Pricing',                 tier: 2 },
  { slug: 'team-members',           name: 'Team Members',            tier: 3 },
  { slug: 'reviews-testimonials',   name: 'Reviews & Testimonials',  tier: 3 },
  { slug: 'blogs-articles',         name: 'Blogs & Articles',        tier: 4 },
  { slug: 'policies',               name: 'Policies',                tier: 3 },
  { slug: 'careers',                name: 'Careers',                 tier: 4 },
  { slug: 'support',                name: 'Support',                 tier: 3 },
  { slug: 'documentation',          name: 'Documentation',           tier: 4 },
  { slug: 'downloads-resources',    name: 'Downloads & Resources',   tier: 4 },
  { slug: 'events',                 name: 'Events',                  tier: 4 },
  { slug: 'forms',                  name: 'Forms',                   tier: 5 },
  { slug: 'tracking-pages',         name: 'Tracking Pages',          tier: 5 },
  { slug: 'other',                  name: 'Other',                   tier: 3 },
] as const;

export type KbCategorySlug = typeof KB_CATEGORIES[number]['slug'];

/** Rule-based URL → category assignment. Returns slug or null if no rule matches. */
export function categorizeByUrl(url: string): KbCategorySlug | null {
  let path: string;
  try { path = new URL(url).pathname.toLowerCase(); } catch { return null; }

  if (/\/(about|about-us|our-story|company|who-we-are)(\/|$)/.test(path)) return 'company-overview';
  if (/\/(faq|faqs|frequently-asked|frequently-asked-questions|help\/faq|questions|q-and-a|q&a|common-questions)(\/|$)/.test(path)) return 'faqs';
  if (/\/(contact|contact-us|reach-us|get-in-touch)(\/|$)/.test(path))     return 'contact-information';
  if (/\/(pricing|plans|packages|price)(\/|$)/.test(path))                  return 'pricing';
  if (/\/(team|staff|our-team|meet-the-team|doctors|attorneys)(\/|$)/.test(path)) return 'team-members';
  if (/\/(testimonials|reviews|case-studies)(\/|$)/.test(path))             return 'reviews-testimonials';
  if (/\/(blog|news|article|articles|insights|updates)(\/|$)/.test(path))   return 'blogs-articles';
  if (/\/(privacy|privacy-policy|terms|terms-of-service|tos|refund|shipping|return-policy|cookie)(\/|$)/.test(path)) return 'policies';
  if (/\/(careers|jobs|work-with-us|join-us|vacancies)(\/|$)/.test(path))   return 'careers';
  if (/\/(support|help-center|helpdesk|tickets)(\/|$)/.test(path))          return 'support';
  if (/\/(docs|documentation|api|developers|dev)(\/|$)/.test(path))         return 'documentation';
  if (/\/(download|downloads|resources|ebooks|whitepapers)(\/|$)/.test(path)) return 'downloads-resources';
  if (/\/(events|webinars|workshops)(\/|$)/.test(path))                     return 'events';
  if (/\/(product|products|catalogue|catalog|menu)(\/|$)/.test(path))       return 'products';
  if (/\/(service|services|what-we-do|solutions|offerings)(\/|$)/.test(path)) return 'services';
  if (/\/(track|tracking|order-status|order-track)(\/|$)/.test(path))       return 'tracking-pages';
  if (/\/(location|locations|branches|stores|outlets)(\/|$)/.test(path))    return 'locations';

  return null;
}

// ─── KbCategory model ─────────────────────────────────────────────────────────

export interface IKbCategory extends Document {
  _id:            mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  slug:           string;
  name:           string;
  /** Retrieval tier: P1 = always in context, P5 = excluded. See architecture doc §4.3 */
  tier:           1 | 2 | 3 | 4 | 5;
  type:           'system' | 'auto-created';
  documentCount:  number;
  createdAt:      Date;
  updatedAt:      Date;
}

const KbCategorySchema = new Schema<IKbCategory>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    slug:           { type: String, required: true, trim: true },
    name:           { type: String, required: true, trim: true },
    tier:           { type: Number, enum: [1, 2, 3, 4, 5], default: 3 },
    type:           { type: String, enum: ['system', 'auto-created'], default: 'system' },
    documentCount:  { type: Number, default: 0 },
  },
  { timestamps: true },
);

KbCategorySchema.index({ organizationId: 1, slug: 1 }, { unique: true });

KbCategorySchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const KbCategoryModel = mongoose.model<IKbCategory>('KbCategory', KbCategorySchema);

/**
 * Seed system categories for an org if they don't exist yet.
 * Called after the first crawl completes.
 * Safe to call multiple times — uses upsert.
 */
export async function seedCategoriesForOrg(orgId: string): Promise<void> {
  const ops = KB_CATEGORIES.map((cat) => ({
    updateOne: {
      filter:  { organizationId: new mongoose.Types.ObjectId(orgId), slug: cat.slug },
      update:  { $setOnInsert: { name: cat.name, tier: cat.tier, type: 'system' as const, documentCount: 0 } },
      upsert:  true,
    },
  }));
  await KbCategoryModel.bulkWrite(ops, { ordered: false });
}

// ─── KbDocument model ─────────────────────────────────────────────────────────

export type KbSourceType = 'website_page' | 'website_crawl' | 'manual_text' | 'faq_import';
export type KbDocStatus  = 'pending' | 'ready' | 'failed';

export interface IKbDocument extends Document {
  _id:            mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  title:          string;
  content:        string;
  sourceType:     KbSourceType;
  sourceUrl?:     string;    // for website_page only
  status:         KbDocStatus;
  tokenEstimate:  number;    // rough token count (content.length / 4)
  errorMessage?:  string;    // set if status=failed

  // ── Category ────────────────────────────────────────────────────────
  /** Category slug assigned by the categorizer (rule-based or 'other') */
  category?:       string;
  /** How category was assigned */
  categorySource?: 'rule' | 'manual';

  // ── Delta detection ──────────────────────────────────────────────────
  /** SHA-256(normalizedUrl) — stable identifier across crawl sessions */
  urlHash?:        string;
  /** SHA-256(rawText) — change signal; unchanged if equal across re-sync sessions */
  contentHash?:    string;
  /** Starts at 1; increments only when contentHash changes or document is deleted */
  version:         number;

  createdAt:      Date;
  updatedAt:      Date;
}

const KbDocumentSchema = new Schema<IKbDocument>(
  {
    organizationId: {
      type:     Schema.Types.ObjectId,
      ref:      'Organization',
      required: true,
      index:    true,
    },
    title: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 300,
    },
    content: {
      type:      String,
      required:  true,
      maxlength: 50_000,   // ~12,500 tokens — generous upper bound per document
    },
    sourceType: {
      type:    String,
      enum:    ['website_page', 'website_crawl', 'manual_text', 'faq_import'] satisfies KbSourceType[],
      required: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    status: {
      type:    String,
      enum:    ['pending', 'ready', 'failed'] satisfies KbDocStatus[],
      default: 'pending',
      index:   true,
    },
    tokenEstimate: {
      type:    Number,
      default: 0,
    },
    errorMessage: {
      type: String,
    },

    // ── Category ──────────────────────────────────────────────────────
    category: {
      type:  String,
      index: true,
    },
    categorySource: {
      type: String,
      enum: ['rule', 'manual'],
    },

    // ── Delta detection ───────────────────────────────────────────────
    urlHash: {
      type:  String,
      index: true,
    },
    contentHash: {
      type: String,
    },
    version: {
      type:    Number,
      default: 1,
    },
  },
  { timestamps: true },
);

// Composite indexes
KbDocumentSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
KbDocumentSchema.index({ organizationId: 1, category: 1, status: 1 });

// urlHash uniqueness per org — primary delta-detection key.
//
// Why partialFilterExpression instead of sparse: true?
//   MongoDB compound sparse indexes include a document when ANY indexed field
//   is non-null.  Because organizationId is always present, every document is
//   included — even website_crawl / faq_import docs that have no urlHash.
//   Two such docs in the same org both land on { organizationId, urlHash: null }
//   and collide (E11000).
//
//   partialFilterExpression { urlHash: { $type: 'string' } } only indexes
//   documents where urlHash is a real string — docs without it are excluded.
//
// Migration: M002 in database.ts drops the old sparse version so Mongoose
//   can recreate this index with the correct partial-filter definition.
KbDocumentSchema.index(
  { organizationId: 1, urlHash: 1 },
  {
    unique: true,
    partialFilterExpression: { urlHash: { $type: 'string' } },
  },
);

KbDocumentSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    ret.organizationId = ret.organizationId?.toString();
    delete ret.__v;
    return ret;
  },
});

export const KbDocumentModel = mongoose.model<IKbDocument>('KbDocument', KbDocumentSchema);
