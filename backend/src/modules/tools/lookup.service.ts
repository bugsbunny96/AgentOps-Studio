/**
 * Lookup service — answers the search_catalog / search_knowledge_base tool calls.
 *
 * These tools exist so large catalogs and knowledge bases do not have to sit in
 * the system prompt (which is resent on every turn). Matching is plain keyword
 * scoring: callers' agents send short English keywords (the tool descriptions ask
 * for that), and per-org data is small (≤ a few hundred items / 50 docs), so an
 * in-memory scan is fast and needs no index or embeddings.
 */

import mongoose from 'mongoose';
import { CatalogItemModel } from '../catalog/catalog.model';
import { KbDocumentModel } from '../knowledge-base/kb.model';
import { formatCatalogItemLine } from '../agents/assistant-config';

const MAX_CATALOG_RESULTS = 8;
const MAX_KB_RESULTS      = 2;
const KB_SNIPPET_CHARS    = 800;

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'or', 'to', 'in', 'with', 'do', 'you', 'have', 'is', 'are', 'what', 'price', 'cost', 'kya', 'hai']);

/** Lower-cases, strips punctuation, drops stop words and 1-char tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Fraction-weighted keyword score: exact token hits count 2, substring hits 1. */
export function scoreText(queryTokens: string[], haystack: string): number {
  if (!queryTokens.length) return 0;
  const hay = haystack.toLowerCase();
  const hayTokens = new Set(tokenize(haystack));
  let score = 0;
  for (const q of queryTokens) {
    if (hayTokens.has(q)) score += 2;
    else if (hay.includes(q)) score += 1;
  }
  return score;
}

export async function searchCatalog(orgId: mongoose.Types.ObjectId, query: string): Promise<string> {
  const tokens = tokenize(query);
  const items = await CatalogItemModel.find({ organizationId: orgId, isActive: true }).lean();
  const ranked = items
    .map((item) => ({ item, score: scoreText(tokens, `${item.name} ${item.brand ?? ''} ${item.category}`) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CATALOG_RESULTS);

  if (!ranked.length) {
    return `No catalog product matches "${query}". Do not guess a price — say you will check and offer a callback.`;
  }
  return `Catalog matches for "${query}" (prices are authoritative):\n${ranked.map((r) => formatCatalogItemLine(r.item)).join('\n')}`;
}

export async function searchKnowledgeBase(orgId: mongoose.Types.ObjectId, query: string): Promise<string> {
  const tokens = tokenize(query);
  const docs = await KbDocumentModel.find(
    { organizationId: orgId, status: 'ready' },
    { title: 1, content: 1 },
  )
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  const ranked = docs
    .map((doc) => ({ doc, score: scoreText(tokens, doc.title) * 2 + scoreText(tokens, doc.content) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_KB_RESULTS);

  if (!ranked.length) {
    return `Nothing in the knowledge base matches "${query}". Do not make up an answer — offer to take a message or arrange a callback.`;
  }
  return ranked
    .map((r) => `### ${r.doc.title}\n${bestSnippet(tokens, r.doc.content)}`)
    .join('\n\n');
}

/** Returns the KB_SNIPPET_CHARS window around the first query hit (or the start). */
function bestSnippet(tokens: string[], content: string): string {
  if (content.length <= KB_SNIPPET_CHARS) return content.trim();
  const lower = content.toLowerCase();
  const hit = tokens.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - Math.floor(KB_SNIPPET_CHARS / 4));
  return content.slice(start, start + KB_SNIPPET_CHARS).trim();
}
