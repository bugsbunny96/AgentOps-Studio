/**
 * Website Crawler Service
 *
 * Stack-agnostic multi-page crawler:
 *   • SSR/static sites  (WordPress, Shopify, PHP, Django, Rails) → full text via cheerio
 *   • SPAs (React, Vue, Angular)                                 → meta tags + JSON-LD fallback
 *
 * Flow:
 *   1. Fetch homepage with Node 20 native fetch
 *   2. Discover + prioritize internal links (/about, /services, /contact, /faq …)
 *   3. Crawl up to MAX_PAGES pages, collecting text
 *   4. Send combined text to GPT-4o-mini for structured extraction
 *   5. Persist extracted data → Organization document (crawlStatus = 'completed')
 */

import * as cheerio from 'cheerio';
import { OrganizationModel } from '../organization/organization.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ─── Config ──────────────────────────────────────────────────────────────────

const MAX_PAGES = 15;
const FETCH_TIMEOUT_MS = 10_000;

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
];

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

// ─── HTTP fetch with timeout + graceful errors ────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AgentOps-Crawler/1.0 (+https://agentops.studio/bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
    return null;          // timeout, DNS failure, etc. — skip gracefully
  }
}

// ─── Link extraction (same-origin, clean paths) ──────────────────────────────

function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const parsed = new URL(href, base);
      if (parsed.hostname !== base.hostname) return;         // cross-origin → skip
      const clean = parsed.origin + parsed.pathname.replace(/\/$/, '') || '/';
      seen.add(clean);
    } catch { /* malformed href */ }
  });

  return Array.from(seen);
}

// ─── Prioritise URLs ─────────────────────────────────────────────────────────

function prioritizeUrls(discovered: string[], baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin;

  const isPriority = (url: string) => {
    const path = new URL(url).pathname.toLowerCase();
    return PRIORITY_PATHS.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '-'));
  };

  const priority = discovered.filter(isPriority);
  const rest = discovered.filter((u) => !isPriority(u));

  // Homepage always first if present
  return [origin + '/', ...priority, ...rest]
    .filter((v, i, arr) => arr.indexOf(v) === i)     // deduplicate
    .slice(0, MAX_PAGES);
}

// ─── Text extraction (strips chrome, keeps content) ──────────────────────────

function extractText(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $(
    'script, style, noscript, iframe, svg, nav, header, footer, ' +
    '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
    '.nav, .navbar, .header, .footer, .sidebar, .cookie-banner, ' +
    '#nav, #header, #footer, #sidebar',
  ).remove();

  // JSON-LD structured data often contains hours, address, description — keep it
  const jsonLd: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $.html(el).replace(/<\/?script[^>]*>/g, '').trim();
    if (raw.length > 10) jsonLd.push(raw);
  });

  const title = $('title').text().trim();
  const metaDesc =
    $('meta[name="description"]').attr('content') ??
    $('meta[property="og:description"]').attr('content') ??
    '';
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 4_000);

  return [title, metaDesc, bodyText, ...jsonLd].filter(Boolean).join('\n').slice(0, 5_000);
}

// ─── GPT-4o-mini structured extraction ───────────────────────────────────────

async function extractWithLLM(
  combinedText: string,
  websiteUrl: string,
): Promise<ExtractedData> {
  // Fallback: regex-only extraction if no OpenAI key
  if (!env.OPENAI_API_KEY) {
    const emailMatch = combinedText.match(/[\w.+-]+@[\w.-]+\.\w{2,6}/);
    const phoneMatch = combinedText.match(
      /(?:\+?\d[\d\s\-().]{7,15}\d)/,
    );
    return {
      businessDescription: combinedText.slice(0, 300),
      services: [],
      locations: [],
      faqs: [],
      contactEmail: emailMatch?.[0],
      contactPhone: phoneMatch?.[0],
    };
  }

  const prompt = `You are extracting structured business information from a website's text content.

Website: ${websiteUrl}

Content (scraped from multiple pages):
${combinedText.slice(0, 14_000)}

Return a single JSON object with EXACTLY these fields:
{
  "businessDescription": "2-4 sentence description of what this business does and who it serves (50-400 chars, required)",
  "services": ["service1", "service2"],
  "businessHours": {"start": "HH:MM", "end": "HH:MM"} or null,
  "contactEmail": "email@example.com" or null,
  "contactPhone": "+91-98765-43210" or null,
  "locations": ["City, State" or "Full address"],
  "faqs": [{"question": "...", "answer": "..."}]
}

Rules:
- businessDescription: required, describe what the business actually DOES
- services: max 10 short labels (e.g. "Wedding Photography", "Tax Filing", "Home Loans")
- businessHours: 24-hour HH:MM format; null if not found on site
- contactEmail / contactPhone: primary contact only; null if not found
- locations: max 5; city-level is fine (e.g. "Mumbai", "New Delhi, India")
- faqs: max 8 Q&A pairs; keep answers under 200 chars; empty array if no FAQ section found
- ONLY return valid JSON — no markdown, no explanation`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',          // cost-effective for structured extraction
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 1_500,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`OpenAI API ${resp.status}: ${body.slice(0, 200)}`);
    }

    const json = await resp.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = json.choices[0]?.message?.content;
    if (!content) throw new Error('Empty OpenAI response');

    return JSON.parse(content) as ExtractedData;
  } catch (err) {
    logger.warn('OpenAI extraction failed — using regex fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    const emailMatch = combinedText.match(/[\w.+-]+@[\w.-]+\.\w{2,6}/);
    const phoneMatch = combinedText.match(/(?:\+?\d[\d\s\-().]{7,15}\d)/);
    return {
      businessDescription: combinedText.slice(0, 300),
      services: [],
      locations: [],
      faqs: [],
      contactEmail: emailMatch?.[0],
      contactPhone: phoneMatch?.[0],
    };
  }
}

