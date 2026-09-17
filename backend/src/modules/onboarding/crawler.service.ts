/**
 * Website Crawler Service (v3 — Full-Site BFS + Categories + Delta Re-sync)
 *
 * Stack-agnostic multi-page crawler:
 *   • Sitemap-first:  tries sitemap.xml / sitemap_index.xml / robots.txt / CMS paths
 *   • BFS discovery:  extracts links from EVERY crawled page, not just the homepage
 *   • SSR/static:     WordPress, Shopify, PHP, Django, Rails → full text via cheerio
 *   • SPAs:           React, Vue, Angular, Next.js → meta tags + JSON-LD fallback
 *
 * New in v3:
 *   • Rule-based URL categorization (20 categories — see KB_CATEGORIES)
 *   • SHA-256 contentHash per page for delta detection during re-sync
 *   • SHA-256 urlHash per page as stable cross-session document identity
 *   • Delta re-sync: only ADDED/UPDATED pages create/update KB docs;
 *     pages no longer found are marked as deleted (removed from DB)
 *   • No scheduled re-sync — manual only, rate-limited to once per 30 days
 *
 * Flow:
 *   1. Fetch homepage (seed HTML)
 *   2. Discover page URLs: sitemap.xml first, then BFS link extraction from each page
 *   3. Prioritize business-relevant paths
 *   4. Crawl up to MAX_PAGES pages, collecting text from each
 *   5. Assign category per URL (rule-based)
 *   6. Compute contentHash per page
 *   7. Delta compare vs. existing KB docs (first crawl: all = ADDED; re-sync: diff)
 *   8. Send combined text to GPT-4o-mini for structured extraction
 *   9. Persist extracted data → Organization document + KB documents
 *  10. Seed KB categories, sync Vapi
 */

import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import { OrganizationModel } from '../organization/organization.model';
import { KbDocumentModel, KB_CATEGORIES, seedCategoriesForOrg, categorizeByUrl, sha256 } from '../knowledge-base/kb.model';
import { importFaqsToKb, syncKbToVapi } from '../knowledge-base/kb.service';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Maximum pages to crawl per site */
const MAX_PAGES = 50;

/** Timeout for each individual HTTP fetch */
const FETCH_TIMEOUT_MS = 10_000;

/** Max URLs to pull from a sitemap (avoids crawling 10 000-page e-commerce sites) */
const MAX_SITEMAP_URLS = 300;

/** Pages to prioritize in crawl order (exact path match or startsWith) */
const PRIORITY_PATHS = [
  '/about', '/about-us', '/our-story', '/company',
  '/services', '/service', '/what-we-do', '/solutions', '/offerings',
  '/products', '/product', '/menu', '/catalogue', '/catalog',
  '/contact', '/contact-us', '/reach-us', '/get-in-touch',
  '/faq', '/faqs', '/frequently-asked-questions', '/help',
  '/pricing', '/price', '/plans', '/packages',
  '/team', '/staff', '/doctors', '/attorneys',
  '/locations', '/location', '/branches', '/stores',
  '/blog', '/news', '/articles', '/resources',
];