// ─── Main crawl entry point ───────────────────────────────────────────────────

export async function crawlWebsite(orgId: string, websiteUrl: string): Promise<void> {
  logger.info('Starting website crawl', { orgId, websiteUrl });

  // Mark as processing immediately
  await OrganizationModel.findByIdAndUpdate(orgId, {
    $set: { crawlStatus: 'processing', crawlError: undefined },
  });

  try {
    const baseUrl = websiteUrl.replace(/\/$/, '');
    const visited = new Set<string>();
    const pageTexts: string[] = [];

    // ── Step 1: Fetch homepage ────────────────────────────────────────
    const homeHtml = await fetchHtml(baseUrl);
    if (!homeHtml) {
      throw new Error(
        'Could not reach your website. Please check the URL and try again.',
      );
    }

    const homeText = extractText(homeHtml);
    if (homeText.length > 20) pageTexts.push(`[Homepage]\n${homeText}`);
    visited.add(baseUrl);
    // Also mark the trailing-slash variant as visited
    visited.add(baseUrl + '/');

    // ── Step 2: Discover links + build crawl queue ────────────────────
    const discovered = extractLinks(homeHtml, baseUrl);
    const queue = prioritizeUrls(discovered, baseUrl);

    // ── Step 3: Crawl priority pages ─────────────────────────────────
    for (const url of queue) {
      if (visited.has(url)) continue;
      if (visited.size >= MAX_PAGES) break;

      visited.add(url);
      const html = await fetchHtml(url);
      if (!html) continue;

      const text = extractText(html);
      if (text.length > 50) {
        const pagePath = new URL(url).pathname || '/';
        pageTexts.push(`[Page: ${pagePath}]\n${text}`);
      }
    }

    logger.info('Crawl complete — pages visited', {
      orgId,
      pages: visited.size,
      textChars: pageTexts.join('').length,
    });

    // ── Step 4: LLM extraction ────────────────────────────────────────
    const combinedText = pageTexts.join('\n\n---PAGE BREAK---\n\n');
    const extracted = await extractWithLLM(combinedText, websiteUrl);

    // ── Step 5: Persist to Organization ──────────────────────────────
    const update: Record<string, unknown> = { crawlStatus: 'completed' };

    if (extracted.businessDescription?.trim()) {
      update.businessDescription = extracted.businessDescription.trim();
    }
    if (Array.isArray(extracted.services) && extracted.services.length > 0) {
      update.services = extracted.services
        .filter((s) => typeof s === 'string' && s.trim())
        .map((s) => s.trim())
        .slice(0, 10);
    }
    if (extracted.businessHours?.start && extracted.businessHours?.end) {
      // Validate HH:MM format before saving
      const timeRe = /^\d{2}:\d{2}$/;
      if (
        timeRe.test(extracted.businessHours.start) &&
        timeRe.test(extracted.businessHours.end)
      ) {
        update.businessHours = {
          start: extracted.businessHours.start,
          end: extracted.businessHours.end,
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
    if (Array.isArray(extracted.faqs) && extracted.faqs.length > 0) {
      update.faqs = extracted.faqs
        .filter((f) => f?.question && f?.answer)
        .map((f) => ({
          question: String(f.question).slice(0, 200),
          answer: String(f.answer).slice(0, 300),
        }))
        .slice(0, 8);
    }

    await OrganizationModel.findByIdAndUpdate(orgId, { $set: update });

    logger.info('Website crawl saved to org', {
      orgId,
      fieldsPopulated: Object.keys(update).filter((k) => k !== 'crawlStatus'),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Crawl failed unexpectedly';
    logger.error('Website crawl failed', { orgId, error: message });

    await OrganizationModel.findByIdAndUpdate(orgId, {
      $set: { crawlStatus: 'failed', crawlError: message },
    });
  }
}