// ─── Structured-field category guard ─────────────────────────────────────────
//
// These KB categories have a direct 1-to-1 mapping to a structured field on
// the Organization model (populated in Step 6 by the LLM extractor).
// Pages whose category falls into this set are intentionally excluded from
// the KB document table — the information is surfaced in the
// "Business Info" panel on the Knowledge Base page instead.
//
// Remaining categories (pricing, blog, policies, …) still generate KB docs.
export const STRUCTURED_FIELD_CATEGORIES = new Set([
  'company-overview',    // → Organization.businessDescription
  'contact-information', // → Organization.contactDetails
  'business-hours',      // → Organization.businessHours
  'services',            // → Organization.services[]
  'products',            // → Organization.services[] (merged with services)
  'locations',           // → Organization.locations[]
  'faqs',                // → Organization.faqs[]
]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedData {
  businessDescription?: string;
  services: string[];
  businessHours?: { start: string; end: string } | null;
  contactEmail?: string;
  contactPhone?: string;
  locations: string[];
  faqs: Array<{ question: string; answer: string }>;
}

/** Internal representation of one crawled page */
interface PageData {
  url:         string;
  text:        string;
  category:    string;
  urlHash:     string;
  contentHash: string;
}

/** Result returned from crawlWebsite — consumed by tests and future hooks */
export interface CrawlResult {
  added:     number;
  updated:   number;
  deleted:   number;
  unchanged: number;
  failed:    number;
  total:     number;
}

// ─── HTTP fetch helpers ────────────────────────────────────────────────────────

/** Generic HTTP fetch with timeout. Returns raw text or null on failure. */
async function fetchText(
  url: string,
  acceptHeader = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':      'AgentOps-Crawler/3.0 (+https://agentops.studio/bot)',
        'Accept':          acceptHeader,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

/** Fetch HTML — returns null if response is not HTML content type */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':      'AgentOps-Crawler/3.0 (+https://agentops.studio/bot)',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// ─── Sitemap discovery ────────────────────────────────────────────────────────

async function fetchSitemapUrlsFromRobots(baseUrl: string): Promise<string[]> {
  const robotsText = await fetchText(`${baseUrl}/robots.txt`, 'text/plain');
  if (!robotsText) return [];
  const found: string[] = [];
  for (const line of robotsText.split('\n')) {
    const match = /^Sitemap:\s*(.+)/i.exec(line.trim());
    if (match?.[1]) found.push(match[1].trim());
  }
  return found;
}

function parseSitemapXml(xml: string): { type: 'urlset' | 'index'; urls: string[] } {
  const $ = cheerio.load(xml, { xmlMode: true });
  if ($('sitemapindex').length > 0) {
    const urls: string[] = [];
    $('sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) urls.push(loc);
    });
    return { type: 'index', urls };
  }
  const urls: string[] = [];
  $('url > loc').each((_, el) => {
    const loc = $(el).text().trim();
    if (loc) urls.push(loc);
  });
  return { type: 'urlset', urls };
}

async function discoverUrlsFromSitemap(baseUrl: string): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const pageUrls = new Set<string>();
  const sitemapQueue: string[] = [];

  const robotsSitemaps = await fetchSitemapUrlsFromRobots(baseUrl);
  sitemapQueue.push(...robotsSitemaps);

  const wellKnown = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemap/sitemap-index.xml`,
    `${origin}/sitemap1.xml`,
  ];
  for (const url of wellKnown) {
    if (!sitemapQueue.includes(url)) sitemapQueue.push(url);
  }

  const processedSitemaps = new Set<string>();

  for (let level = 0; level < 2 && sitemapQueue.length > 0; level++) {
    const batch = sitemapQueue.splice(0);
    for (const sitemapUrl of batch) {
      if (processedSitemaps.has(sitemapUrl)) continue;
      processedSitemaps.add(sitemapUrl);

      const xml = await fetchText(sitemapUrl, 'text/xml,application/xml,*/*;q=0.8');
      if (!xml || xml.trim().length < 20) continue;
      if (!xml.trim().startsWith('<')) continue;

      const parsed = parseSitemapXml(xml);

      if (parsed.type === 'index') {
        sitemapQueue.push(...parsed.urls);
      } else {
        for (const loc of parsed.urls) {
          try {
            const u = new URL(loc);
            if (u.origin === origin) {
              pageUrls.add(u.origin + u.pathname.replace(/\/$/, '') || '/');
            }
          } catch { /* malformed URL */ }
          if (pageUrls.size >= MAX_SITEMAP_URLS) break;
        }
      }
      if (pageUrls.size >= MAX_SITEMAP_URLS) break;
    }
  }

  logger.info('Sitemap discovery complete', { origin, pagesFound: pageUrls.size });
  return Array.from(pageUrls);
}

// ─── Link extraction ──────────────────────────────────────────────────────────

function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const parsed = new URL(href, base);
      if (parsed.hostname !== base.hostname) return;
      if (/\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|zip|gz|css|js|woff|woff2|ttf|eot)(\?|$)/i.test(parsed.pathname)) return;
      const clean = parsed.origin + parsed.pathname.replace(/\/$/, '') || '/';
      seen.add(clean);
    } catch { /* malformed href */ }
  });

  return Array.from(seen);
}

// ─── URL prioritization ───────────────────────────────────────────────────────

function isPriorityUrl(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return PRIORITY_PATHS.some(
    (p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '-'),
  );
}

function buildCrawlQueue(
  sitemapUrls: string[],
  discoveredUrls: string[],
  baseUrl: string,
): string[] {
  const origin      = new URL(baseUrl).origin;
  const homepageNorm = origin + '/';

  const allUrls = [
    homepageNorm,
    ...sitemapUrls,
    ...discoveredUrls,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const priority = allUrls.filter((u) => u !== homepageNorm && isPriorityUrl(u));
  const rest     = allUrls.filter((u) => u !== homepageNorm && !isPriorityUrl(u));

  return [homepageNorm, ...priority, ...rest].slice(0, MAX_PAGES);
}

// ─── URL normalization ─────────────────────────────────────────────────────────

/**
 * Normalize URL for stable hashing:
 *   - Lowercase scheme + host
 *   - Remove tracking query params (utm_*, fbclid, gclid, ref, source)
 *   - Remove fragments
 *   - Remove trailing slash from non-root paths
 */
function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hostname = u.hostname.toLowerCase();
    u.protocol = u.protocol.toLowerCase();

    // Remove tracking params
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'source'];
    for (const p of trackingParams) u.searchParams.delete(p);

    // Sort remaining params for stable hash
    u.searchParams.sort();

    // Remove fragment
    u.hash = '';

    // Remove trailing slash (except root)
    const pathname = u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, '');

    return u.origin + pathname + (u.search ? u.search : '');
  } catch {
    return rawUrl;
  }
}

// ─── Text extraction ──────────────────────────────────────────────────────────

function extractText(html: string): string {
  const $ = cheerio.load(html);

  // ── Extract JSON-LD FIRST, before any script removal ──────────────────────
  // $('script, ...').remove() below strips ALL script elements, including
  // application/ld+json blocks.  We capture JSON-LD content here before that.
  const jsonLd: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $.html(el).replace(/<\/?script[^>]*>/g, '').trim();
    if (raw.length > 10) jsonLd.push(raw);
  });

  // ── Remove noisy elements AFTER JSON-LD is captured ───────────────────────
  $(
    'script, style, noscript, iframe, svg, nav, header, footer, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
    '.nav, .navbar, .header, .footer, .sidebar, .cookie-banner, ' +
    '.cookie-notice, .cookie-popup, .newsletter-popup, .modal-overlay, ' +
    '#nav, #header, #footer, #sidebar',
  ).remove();

  const title    = $('title').text().trim();
  const metaDesc =
    $('meta[name="description"]').attr('content') ??
    $('meta[property="og:description"]').attr('content') ??
    '';

  // Insert newlines after block-level elements so paragraph/heading/list structure
  // is preserved in the extracted text.  Without this, a page like:
  //   <h3>How much does it cost?</h3><p>The cost depends on distance.</p>
  // becomes "How much does it cost? The cost depends on distance." — one flat line.
  // With newlines inserted the text becomes multi-line, which our rule-based
  // FAQ extractor can split on correctly.
  $('p, li, h1, h2, h3, h4, h5, h6, dt, dd, br, div').after('\n');
  const bodyText = $('body')
    .text()
    .replace(/[^\S\n]+/g, ' ')   // collapse horizontal whitespace but keep newlines
    .replace(/\n{3,}/g, '\n\n')  // normalise to max 2 consecutive blank lines
    .trim()
    .slice(0, 4_000);

  // JSON-LD comes FIRST (before body text) so it is never truncated by the 5_000-char
  // per-page limit.  The JSON-LD parser in extractFaqsFromJsonLd() scans for lines
  // starting with '{' or '[' that contain "@type" — it must see the full JSON block.
  return [title, metaDesc, ...jsonLd, bodyText].filter(Boolean).join('\n').slice(0, 5_000);
}

// ─── Page content compression ─────────────────────────────────────────────────

/**
 * Compress raw scraped page text into a concise, token-efficient summary.
 *
 * Goals:
 *   - Strip boilerplate (nav labels, cookie banners, JSON-LD blocks, CTA noise)
 *   - Deduplicate repeated sentences (site-wide nav is copied into every page)
 *   - Keep only lines that carry real information (≥4 meaningful words)
 *   - Target ~800 chars output (≈200 tokens) vs raw input of up to 5,000 chars
 *
 * The compressed text is stored as the KB document's `content` field.
 * Structured fields (FAQs, services, hours, contact) are stored on the Org
 * model — they don't need to be in the KB doc body.
 */
function compressPageText(rawText: string, category: string): string {
  // 1. Strip page-prefix markers and JSON-LD blocks (already extracted into org fields)
  const withoutPrefix = rawText
    .replace(/\[(?:Homepage|Page:[^\]]+)\]\n?/g, '')
    .replace(/---PAGE BREAK---\n?/g, '');

  // Split on newlines to process line by line
  const lines = withoutPrefix.split('\n');

  // 2. Static boilerplate phrases to reject outright (case-insensitive)
  const BOILERPLATE_PATTERNS = [
    /^(home|about|about us|services|contact|contact us|blog|news|careers|login|sign in|sign up|register|get started|learn more|read more|click here|call us|email us|follow us|subscribe|newsletter|cookie|privacy policy|terms|sitemap|back to top|menu|navigation|toggle|search|close|open|submit|send|next|previous|prev)$/i,
    /^(copyright|©|\d{4}\s+all rights reserved)/i,
    /^https?:\/\//,                                    // bare URLs
    /^\+?\d[\d\s\-().]{5,}$/,                         // phone numbers as standalone lines
    /^[\w.+-]+@[\w.-]+\.\w{2,6}$/,                    // email addresses as standalone lines
    /\{"@/,                                            // JSON-LD remnants
    /^\s*[\|•·–—]\s*$/,                               // decoration-only lines
  ];

  // 3. Score and filter lines
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Skip JSON-LD blocks that slipped through (start with { or [, contain @type)
    if ((line.startsWith('{') || line.startsWith('[')) && line.includes('"@type"')) continue;

    // Skip boilerplate
    if (BOILERPLATE_PATTERNS.some((re) => re.test(line))) continue;

    // Require at least 4 words — single/triple-word lines are usually labels
    const wordCount = line.split(/\s+/).filter(Boolean).length;
    if (wordCount < 4) continue;

    // Deduplicate (normalise to lowercase + collapse whitespace before comparing)
    const key = line.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);

    kept.push(line);
  }

  // 4. For high-noise categories (homepage, company-overview) keep fewer lines
  //    so they don't drown out more specific pages in RAG injection.
  //    For content-rich categories (faqs, services) allow more.
  const targetLines = (category === 'faqs' || category === 'services' || category === 'products')
    ? 20
    : (category === 'company-overview' || category === 'other')
      ? 10
      : 15;

  const selected = kept.slice(0, targetLines);

  // 5. Join and hard-cap at 1,200 chars (~300 tokens)
  const compressed = selected.join('\n').slice(0, 1_200).trim();

  // 6. If nothing survived (fully JS-rendered page), keep a minimal fallback
  if (!compressed) {
    return withoutPrefix.replace(/\s+/g, ' ').trim().slice(0, 400);
  }

  return compressed;
}

// ─── Rule-based extraction helpers ───────────────────────────────────────────

/**
 * Strip internal page-prefix markers ([Homepage], [Page: /path]) and normalize
 * whitespace, preserving single newlines between paragraphs.
 */
function stripPagePrefixes(text: string): string {
  return text
    .replace(/\[(?:Homepage|Page:[^\]]+)\]\n?/g, '')
    .replace(/---PAGE BREAK---\n?/g, '')
    .replace(/[^\S\n]+/g, ' ')   // collapse horizontal whitespace, keep newlines
    .replace(/\n{3,}/g, '\n\n')  // max 2 consecutive blank lines
    .trim();
}

/**
 * Extract FAQs from schema.org FAQPage JSON-LD embedded in page text.
 *
 * `extractText()` appends raw JSON-LD content (stripped of <script> tags) as
 * extra lines at the end of each page's text string.  We try JSON.parse on
 * every newline-delimited segment — valid JSON-LD parses cleanly; non-JSON
 * lines throw and are silently skipped.
 *
 * Schema handled:
 *   { "@type": "FAQPage", "mainEntity": [ { "@type": "Question",
 *       "name": "question text",
 *       "acceptedAnswer": { "text": "answer text" } } ] }
 *
 * Also handles arrays at root: [{ "@type": "FAQPage", ... }]
 */
function extractFaqsFromJsonLd(pageTexts: string[]): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function processEntity(entity: any) {
    if (!entity || entity['@type'] !== 'Question') return;
    const question = String(entity.name ?? '').trim();
    const answer   = String(entity.acceptedAnswer?.text ?? '')
      .replace(/<[^>]+>/g, ' ')   // strip any embedded HTML
      .replace(/\s+/g, ' ')
      .trim();
    if (question.length > 5 && answer.length > 5) {
      faqs.push({ question: question.slice(0, 200), answer: answer.slice(0, 300) });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function processRoot(root: any) {
    if (!root || typeof root !== 'object') return;
    const items: unknown[] = Array.isArray(root) ? root : [root];
    for (const item of items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = item as any;
      if (!obj || typeof obj !== 'object') continue;
      if (obj['@type'] === 'FAQPage') {
        for (const entity of (obj.mainEntity ?? [])) processEntity(entity);
      } else if (obj['@type'] === 'Question') {
        processEntity(obj);
      }
      // Also scan @graph arrays (common in WordPress Yoast/RankMath output)
      if (Array.isArray(obj['@graph'])) {
        for (const g of obj['@graph']) processRoot(g);
      }
    }
  }

  for (const text of pageTexts) {
    if (faqs.length >= 10) break;
    // Each line in the text that starts with '{' or '[' could be a JSON-LD block
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) continue;
      if (!trimmed.includes('"@type"')) continue;   // quick filter
      try {
        processRoot(JSON.parse(trimmed));
      } catch { /* not valid JSON — skip */ }
    }
  }

  return faqs.slice(0, 10);
}

/**
 * Rule-based FAQ extraction — works without LLM and with compressed text.
 *
 * `extractText()` collapses all whitespace to single spaces, so the input is a
 * continuous string with no newlines.  A line-based splitter finds nothing.
 *
 * Strategy: split the combined text on '?' characters.  Each segment is the
 * text leading up to one '?'.  Walk backwards through each segment's words to
 * find the last question-shaped phrase (3–30 words, no sentence-ending
 * punctuation in the middle).  The NEXT segment's leading words are the answer
 * (up to the first full stop or 250 chars).
 */
function extractFaqsFromText(texts: string[]): Array<{ question: string; answer: string }> {
  // Collapse and clean — output is a single flat string, no newlines
  const combined = texts
    .map(stripPagePrefixes)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const faqs: Array<{ question: string; answer: string }> = [];
  if (!combined) return faqs;

  const segments = combined.split('?');

  for (let i = 0; i < segments.length - 1 && faqs.length < 10; i++) {
    const words = segments[i].trim().split(/\s+/);

    // Walk backwards to find the last question-like phrase
    const questionWords: string[] = [];
    for (let w = words.length - 1; w >= 0 && questionWords.length < 30; w--) {
      const word = words[w];
      questionWords.unshift(word);
      // Stop at a preceding sentence end (word before this one ends in . or !)
      if (w > 0 && /[.!]$/.test(words[w - 1])) break;
    }

    const question = questionWords.join(' ').trim();
    if (question.length < 10 || question.length > 200) continue;
    if (questionWords.length < 3)                      continue; // too short
    // Skip nav-style single-noun "questions" like "Contact Us?" or "Get a Quote?"
    if (/^(get|contact|call|click|read|view|see|learn|find|book|request|schedule)\b/i.test(question)) continue;

    const fullQuestion = question + '?';

    // Answer: take the next segment up to the first full sentence end
    const nextSeg = segments[i + 1].trim();
    const sentenceEnd = nextSeg.search(/[.!]\s/);
    const answer = sentenceEnd >= 0
      ? nextSeg.slice(0, sentenceEnd + 1).trim()
      : nextSeg.slice(0, 250).trim();

    if (answer.length < 15) continue;

    faqs.push({ question: fullQuestion, answer: answer.slice(0, 300) });
  }

  return faqs;
}

/**
 * Rule-based services extraction.
 *
 * `extractText()` produces a single space-separated blob.  Scan for uppercase
 * multi-word phrases (2–6 words, title-case, no trailing punctuation) that are
 * likely service labels rather than navigation or prose.
 *
 * Works best when service/product category pages have headings like
 * "Home Shifting", "Office Relocation", "Vehicle Transportation".
 */
function extractServicesFromText(texts: string[]): string[] {
  const combined = texts
    .map(stripPagePrefixes)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Match 2–6 consecutive title-case words (no common stop words) that are
  // surrounded by spaces / punctuation — likely headings or list labels
  const titleCaseChunk = /(?:^|\s)([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,5})(?=\s|[.,!?]|$)/g;
  const candidates = new Set<string>();

  // Skip words that are clearly navigation, pronouns, or generic
  const stopWords = new Set([
    'Home', 'About', 'Contact', 'Login', 'More', 'Read', 'Click', 'Call',
    'View', 'Get', 'Our', 'Your', 'The', 'And', 'For', 'With', 'This', 'That',
    'From', 'Have', 'Will', 'Been', 'Into', 'How', 'What', 'When', 'Where',
    'Why', 'Who', 'All', 'Are', 'Was', 'Can',
  ]);

  let match: RegExpExecArray | null;
  while ((match = titleCaseChunk.exec(combined)) !== null) {
    const chunk = match[1].trim();
    const words = chunk.split(/\s+/);
    if (words.some((w) => stopWords.has(w))) continue;
    if (chunk.length < 5 || chunk.length > 60) continue;
    candidates.add(chunk);
    if (candidates.size >= 10) break;
  }

  return Array.from(candidates);
}

// ─── GPT-4o-mini structured extraction ───────────────────────────────────────

async function extractWithLLM(
  combinedText: string,
  websiteUrl: string,
): Promise<ExtractedData> {
  const emailMatch = combinedText.match(/[\w.+-]+@[\w.-]+\.\w{2,6}/);
  const phoneMatch = combinedText.match(/(?:\+?\d[\d\s\-().]{7,15}\d)/);

  // Regex fallback used when no API key or LLM call fails.
  // Description is cleaned (no [Homepage] prefix) and other rule-based
  // results are filled in by the caller (Step 5) after this function returns.
  const regexFallback = (): ExtractedData => ({
    businessDescription: stripPagePrefixes(combinedText).slice(0, 400),
    services:     [],
    locations:    [],
    faqs:         [],
    contactEmail: emailMatch?.[0],
    contactPhone: phoneMatch?.[0],
  });

  if (!env.OPENAI_API_KEY) {
    logger.info('OpenAI key not set — using rule-based fallback for crawl extraction');
    return regexFallback();
  }

  const prompt = `You are extracting structured business information from a website's text content.

Website: ${websiteUrl}

Content (scraped from multiple pages, highest-signal pages first):
${combinedText.slice(0, 14_000)}

Return a single JSON object with EXACTLY these fields:
{
  "businessDescription": "2-4 sentence description of what this business does and who it serves (50-400 chars, required — write it yourself, do NOT copy raw page text)",
  "services": ["service1", "service2"],
  "businessHours": {"start": "HH:MM", "end": "HH:MM"} or null,
  "contactEmail": "email@example.com" or null,
  "contactPhone": "+91-98765-43210" or null,
  "locations": ["City, State" or "Full address"],
  "faqs": [{"question": "...", "answer": "..."}]
}

Rules:
- businessDescription: REQUIRED. Write a clean 2-4 sentence summary — do NOT copy the raw text verbatim
- services: max 10 short labels (e.g. "Home Shifting", "Office Relocation", "Packing & Moving")
- businessHours: 24-hour HH:MM format; {"start":"00:00","end":"23:59"} if open 24 hours; null if unknown
- contactEmail / contactPhone: primary contact only; null if not found
- locations: max 5 entries; city-level is fine (e.g. "Mumbai", "New Delhi")
- faqs: extract ALL question-and-answer pairs you find on any page (FAQ pages, Help sections, or anywhere a question ending in ? is followed by an answer). Max 10 pairs. Empty array ONLY if no Q&A found anywhere.
- ONLY return valid JSON — no markdown, no explanation`;

  /** Single OpenAI call — returns parsed ExtractedData or throws. */
  async function callOpenAI(): Promise<ExtractedData> {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        messages:        [{ role: 'user', content: prompt }],
        temperature:     0,
        response_format: { type: 'json_object' },
        max_tokens:      2_000,
      }),
    });

    if (!resp.ok) {
      const body        = await resp.text().catch(() => '');
      const retryAfter  = resp.headers.get('retry-after');
      const isQuota     = resp.status === 429 && body.includes('insufficient_quota');
      const isRateLimit = resp.status === 429 && !isQuota;
      const err         = Object.assign(
        new Error(`OpenAI API ${resp.status}: ${body.slice(0, 200)}`),
        { status: resp.status, isQuota, isRateLimit, retryAfterSec: retryAfter ? Number(retryAfter) : 0 },
      );
      throw err;
    }

    const json = await resp.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = json.choices[0]?.message?.content;
    if (!content) throw new Error('Empty OpenAI response');
    return JSON.parse(content) as ExtractedData;
  }

  try {
    return await callOpenAI();
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;

    if (e?.isQuota) {
      // Monthly billing cap hit — no point retrying, fall back immediately
      logger.warn('OpenAI quota exhausted (insufficient_quota) — using rule-based fallback. Add credits at platform.openai.com/settings/billing.');
      return regexFallback();
    }

    if (e?.isRateLimit) {
      // Per-minute rate limit — wait for Retry-After (or 15 s default) then retry once
      const waitMs = Math.min((e.retryAfterSec || 15) * 1_000, 30_000);
      logger.warn(`OpenAI rate-limited — retrying after ${waitMs / 1_000}s`);
      await new Promise((r) => setTimeout(r, waitMs));
      try {
        return await callOpenAI();
      } catch (err2) {
        logger.warn('OpenAI retry also failed — using rule-based fallback', {
          error: err2 instanceof Error ? err2.message : String(err2),
        });
        return regexFallback();
      }
    }

    // Any other error (network, parse, etc.)
    logger.warn('OpenAI extraction failed — using rule-based fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return regexFallback();
  }
}

// ─── KB document write helpers ────────────────────────────────────────────────

/**
 * Write website_page KB documents using a safe delete-then-insertMany strategy.
 *
 * Why not upsert-per-page?
 *   Legacy docs may have sourceUrl but NO urlHash (crawled before v3). Upserting
 *   by urlHash fails to match them → MongoDB tries INSERT → E11000 on the old
 *   sourceUrl unique index. Delete-then-insert sidesteps this entirely.
 *
 * Delta counting is preserved:
 *   Old contentHashes are loaded BEFORE the delete, so we can still report
 *   ADDED / UPDATED / UNCHANGED / DELETED accurately.
 *
 * Deduplication:
 *   Pages are deduplicated by urlHash before insertion (BFS should not produce
 *   dupes, but this is a safety net).
 */
async function writeKbPageDocs(
  orgId: string,
  pages: PageData[],
): Promise<{ added: number; updated: number; unchanged: number; deleted: number }> {
  const orgObjId = new mongoose.Types.ObjectId(orgId);

  // ── Step A: Load old hashes BEFORE deleting (for delta counting) ───────────
  // Keyed by urlHash (preferred) OR normalized sourceUrl (backward compat for
  // legacy docs that have sourceUrl but no urlHash).
  const oldRaw = await KbDocumentModel.find(
    { organizationId: orgId, sourceType: 'website_page' },
    { urlHash: 1, sourceUrl: 1, contentHash: 1 },
  ).lean();

  const oldHashes = new Map<string, string>(); // key → contentHash
  for (const doc of oldRaw) {
    const key = doc.urlHash ?? (doc.sourceUrl ? normalizeUrl(doc.sourceUrl) : null);
    if (key) oldHashes.set(key, doc.contentHash ?? '');
  }
  const oldSize = oldHashes.size;

  // ── Step B: Deduplicate pages by urlHash ───────────────────────────────────
  const seen = new Set<string>();
  const uniquePages = pages.filter((p) => {
    if (seen.has(p.urlHash)) return false;
    seen.add(p.urlHash);
    return true;
  });

  // ── Step C: Count deltas ───────────────────────────────────────────────────
  let added = 0, updated = 0, unchanged = 0;
  for (const page of uniquePages) {
    // Try urlHash first, then normalized URL (backward compat)
    const oldHash = oldHashes.get(page.urlHash) ?? oldHashes.get(normalizeUrl(page.url));
    if (oldHash === undefined)              added++;
    else if (oldHash !== page.contentHash) updated++;
    else                                   unchanged++;
    // Mark as seen so we can compute deleted count
    oldHashes.delete(page.urlHash);
    oldHashes.delete(normalizeUrl(page.url));
  }
  const deleted = Math.max(0, oldSize - (added + updated + unchanged));

  // ── Step D: Delete ALL existing website_page docs — fresh slate ────────────
  await KbDocumentModel.deleteMany({ organizationId: orgObjId, sourceType: 'website_page' });

  // ── Step E: Bulk-insert all discovered pages ───────────────────────────────
  if (uniquePages.length > 0) {
    const docs = uniquePages.map((page) => {
      const titleLine = page.text.split('\n')[0] ?? 'Page';
      const title     = titleLine.replace(/^\[.*?\]\n?/, '').trim().slice(0, 300)
                        || (() => { try { return new URL(page.url).pathname; } catch { return '/'; } })();
      // Compress raw text before storage — strips boilerplate, deduplicates sentences,
      // and targets ~800-1200 chars (~200-300 tokens) instead of 50K raw chars.
      // This keeps system-prompt injection lean and reduces per-call LLM costs.
      const content   = compressPageText(page.text, page.category);
      return {
        organizationId: orgObjId,
        title,
        content,
        sourceType:     'website_page' as const,
        sourceUrl:      page.url,
        status:         'ready'        as const,
        tokenEstimate:  Math.ceil(content.length / 4),
        category:       page.category,
        categorySource: 'rule'         as const,
        urlHash:        page.urlHash,
        contentHash:    page.contentHash,
        version:        1,
      };
    });
    await KbDocumentModel.insertMany(docs, { ordered: false });
  }

  return { added, updated, unchanged, deleted };
}

// ─── Main crawl entry point ───────────────────────────────────────────────────

export async function crawlWebsite(orgId: string, websiteUrl: string): Promise<CrawlResult> {
  logger.info('Starting full-site crawl v3', { orgId, websiteUrl });

  await OrganizationModel.findByIdAndUpdate(orgId, {
    $set: { crawlStatus: 'processing', crawlError: undefined },
  });

  const result: CrawlResult = { added: 0, updated: 0, deleted: 0, unchanged: 0, failed: 0, total: 0 };

  try {
    const baseUrl = websiteUrl.replace(/\/$/, '');
    const origin  = new URL(baseUrl).origin;

    const visited = new Set<string>();

    // ── Step 1: Fetch homepage ────────────────────────────────────────────────
    const homeHtml = await fetchHtml(baseUrl);
    if (!homeHtml) {
      throw new Error('Could not reach your website. Please check the URL and try again.');
    }

    const homeText = extractText(homeHtml);
    visited.add(origin + '/');
    visited.add(baseUrl);
    visited.add(baseUrl + '/');

    // ── Step 2: Sitemap discovery ─────────────────────────────────────────────
    const sitemapUrls = await discoverUrlsFromSitemap(baseUrl);

    // ── Step 3: Seed BFS queue ────────────────────────────────────────────────
    const homeLinks  = extractLinks(homeHtml, baseUrl);
    const crawlQueue = buildCrawlQueue(sitemapUrls, homeLinks, baseUrl);

    // ── Step 4: BFS crawl ─────────────────────────────────────────────────────
    const pageData: PageData[] = [];

    // Seed with homepage (already fetched)
    if (homeText.length > 20) {
      const homepageUrl  = origin + '/';
      const normUrl      = normalizeUrl(homepageUrl);
      const urlHash      = sha256(normUrl);
      const contentHash  = sha256(homeText);
      const category     = categorizeByUrl(homepageUrl) ?? 'company-overview';

      pageData.push({
        url:         homepageUrl,
        text:        `[Homepage]\n${homeText}`,
        category,
        urlHash,
        contentHash,
      });
    }

    for (const url of crawlQueue) {
      if (visited.has(url)) continue;
      if (visited.size >= MAX_PAGES) break;

      visited.add(url);
      const html = await fetchHtml(url);
      if (!html) {
        result.failed++;
        continue;
      }

      const text = extractText(html);
      if (text.length > 50) {
        const normUrl     = normalizeUrl(url);
        const urlHash     = sha256(normUrl);
        const contentHash = sha256(text);
        const category    = categorizeByUrl(url) ?? 'other';

        pageData.push({
          url,
          text:  `[Page: ${new URL(url).pathname || '/'}]\n${text}`,
          category,
          urlHash,
          contentHash,
        });
      }

      // BFS: discover new links from this page
      const pageLinks = extractLinks(html, url);
      for (const link of pageLinks) {
        if (!visited.has(link) && !crawlQueue.includes(link)) {
          try {
            const u = new URL(link);
            if (u.origin === origin) crawlQueue.push(link);
          } catch { /* skip malformed */ }
        }
      }
    }

    result.total = pageData.length;

    logger.info('Full-site crawl complete v3', {
      orgId,
      pagesVisited:  visited.size,
      pagesWithText: pageData.length,
      textChars:     pageData.reduce((a, p) => a + p.text.length, 0),
    });

    // ── Step 5: LLM extraction ────────────────────────────────────────────────
    //
    // Prioritize structured-field category pages (FAQs, services, contact, etc.)
    // so they appear FIRST in the combined text and are not cut off at the
    // 14,000-char limit that the LLM receives.
    const structuredPages = pageData.filter((p) => STRUCTURED_FIELD_CATEGORIES.has(p.category));
    const otherPages      = pageData.filter((p) => !STRUCTURED_FIELD_CATEGORIES.has(p.category));
    const orderedTexts    = [...structuredPages, ...otherPages].map((p) => p.text);
    const combined        = orderedTexts.join('\n\n---PAGE BREAK---\n\n');
    const extracted       = await extractWithLLM(combined, websiteUrl);

    // ── Rule-based supplements ────────────────────────────────────────────────
    // Run regardless of LLM success — used to fill gaps when LLM returns empty
    // arrays, and always used when the LLM key is absent.
    const faqPageTexts     = pageData.filter((p) => p.category === 'faqs').map((p) => p.text);
    const servicePageTexts = pageData
      .filter((p) => p.category === 'services' || p.category === 'products')
      .map((p) => p.text);

    // Supplement FAQs — three-tier priority:
    //   1. LLM extraction  (highest quality, but fails when quota exhausted)
    //   2. JSON-LD schema.org FAQPage markup (exact structured data, very reliable)
    //   3. '?'-pattern text scan  (heuristic, lowest confidence)
    //
    // JSON-LD blocks are appended verbatim to page text by extractText() so they
    // are already present in pageData[].text — no extra fetch needed.
    const allPageTexts  = pageData.map((p) => p.text);
    const jsonLdFaqs    = extractFaqsFromJsonLd(allPageTexts);
    const ruleFaqs      = extractFaqsFromText(faqPageTexts.length > 0 ? faqPageTexts : allPageTexts);
    const finalFaqs     = extracted.faqs.length > 0
      ? extracted.faqs
      : jsonLdFaqs.length > 0
        ? jsonLdFaqs
        : ruleFaqs;

    // Supplement services: prefer LLM output; fall back to rule-based if LLM found none
    const ruleServices  = servicePageTexts.length > 0 ? extractServicesFromText(servicePageTexts) : [];
    const finalServices = extracted.services.length > 0 ? extracted.services : ruleServices;

    logger.info('Crawl extraction result', {
      orgId,
      llmFaqs:       extracted.faqs.length,
      jsonLdFaqs:    jsonLdFaqs.length,
      ruleFaqs:      ruleFaqs.length,
      finalFaqs:     finalFaqs.length,
      llmServices:   extracted.services.length,
      ruleServices:  ruleServices.length,
      finalServices: finalServices.length,
    });

    // ── Step 6: Persist to Organization ──────────────────────────────────────
    const update: Record<string, unknown> = {
      crawlStatus:   'completed',
      lastCrawledAt: new Date(),
    };

    if (extracted.businessDescription?.trim()) {
      update.businessDescription = extracted.businessDescription.trim();
    }
    if (Array.isArray(finalServices) && finalServices.length > 0) {
      update.services = finalServices
        .filter((s) => typeof s === 'string' && s.trim())
        .map((s) => s.trim())
        .slice(0, 10);
    }
    if (extracted.businessHours?.start && extracted.businessHours?.end) {
      const timeRe = /^\d{2}:\d{2}$/;
      if (
        timeRe.test(extracted.businessHours.start) &&
        timeRe.test(extracted.businessHours.end)
      ) {
        update.businessHours = {
          start: extracted.businessHours.start,
          end:   extracted.businessHours.end,
        };
      }
    }
    if (extracted.contactEmail || extracted.contactPhone) {
      update.contactDetails = {
        ...(extracted.contactEmail ? { email: extracted.contactEmail } : {}),
        ...(extracted.contactPhone ? { phone: extracted.contactPhone } : {}),
      };
    }
    if (Array.isArray(extracted.locations) && extracted.locations.length > 0) {
      update.locations = extracted.locations
        .filter((l) => typeof l === 'string' && l.trim())
        .map((l) => l.trim())
        .slice(0, 5);
    }
    if (Array.isArray(finalFaqs) && finalFaqs.length > 0) {
      update.faqs = finalFaqs
        .filter((f) => f?.question && f?.answer)
        .map((f) => ({
          question: String(f.question).slice(0, 200),
          answer:   String(f.answer).slice(0, 300),
        }))
        .slice(0, 10);
    }

    await OrganizationModel.findByIdAndUpdate(orgId, { $set: update });

    logger.info('Website crawl saved to org', {
      orgId,
      fieldsPopulated: Object.keys(update).filter((k) => k !== 'crawlStatus' && k !== 'lastCrawledAt'),
    });

    // ── Step 7: Write KB page docs (delta) ───────────────────────────────────
    // Exclude pages whose category maps to a structured org field — that data
    // is already stored in Step 6 and shown in the Business Info panel on the
    // KB page.  Only content-rich pages (pricing, blog, policies, …) become
    // KB documents visible in the document table.
    const kbPageData = pageData.filter(
      (p) => !STRUCTURED_FIELD_CATEGORIES.has(p.category),
    );
    const deltas = await writeKbPageDocs(orgId, kbPageData);
    result.added     = deltas.added;
    result.updated   = deltas.updated;
    result.unchanged = deltas.unchanged;
    result.deleted   = deltas.deleted;

    logger.info('KB delta applied', {
      orgId,
      added:     deltas.added,
      updated:   deltas.updated,
      unchanged: deltas.unchanged,
      deleted:   deltas.deleted,
    });

    // ── Step 8: Write one website_crawl document PER CATEGORY ────────────────
    //   Each category (faqs, services, pricing, …) gets its own KB document.
    //   All existing website_crawl docs are wiped first — they are always fully
    //   regenerated from the current crawl (delta detection only applies to
    //   website_page docs written in Step 7).
    await KbDocumentModel.deleteMany({
      organizationId: new mongoose.Types.ObjectId(orgId),
      sourceType:     'website_crawl',
    });

    if (kbPageData.length > 0) {
      const domain    = new URL(websiteUrl).hostname.replace(/^www\./, '');
      const crawlDate = new Date().toISOString().slice(0, 10);

      // Group pages by category — exclude structured-field categories (their
      // content is captured in org fields and shown in the Business Info panel,
      // not as KB documents).
      const pagesByCategory = new Map<string, PageData[]>();
      for (const page of pageData) {
        const slug = page.category || 'other';
        if (STRUCTURED_FIELD_CATEGORIES.has(slug)) continue;
        if (!pagesByCategory.has(slug)) pagesByCategory.set(slug, []);
        pagesByCategory.get(slug)!.push(page);
      }

      // Helper: look up the human-readable category name
      const categoryName = (slug: string): string =>
        KB_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;

      const categoryDocs: Array<{
        organizationId: mongoose.Types.ObjectId;
        title:          string;
        content:        string;
        sourceType:     'website_crawl';
        status:         'ready';
        tokenEstimate:  number;
        category:       string;
        categorySource: 'rule';
        contentHash:    string;
        version:        number;
      }> = [];

      for (const [slug, pages] of pagesByCategory) {
        const catLabel = categoryName(slug);

        const mdSections = pages.map(({ url, text }) => {
          const pathname = (() => { try { return new URL(url).pathname || '/'; } catch { return '/'; } })();
          const label    = pathname === '/' ? 'Homepage' : pathname;
          const body     = text.replace(/^\[.*?\]\n/, '').trim();
          return `## ${label}\n\n${body}`;
        });

        const mdContent = [
          `# ${catLabel} — ${domain}`,
          ``,
          `*${pages.length} page${pages.length !== 1 ? 's' : ''} · crawled ${crawlDate} · source: ${websiteUrl}*`,
          ``,
          `---`,
          ``,
          ...mdSections.map((s) => s + '\n\n---'),
        ].join('\n').slice(0, 50_000);

        categoryDocs.push({
          organizationId: new mongoose.Types.ObjectId(orgId),
          title:          catLabel,
          content:        mdContent,
          sourceType:     'website_crawl' as const,
          status:         'ready' as const,
          tokenEstimate:  Math.ceil(mdContent.length / 4),
          category:       slug,
          categorySource: 'rule' as const,
          contentHash:    sha256(mdContent),
          version:        1,
        });
      }

      if (categoryDocs.length > 0) {
        await KbDocumentModel.insertMany(categoryDocs);
        logger.info('KB category documents created', {
          orgId,
          domain,
          categories: categoryDocs.map((d) => d.category),
          totalPages: kbPageData.length,
          skippedStructured: pageData.length - kbPageData.length,
        });
      }
    }

    // ── Step 9: Seed categories + import FAQs + sync Vapi ─────────────────────
    await seedCategoriesForOrg(orgId);
    await importFaqsToKb(orgId);
    await syncKbToVapi(orgId);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Crawl failed unexpectedly';
    logger.error('Website crawl failed', { orgId, error: message });

    await OrganizationModel.findByIdAndUpdate(orgId, {
      $set: { crawlStatus: 'failed', crawlError: message },
    });
  }

  return result;
}
