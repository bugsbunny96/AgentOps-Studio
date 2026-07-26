# Knowledge Base Crawling & Synchronization — Architecture Document

**Version**: 1.0  
**Date**: 2026-07-24  
**Author**: Engineering R&D + AI R&D (CEO Agent session)  
**Status**: Draft — Pending T1 Promotion to Sprint  
**Scope**: Onboarding crawler redesign + KB re-sync engine  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Complete Crawling Workflow](#2-complete-crawling-workflow)
3. [Content Extraction Pipeline](#3-content-extraction-pipeline)
4. [Categorization Strategy](#4-categorization-strategy)
5. [Knowledge Base Folder Structure](#5-knowledge-base-folder-structure)
6. [Database Schema](#6-database-schema)
7. [Re-sync Workflow](#7-re-sync-workflow)
8. [Versioning & Change Tracking](#8-versioning--change-tracking)
9. [API Requirements](#9-api-requirements)
10. [Validation Rules](#10-validation-rules)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. System Overview

### 1.1 Purpose

The Knowledge Base (KB) system is the data foundation of every AI Voice Agent deployed by AgentOps Studio. When a caller asks about products, pricing, hours, or policies, the voice agent answers from the KB — accuracy, completeness, and freshness of this KB directly determines call quality.

The redesigned system replaces the current single-page homepage scrape with a full-site crawler that:

- Discovers every accessible internal page.
- Extracts semantically clean content.
- Categorizes content into structured, searchable KB sections.
- Tracks deltas on every re-sync so only changed documents update.
- Stores content in a format optimized for RAG (Retrieval-Augmented Generation) and semantic search.

### 1.2 System Actors

| Actor | Role |
|---|---|
| Founder / Admin | Triggers initial crawl during onboarding; triggers re-sync from KB dashboard |
| Crawl Scheduler | BullMQ job that runs scheduled re-syncs |
| Crawler Engine | Multi-strategy page fetcher (HTTP + headless browser) |
| Extraction Pipeline | Cleans, normalizes, and chunks raw HTML |
| Categorizer | LLM + rule-based classifier; assigns pages to KB categories |
| KB Store | MongoDB collections holding structured KB documents |
| Vector Store | Embedding store (future) for semantic search and RAG |
| Voice Agent | Consumes KB at runtime; RAG lookup per caller question |

### 1.3 Crawl Triggers

| Trigger | Who | Frequency |
|---|---|---|
| Onboarding Step 2 (first crawl) | User action | Once per org creation |
| Manual re-sync | Admin from KB dashboard | On-demand |
| Scheduled re-sync | System scheduler | Configurable (default: weekly) |
| Webhook trigger (future) | CMS webhook → AgentOps endpoint | On publish event |

### 1.4 High-Level Data Flow

```
User submits website URL (onboarding Step 2)
        │
        ▼
[Crawl Job Created — BullMQ]
        │
        ├──► Phase 1: Discovery
        │         robots.txt → sitemap.xml → link graph BFS
        │
        ├──► Phase 2: Fetching
        │         HTTP (SSR/static) or Playwright (SPA) per page
        │
        ├──► Phase 3: Extraction
        │         Readability → clean text → chunk → deduplicate
        │
        ├──► Phase 4: Categorization
        │         Rule engine → LLM classifier → category assignment
        │
        ├──► Phase 5: Persistence
        │         Upsert KbDocument → version history → change log
        │
        └──► Phase 6: Embedding (future)
                  OpenAI text-embedding-3-small → vector store
```

---

## 2. Complete Crawling Workflow

### 2.1 Pre-Crawl Validation

Before any fetch begins:

1. **URL normalization**: Strip UTM parameters, fragments, trailing slashes. Resolve to canonical form.
2. **Domain extraction**: Identify the root domain (`acme.in`). All crawl URLs must share this domain (prevents crawling external links).
3. **robots.txt fetch**: `GET https://<domain>/robots.txt`. Parse `Disallow` and `Allow` rules for `User-agent: *` and `User-agent: AgentOpsBot`. Cache result for the crawl session.
4. **Sitemap discovery**: Check `/sitemap.xml`, `/sitemap_index.xml`, and any `Sitemap:` directives in robots.txt. Parse all sitemap entries as seed URLs.
5. **Reachability check**: `HEAD` request to the root URL with 5s timeout. Fail fast with a `DOMAIN_UNREACHABLE` error stored in the crawl job record.

### 2.2 Technology Detection

Determine rendering strategy before queuing pages:

| Signal | Detection Method | Strategy Assigned |
|---|---|---|
| `<meta name="generator" content="WordPress">` | HTML meta tag | HTTP (SSR) |
| `<html data-shopify-stage>` | HTML attribute | HTTP (SSR) |
| `window.__NEXT_DATA__` in source | Script tag content | HTTP (SSR — Next.js SSR mode) |
| `<div id="app"></div>` with empty body | Empty root div | Playwright (SPA) |
| `<div id="root"></div>` with empty body | Empty root div | Playwright (SPA) |
| Angular `ng-version` attribute | HTML attribute | Playwright (SPA) |
| `<script type="module">` heavy bundle | Script analysis | Playwright (SPA — Vite/Vue) |
| Default (no SPA signals) | Fallback | HTTP first; Playwright on empty body |

**Adaptive fallback**: If HTTP fetch yields `<body>` with fewer than 200 characters of visible text, automatically retry with Playwright.

### 2.3 Discovery Queue (BFS)

```
SEED URLs (sitemap + root URL)
        │
        ▼
  ┌─────────────────────────────┐
  │   DISCOVERY QUEUE (Redis)   │  ← BullMQ queue: `crawl-discovery-<orgId>`
  └─────────────────────────────┘
        │
        ▼ (worker pops URL)
  Fetch page → extract all <a href> links
        │
        ▼
  For each link:
    - Normalize URL
    - Filter: same domain? Not disallowed? Not already visited?
    - Add to visited set (Redis SET for O(1) dedup)
    - Enqueue in FETCH QUEUE
        │
        ▼
  ┌─────────────────────────────┐
  │    FETCH QUEUE (BullMQ)     │  ← `crawl-fetch-<orgId>`
  └─────────────────────────────┘
```

**Configurable limits per org tier**:

| Config Key | Default | Max |
|---|---|---|
| `maxPages` | 200 | 2000 |
| `maxDepth` | 5 | 20 |
| `concurrency` | 3 workers | 10 workers |
| `requestDelay` | 1000ms | — |
| `requestTimeout` | 15s | — |
| `maxFileSize` | 5 MB | — |

### 2.4 Page Fetching Strategies

#### Strategy A — HTTP Fetch (SSR / Static)

```
GET <url>
Headers:
  User-Agent: AgentOpsBot/1.0 (+https://agentops.studio/bot)
  Accept: text/html,application/xhtml+xml
  Accept-Language: en-IN,en;q=0.9,hi;q=0.8

Response handling:
  200 → pass to extraction
  301/302 → follow redirect (max 5 hops), record canonical URL
  403/429 → mark page BLOCKED; log and skip
  404/410 → mark page REMOVED (used in re-sync delta)
  5xx → retry ×3 with exponential backoff; mark FETCH_ERROR after exhaustion
```

#### Strategy B — Playwright (SPA / CSR)

```
Browser: Chromium (headless)
Page lifecycle:
  1. page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  2. Wait for document.readyState === 'complete'
  3. page.waitForTimeout(2000)  ← allow JS hydration
  4. page.content() → raw HTML string
  5. Extract all <a href> for discovery queue
  6. page.close()

Browser pool: max 2 concurrent Playwright instances per worker
Browser reuse: same browser instance for up to 20 pages, then restart
Memory guard: restart browser if RSS > 512 MB
```

### 2.5 URL Normalization Rules

All URLs are normalized before queueing and hashing:

1. Lowercase scheme and host.
2. Remove default ports (`:80` for http, `:443` for https).
3. Remove URL fragments (`#section-id`).
4. Remove known tracking parameters: `utm_*`, `fbclid`, `gclid`, `ref`, `source`.
5. Decode percent-encoded characters (except reserved characters).
6. Sort query parameters alphabetically (for consistent hashing).
7. Remove trailing slash from non-root paths.

**Page identity hash**: `SHA-256(normalizedUrl)` — used as the document's stable identifier across crawl sessions.

### 2.6 Crawl Session Record

Each crawl job tracks:

```
CrawlSession {
  orgId, sessionId, triggeredBy (user | scheduler | webhook)
  startedAt, completedAt, duration
  status: queued | running | completed | failed | cancelled
  stats: {
    discovered, fetched, failed, skipped,
    added, updated, deleted, unchanged
  }
  config: { maxPages, maxDepth, strategy }
  errorLog: [ { url, code, message, retryCount } ]
}
```

---

## 3. Content Extraction Pipeline

### 3.1 Raw HTML → Clean Text

**Step 1 — DOM Parse**  
Parse raw HTML into a DOM tree using a server-side HTML parser (no browser required). Use JSDOM or equivalent.

**Step 2 — Noise Removal**  
Remove the following before any text extraction:
- `<script>`, `<style>`, `<noscript>` tags
- `<nav>`, `<header>`, `<footer>` elements (and role="navigation", role="banner", role="contentinfo")
- Cookie banners: elements matching `[id*="cookie"]`, `[class*="cookie"]`, `[id*="gdpr"]`
- Chat widgets: `[id*="intercom"]`, `[id*="crisp"]`, `[id*="tawk"]`, `#hubspot-messages-iframe-container`
- Social share bars, ad containers, sidebar navigation

**Step 3 — Readability Extraction**  
Apply Mozilla Readability algorithm to the cleaned DOM. This produces:
- `title`: Page title
- `content`: Main article/body HTML
- `textContent`: Plain text
- `excerpt`: Auto-generated summary snippet
- `byline`: Author (if detected)
- `length`: Character count

**Step 4 — Structured Data Extraction (JSON-LD / Microdata)**  
Parse `<script type="application/ld+json">` blocks. Extract:
- `@type`: Page schema type (Product, FAQPage, LocalBusiness, Article, etc.)
- `name`, `description`, `telephone`, `email`, `address`, `openingHours`
- `Product.offers.price`, `AggregateRating`, `Review[]`
- `FAQPage.mainEntity[]` → direct FAQ pairs

This structured data takes precedence over extracted text for factual fields (phone, hours, price).

**Step 5 — Meta Extraction**  
Extract:
- `<title>` tag
- `<meta name="description">`
- `<meta property="og:title">`, `og:description`, `og:type`
- `<link rel="canonical">` → override URL with canonical
- `<html lang="">` → page language

**Step 6 — Image Alt Text**  
Extract `<img alt="">` attributes within main content. Alt text contributes to page keywords and product descriptions.

### 3.2 Content Chunking

Large pages must be chunked for effective RAG retrieval. Do not embed an entire 10,000-word page as one unit.

**Chunking strategy**:

1. **Semantic sections first**: Split on `<h1>`, `<h2>`, `<h3>` heading boundaries. Each heading + its following paragraphs = one chunk.
2. **Max chunk size**: 1,500 tokens (~1,100 words). Chunks exceeding this are split at paragraph boundaries.
3. **Overlap**: 200-token overlap between consecutive chunks (preserves context at boundaries).
4. **Minimum chunk size**: 50 tokens. Discard smaller fragments.
5. **Chunk metadata**: Every chunk carries `{ url, pageTitle, sectionHeading, chunkIndex, totalChunks, category }`.

**Special content chunking**:

| Content Type | Strategy |
|---|---|
| FAQ list | Each Q+A pair = one chunk |
| Product list | Each product = one chunk |
| Team members | Each person = one chunk |
| Pricing table | Each plan = one chunk |
| Address/contact | Entire contact block = one chunk (atomic) |

### 3.3 Content Deduplication

Duplicate content creates noise in RAG retrieval. Detect and handle:

**Exact duplicates**: Compare `SHA-256(normalizedText)` across all pages in the org. Second occurrence is marked `isDuplicate: true` and excluded from embeddings. Primary source is the page with the higher-authority URL (shorter path wins).

**Near-duplicates**: Compute MinHash signature of each chunk (128-bit). Compare Jaccard similarity. Threshold > 0.85 = near-duplicate. Log but store only the primary.

**Boilerplate detection**: Text that appears on more than 40% of pages (e.g., footer contact info, site-wide disclaimers) is flagged as `isBoilerplate: true`. Store once in a shared boilerplate store; reference by ID from individual pages.

### 3.4 Language Detection

Detect page language from `<html lang>`, `Content-Language` header, or ngram-based detection fallback. Tag each document with `{ language: 'en' | 'hi' | 'pa' | ... }`. Voice Agent uses language tag for appropriate TTS and STT model selection.

---

## 4. Categorization Strategy

### 4.1 Two-Phase Classification

**Phase 1 — Rule-Based Pre-Classification**

Apply deterministic rules first (fast, zero LLM cost):

| Rule | Category Assigned |
|---|---|
| URL contains `/contact`, `/reach-us`, `/get-in-touch` | Contact Information |
| URL contains `/faq`, `/frequently-asked`, `/help/faq` | FAQs |
| URL contains `/blog`, `/news`, `/article`, `/insights` | Blogs & Articles |
| URL contains `/pricing`, `/plans`, `/packages` | Pricing |
| URL contains `/team`, `/about/team`, `/our-people` | Team Members |
| URL contains `/careers`, `/jobs`, `/work-with-us` | Careers |
| URL contains `/privacy`, `/privacy-policy` | Policies |
| URL contains `/terms`, `/terms-of-service`, `/tos` | Policies |
| URL contains `/refund`, `/return-policy` | Policies |
| URL contains `/shipping` | Policies |
| URL contains `/testimonials`, `/reviews`, `/case-studies` | Reviews & Testimonials |
| URL contains `/events`, `/webinars` | Events |
| URL contains `/docs`, `/documentation`, `/api`, `/developers` | Documentation |
| URL contains `/download`, `/resources`, `/ebooks`, `/whitepapers` | Downloads & Resources |
| URL contains `/track`, `/tracking`, `/order-status` | Tracking Pages |
| URL contains `/support`, `/help-center`, `/tickets` | Support |
| URL is root (`/`) or `/about`, `/about-us`, `/who-we-are` | Company Overview |
| JSON-LD `@type: Product` present | Products |
| JSON-LD `@type: Service` present | Services |
| JSON-LD `@type: FAQPage` present | FAQs |
| JSON-LD `@type: LocalBusiness` present | Company Overview |
| Page contains `<form>` with email/phone fields | Forms |

**Phase 2 — LLM Classification (GPT-4o-mini)**

For pages that either:
- Did not match any rule in Phase 1, OR
- Matched a rule but with low confidence (ambiguous URL pattern)

Send a structured prompt to GPT-4o-mini:

```
System: You are a content classifier for a business knowledge base.
        Classify the following web page into exactly ONE category.
        
Categories: Company Overview | Products | Services | FAQs | 
            Contact Information | Business Hours | Locations | 
            Phone Numbers | Email Addresses | Team Members | 
            Pricing | Reviews & Testimonials | Blogs & Articles | 
            Policies | Careers | Forms | Support | Tracking Pages | 
            Documentation | Downloads & Resources | Events | 
            Social Media Links | Other

Rules:
- Return ONLY the category name.
- If the page clearly belongs to multiple categories, pick the MOST specific.
- If nothing fits, return "Other" and append a 3-word description.

Page URL: {url}
Page Title: {title}
First 800 chars of content: {excerpt}
Detected JSON-LD types: {schemaTypes}
```

**Cost guardrail**: Maximum 500 LLM classification calls per crawl session. Pages beyond this limit receive rule-based or "Other" classification.

### 4.2 Automated Category Creation

When the LLM returns `Other: <3-word description>` three or more times with the same description, the system auto-creates a new category:

- Category name: Capitalized 3-word description
- Category slug: kebab-case
- Category type: `auto-created`
- Flagged for admin review in the KB dashboard

### 4.3 Category Priority for Voice Agent

Not all categories are equally useful at runtime. Define a retrieval priority tier:

| Tier | Categories | Runtime Behavior |
|---|---|---|
| P1 — Always in context | Business Hours, Contact Information, Phone Numbers, Email Addresses, Locations | Pre-loaded into voice agent system prompt |
| P2 — High priority RAG | FAQs, Products, Services, Pricing | Retrieved first on any query |
| P3 — Standard RAG | Company Overview, Team Members, Reviews, Policies | Retrieved on relevant query |
| P4 — Low priority RAG | Blogs, Events, Downloads, Documentation | Retrieved only on explicit request |
| P5 — Excluded by default | Forms, Tracking Pages, Social Media Links | Not retrieved (operational, not informational) |

The voice agent system prompt is auto-generated by merging all P1 documents at agent provision time.

### 4.4 Contact Field Extraction

For pages classified as Contact Information, Phone Numbers, Email Addresses, or Business Hours, run a secondary structured extractor:

```
Extract from page content:
  phones:       [ { number, label, isWhatsApp } ]
  emails:       [ { address, label } ]
  addresses:    [ { street, city, state, pincode, country, label } ]
  businessHours:[ { day, open, close, isClosed } ]
  socialLinks:  [ { platform, url } ]
```

This structured contact data is synced back to the Organization record and made available to the voice agent as structured facts (not just text).

---

## 5. Knowledge Base Folder Structure

### 5.1 Logical KB Structure (per Organization)

```
Organization: Acme Logistics (org_abc123)
│
└── Knowledge Base
    ├── 📁 Company Overview
    │   └── 📄 About Us (source: /about — crawled: 2026-07-24)
    │
    ├── 📁 Products
    │   ├── 📄 Express Delivery (source: /products/express)
    │   ├── 📄 Bulk Freight (source: /products/bulk-freight)
    │   └── 📄 Last-Mile Solutions (source: /products/last-mile)
    │
    ├── 📁 Services
    │   ├── 📄 B2B Logistics (source: /services/b2b)
    │   └── 📄 Cold Chain (source: /services/cold-chain)
    │
    ├── 📁 FAQs
    │   ├── 📄 Delivery FAQs (source: /faq/delivery)
    │   └── 📄 Billing FAQs (source: /faq/billing)
    │
    ├── 📁 Contact Information
    │   └── 📄 Contact Us (source: /contact)
    │
    ├── 📁 Business Hours
    │   └── 📄 Operating Hours (source: /contact — extracted section)
    │
    ├── 📁 Pricing
    │   └── 📄 Rate Card (source: /pricing)
    │
    ├── 📁 Policies
    │   ├── 📄 Privacy Policy (source: /privacy-policy)
    │   └── 📄 Refund Policy (source: /refund-policy)
    │
    ├── 📁 Reviews & Testimonials
    │   └── 📄 Customer Stories (source: /testimonials)
    │
    ├── 📁 Blogs & Articles
    │   ├── 📄 Why Cold Chain Matters (source: /blog/cold-chain)
    │   └── 📄 Diwali Delivery Tips (source: /blog/diwali-tips)
    │
    └── 📁 [Auto-created categories...]
        └── ...
```

### 5.2 Document Anatomy

Each KB document has this structure:

```
KbDocument {
  ── Identity ──────────────────────────────
  id              : UUID (internal)
  urlHash         : SHA-256(normalizedUrl)
  organizationId  : ref → Organization
  categoryId      : ref → KbCategory
  
  ── Source ────────────────────────────────
  sourceUrl       : https://acme.in/about
  canonicalUrl    : https://acme.in/about  (from <link rel="canonical">)
  pageTitle       : "About Acme Logistics"
  
  ── Content ───────────────────────────────
  rawText         : full cleaned text (stored for re-sync diffing)
  contentHash     : SHA-256(rawText)  ← change detection
  excerpt         : first 300 chars
  chunks          : [ KbChunk[] ]
  
  ── Classification ────────────────────────
  category        : "Products"
  categorySource  : "rule" | "llm" | "manual"
  language        : "en" | "hi" | "pa"
  schemaTypes     : ["Product", "AggregateRating"]
  
  ── Metadata ──────────────────────────────
  keywords        : ["logistics", "express delivery", "Mumbai"]
  wordCount       : 847
  readingTimeMin  : 4
  
  ── Crawl State ───────────────────────────
  crawlSessionId  : ref → CrawlSession
  fetchStrategy   : "http" | "playwright"
  httpStatus      : 200
  crawledAt       : 2026-07-24T09:12:34Z
  
  ── Lifecycle ─────────────────────────────
  status          : "active" | "deleted" | "error"
  isDuplicate     : false
  isBoilerplate   : false
  version         : 3
  
  ── Timestamps ────────────────────────────
  firstSeenAt     : 2026-06-01T...
  lastUpdatedAt   : 2026-07-24T...
  deletedAt       : null
}
```

---

## 6. Database Schema

### 6.1 Collections Overview

```
MongoDB Database: agentops_<env>
│
├── kb_categories        — Category definitions per org
├── kb_documents         — One document per crawled page
├── kb_chunks            — Text chunks (sub-documents or separate collection)
├── kb_versions          — Full content snapshots for version history
├── kb_change_logs       — Per-field change records per sync
├── crawl_sessions       — Crawl job records
└── crawl_page_logs      — Per-page crawl attempt records
```

### 6.2 `kb_categories` Schema

```typescript
{
  _id:            ObjectId,
  organizationId: ObjectId,           // ref: Organization
  name:           string,             // "Products"
  slug:           string,             // "products"
  description:    string,
  icon:           string,             // emoji or icon key
  type:           'system' | 'auto-created' | 'manual',
  retrievalTier:  1 | 2 | 3 | 4 | 5, // P1–P5 (see §4.3)
  isActive:       boolean,
  documentCount:  number,             // denormalized counter
  createdAt:      Date,
  updatedAt:      Date,
  
  // Index: { organizationId: 1, slug: 1 } unique
}
```

**System categories seeded per org at onboarding** (20 categories — see §4.1).

### 6.3 `kb_documents` Schema

```typescript
{
  _id:              ObjectId,
  organizationId:   ObjectId,         // ref: Organization — partition key
  categoryId:       ObjectId,         // ref: kb_categories
  urlHash:          string,           // SHA-256(normalizedUrl) — stable ID
  
  // Source
  sourceUrl:        string,
  canonicalUrl:     string,
  pageTitle:        string,
  
  // Content (versioned — latest version here, history in kb_versions)
  rawText:          string,
  contentHash:      string,           // SHA-256(rawText) — change detection
  excerpt:          string,
  wordCount:        number,
  language:         string,           // BCP-47

  // Structured extracts (for contact/hours pages)
  structuredData: {
    phones?:        PhoneEntry[],
    emails?:        EmailEntry[],
    addresses?:     AddressEntry[],
    businessHours?: HoursEntry[],
    socialLinks?:   SocialEntry[],
    faqs?:          { question: string; answer: string }[],
    products?:      { name: string; description: string; price?: string }[],
  },
  
  // Classification
  category:         string,
  categorySource:   'rule' | 'llm' | 'manual',
  schemaTypes:      string[],
  keywords:         string[],
  
  // Crawl state
  crawlSessionId:   ObjectId,
  fetchStrategy:    'http' | 'playwright',
  httpStatus:       number,
  crawledAt:        Date,
  
  // Lifecycle
  status:           'active' | 'deleted' | 'error',
  isDuplicate:      boolean,
  duplicateOf?:     ObjectId,         // ref: kb_documents (primary)
  isBoilerplate:    boolean,
  version:          number,           // incremented on every content change
  
  firstSeenAt:      Date,
  lastModifiedAt:   Date,
  deletedAt?:       Date,
  
  // Embedding (future)
  embeddingModelId?: string,          // e.g. "text-embedding-3-small"
  embeddedAt?:       Date,
  
  // Indexes:
  // { organizationId: 1, urlHash: 1 }  — unique
  // { organizationId: 1, categoryId: 1, status: 1 }
  // { organizationId: 1, status: 1, crawledAt: -1 }
  // { organizationId: 1, keywords: 1 }  — text search
  // Text index: { pageTitle: 'text', rawText: 'text', keywords: 'text' }
}
```

### 6.4 `kb_chunks` Schema

```typescript
{
  _id:              ObjectId,
  organizationId:   ObjectId,
  documentId:       ObjectId,         // ref: kb_documents
  categoryId:       ObjectId,
  
  chunkIndex:       number,           // 0-based position in page
  totalChunks:      number,
  sectionHeading:   string,           // nearest <h1/h2/h3> above chunk
  text:             string,           // chunk plain text
  tokenCount:       number,
  
  // Embedding (future)
  embedding?:       number[],         // float32[] — 1536 dims for ada-002
  
  sourceUrl:        string,           // denormalized for fast retrieval
  pageTitle:        string,
  category:         string,
  language:         string,
  
  createdAt:        Date,
  updatedAt:        Date,
  isActive:         boolean,          // false when parent doc deleted/updated
  
  // Index: { organizationId: 1, documentId: 1, chunkIndex: 1 }
  // Vector index: Atlas Vector Search on `embedding` field (future)
}
```

### 6.5 `kb_versions` Schema

```typescript
{
  _id:              ObjectId,
  organizationId:   ObjectId,
  documentId:       ObjectId,         // ref: kb_documents
  version:          number,           // matches kb_documents.version at snapshot time
  
  crawlSessionId:   ObjectId,
  snapshotAt:       Date,
  
  // Full content snapshot at this version
  rawText:          string,
  contentHash:      string,
  pageTitle:        string,
  category:         string,
  wordCount:        number,
  
  // What changed from previous version
  changeType:       'created' | 'content_updated' | 'category_changed' |
                    'title_changed' | 'status_changed',
  changeSummary:    string,           // "Word count +347; new section 'Refund Policy'"
  
  // Index: { documentId: 1, version: -1 }
  // TTL: retain last 10 versions (application-level enforcement, not TTL index)
}
```

### 6.6 `kb_change_logs` Schema

```typescript
{
  _id:              ObjectId,
  organizationId:   ObjectId,
  crawlSessionId:   ObjectId,
  
  loggedAt:         Date,
  changeType:       'ADDED' | 'UPDATED' | 'DELETED' | 'UNCHANGED' |
                    'RECATEGORIZED' | 'ERROR',
  
  documentId?:      ObjectId,
  urlHash:          string,
  sourceUrl:        string,
  pageTitle:        string,
  
  // For UPDATED
  previousContentHash?: string,
  newContentHash?:      string,
  previousCategory?:    string,
  newCategory?:         string,
  diffSummary?:         string,       // "Title changed; body +1,240 chars"
  
  // For ERROR
  errorCode?:       string,
  errorMessage?:    string,
  
  // Index: { organizationId: 1, crawlSessionId: 1, changeType: 1 }
  // Index: { organizationId: 1, loggedAt: -1 }
}
```

### 6.7 `crawl_sessions` Schema

```typescript
{
  _id:              ObjectId,
  organizationId:   ObjectId,
  sessionId:        string,           // UUID — also used as BullMQ job ID prefix
  
  triggeredBy:      'user' | 'scheduler' | 'webhook' | 'api',
  triggeredByUserId?: ObjectId,
  
  targetUrl:        string,           // root URL crawled
  status:           'queued' | 'running' | 'completed' | 'failed' | 'cancelled',
  
  config: {
    maxPages:       number,
    maxDepth:       number,
    concurrency:    number,
    strategy:       'auto' | 'http' | 'playwright',
    respectRobots:  boolean,
    requestDelay:   number,
  },
  
  stats: {
    discovered:     number,
    fetched:        number,
    failed:         number,
    skipped:        number,
    added:          number,
    updated:        number,
    deleted:        number,
    unchanged:      number,
    classified:     number,
    llmCalls:       number,
  },
  
  errorLog:         CrawlPageError[],
  startedAt:        Date,
  completedAt?:     Date,
  durationMs?:      number,
  
  // Index: { organizationId: 1, status: 1, startedAt: -1 }
}
```

---

## 7. Re-sync Workflow

### 7.1 Re-sync vs. Initial Crawl

| Aspect | Initial Crawl | Re-sync |
|---|---|---|
| Starting point | No existing KB | Existing KB with N documents |
| Goal | Build KB from scratch | Apply minimal delta to keep KB current |
| Document handling | All = new (ADDED) | Diff against previous contentHash |
| Deleted detection | Not applicable | Pages absent from new crawl = DELETED |
| Duration | Longer (full crawl) | Shorter (same crawl, faster because smart skipping) |

### 7.2 Delta Detection Algorithm

```
For each page discovered in re-sync crawl:

  1. Normalize URL → compute urlHash
  2. Lookup existing KbDocument by (organizationId, urlHash)

  Case A — urlHash NOT found in KB:
    → changeType = ADDED
    → Create new KbDocument (version = 1)
    → Create kb_version snapshot
    → Log ADDED in kb_change_log

  Case B — urlHash found, contentHash UNCHANGED:
    → changeType = UNCHANGED
    → Update crawledAt only
    → Log UNCHANGED in kb_change_log (no new version created)

  Case C — urlHash found, contentHash CHANGED:
    → changeType = UPDATED
    → Compute diff (character-level or semantic)
    → Increment version
    → Update KbDocument with new content
    → Archive previous content in kb_versions
    → Re-run categorization if category might have changed
    → Invalidate existing kb_chunks; create new chunks
    → Re-queue for embedding (future)
    → Log UPDATED with diffSummary in kb_change_log

After crawl completes:

  For each KbDocument with status='active' where urlHash NOT in crawledUrls set:
    → changeType = DELETED
    → Set status = 'deleted', deletedAt = now
    → Set isActive = false on all associated kb_chunks
    → Create DELETED version snapshot
    → Log DELETED in kb_change_log
```

### 7.3 Diff Summary Generation

For UPDATED pages, generate a human-readable diff summary:

```
Tracked changes:
  - Title: "About Us" → "About Acme Logistics" [TITLE_CHANGED]
  - Word count: 540 → 847 (+307 words) [CONTENT_EXPANDED]
  - Category: Company Overview (unchanged)
  - New section detected: "Our Leadership Team" [SECTION_ADDED]
  - Phone number changed: 98765-XXXXX → 98765-YYYYY [CONTACT_CHANGED]
```

Contact field changes trigger an immediate alert in the KB dashboard (phone/email/hours changes are high-impact for voice agents).

### 7.4 Scheduled Re-sync

```
CrawlScheduler (BullMQ Repeatable Job)
  Name:     crawl-resync-scheduler
  Pattern:  0 2 * * 1        ← Every Monday at 2:00 AM IST
  
  On fire:
    1. Query all orgs with crawl enabled and onboardingStatus = COMPLETED
    2. For each org, create a CrawlSession (triggeredBy: 'scheduler')
    3. Enqueue in crawl-discovery-<orgId> queue
    4. Log in TASK-BOARD scheduled runs
    
  Org-level override: each org can set their own cron expression
  (stored in Organization.crawlSchedule)
```

### 7.5 Re-sync Notifications

| Event | Notification |
|---|---|
| Re-sync complete (changes found) | In-app notification + email summary |
| Re-sync complete (no changes) | In-app notification only |
| Contact info changed | HIGH PRIORITY in-app alert |
| >20% of KB deleted in one sync | Warning alert (possible scraper block) |
| Re-sync failed | In-app error + retry option |

---

## 8. Versioning & Change Tracking

### 8.1 Version Number Rules

- Every `KbDocument` has an integer `version` field starting at `1`.
- Version increments ONLY when `contentHash` changes (UPDATED) or status changes (DELETED).
- `UNCHANGED` pages do NOT increment version.
- Version is immutable once written — a new version always creates a new `kb_versions` document.

### 8.2 Version Retention Policy

| Tier | Versions Retained |
|---|---|
| Starter plan | 3 versions per document |
| Growth plan | 10 versions per document |
| Enterprise (future) | Unlimited (configurable) |

When retention limit is exceeded, the oldest version is deleted (application-level, not TTL index, to preserve version numbers).

### 8.3 Restore from Version

Admin can restore a document to any previous version:

```
POST /api/v1/kb/documents/:documentId/restore
Body: { targetVersion: 2 }

Action:
  1. Load kb_versions where documentId + version = targetVersion
  2. Update kb_documents with historical content/hash/category
  3. Increment version (e.g., 3 → 4, describing it as a restore)
  4. Create new kb_version snapshot with changeType: 'restored_from_v2'
  5. Re-chunk and re-embed
  6. Log in kb_change_log
```

### 8.4 Audit Trail

Every state-changing operation on KB documents is logged:

```
AuditEntry {
  timestamp:     Date,
  orgId:         ObjectId,
  actorType:     'user' | 'crawler' | 'system',
  actorId:       ObjectId | 'system',
  action:        'DOCUMENT_CREATED' | 'DOCUMENT_UPDATED' | 'DOCUMENT_DELETED' |
                 'DOCUMENT_RESTORED' | 'CATEGORY_CHANGED' | 'MANUAL_EDIT' |
                 'CRAWL_STARTED' | 'CRAWL_COMPLETED' | 'CRAWL_FAILED',
  resourceType:  'KbDocument' | 'KbCategory' | 'CrawlSession',
  resourceId:    ObjectId,
  metadata:      { before?, after?, sessionId?, version? }
}
```

---

## 9. API Requirements

### 9.1 Crawl Management APIs

```
POST   /api/v1/onboarding/crawl
       Start initial crawl. Body: { websiteUrl, config? }
       Response: { sessionId, status: 'queued', estimatedDuration }

POST   /api/v1/kb/sync
       Trigger manual re-sync.
       Response: { sessionId, status: 'queued' }

GET    /api/v1/kb/sync/status
       Current crawl session status for the org.
       Response: { session: CrawlSession, progress: { fetched, total, percent } }

GET    /api/v1/kb/sync/history
       List of past crawl sessions.
       Query: ?limit=10&status=completed
       Response: { sessions: CrawlSession[], total }

DELETE /api/v1/kb/sync/:sessionId
       Cancel a running crawl.
```

### 9.2 Knowledge Base Category APIs

```
GET    /api/v1/kb/categories
       List all categories for org.
       Response: { categories: KbCategory[] }

POST   /api/v1/kb/categories
       Create custom category.
       Body: { name, description, retrievalTier }

PATCH  /api/v1/kb/categories/:categoryId
       Update category (name, tier, isActive).

DELETE /api/v1/kb/categories/:categoryId
       Soft-delete. Documents reassigned to 'Other'.
```

### 9.3 Knowledge Base Document APIs

```
GET    /api/v1/kb/documents
       List documents for org.
       Query: ?category=Products&status=active&search=delivery&page=1&limit=20
       Response: { documents: KbDocument[], total, categories }

GET    /api/v1/kb/documents/:documentId
       Full document detail including chunks and version history.

PATCH  /api/v1/kb/documents/:documentId
       Manual edit (admin override).
       Body: { rawText?, category?, pageTitle?, keywords? }
       Creates a new version with changeType: 'manual_edit'

DELETE /api/v1/kb/documents/:documentId
       Soft-delete. Does not remove from version history.

POST   /api/v1/kb/documents/:documentId/restore
       Restore to previous version.
       Body: { targetVersion: number }

GET    /api/v1/kb/documents/:documentId/versions
       List all versions.
       Response: { versions: KbVersion[] }

GET    /api/v1/kb/change-log
       Change log for org.
       Query: ?sessionId=<id>&type=UPDATED&from=2026-07-01
       Response: { changes: KbChangeLog[], summary: { added, updated, deleted } }
```

### 9.4 Search API

```
GET    /api/v1/kb/search
       Full-text search across KB.
       Query: ?q=refund+policy&category=Policies&limit=10
       Response: { results: KbSearchResult[], total }
       
       KbSearchResult: {
         documentId, pageTitle, sourceUrl, category,
         excerpt, score, highlightedSnippet
       }

POST   /api/v1/kb/search/semantic (future)
       Vector similarity search for RAG.
       Body: { query: string, topK: 5, categories?: string[] }
       Response: { chunks: KbChunk[], scores: number[] }
```

### 9.5 Voice Agent Runtime API (internal)

```
POST   /api/v1/kb/query (internal — voice agent use only)
       RAG query from voice agent middleware.
       Body: { orgId, query, topK, categoryFilter? }
       Response: { chunks: KbChunk[], systemPromptAdditions: string }
       Auth: Internal service token (not user JWT)
```

### 9.6 API Rate Limits

| Endpoint | Limit |
|---|---|
| POST /kb/sync | 1 per org per 15 minutes |
| GET /kb/search | 60 req/min per org |
| POST /kb/search/semantic | 30 req/min per org |
| PATCH /kb/documents/:id | 10 req/min per user |

---

## 10. Validation Rules

### 10.1 Input Validation (Crawl Start)

| Field | Rule |
|---|---|
| `websiteUrl` | Required. Must be valid HTTP/HTTPS URL. No IP addresses. No localhost. No private IP ranges (10.x, 192.168.x, 172.16–31.x). |
| `websiteUrl` | Domain must resolve via DNS before crawl starts. |
| `websiteUrl` | Must not be an Anthropic, AWS, GitHub, or competitor domain (blocklist). |
| `config.maxPages` | Integer 1–2000. Default 200. |
| `config.maxDepth` | Integer 1–20. Default 5. |
| `config.requestDelay` | Integer 500–10000 ms. Default 1000 ms. |

### 10.2 Crawl Safety Rules

- Never crawl the same page URL twice in one session.
- Never follow more than 5 redirect hops.
- Never download non-HTML content types (PDF, images, video, ZIP). Log as skipped.
- Never crawl URLs matching patterns: `/logout`, `/delete`, `/admin`, `?action=delete`.
- Never send auth credentials, cookies, or session tokens to crawled sites.
- Always honor `robots.txt` `Disallow` rules.
- Respect `Crawl-delay` directive in robots.txt (override `requestDelay` if higher).
- Abort crawl if rate-limit (429) received more than 5 times in 2 minutes.

### 10.3 Content Validation

| Field | Rule |
|---|---|
| `rawText` | Must have at least 50 characters after cleaning. Shorter = skip + log. |
| `pageTitle` | Required. Max 500 chars. Empty title → use `<url path>` as fallback. |
| `category` | Must match a defined category slug for the org. |
| `contentHash` | Must be non-empty 64-char hex string. |
| `chunks` | At least 1 chunk per document. Max 200 chunks per document. |
| `chunk.text` | Min 50 chars, max 8000 chars. |
| `sourceUrl` | Must be within the org's registered domain. |

### 10.4 Re-sync Consistency Rules

- A re-sync cannot start while another session is `running` for the same org.
- A DELETED document's content must be archived in `kb_versions` before deletion.
- Version number must always be strictly increasing — never decremented or reused.
- Content hash must be recomputed and stored before comparison — never trust stale cached hash.
- Change log entries must be written before the document update commits (write-ahead log pattern).

### 10.5 Multi-Tenancy Isolation Rules

- All KB queries MUST include `organizationId` filter.
- No cross-org document access permitted at any layer.
- `organizationId` injected server-side from JWT — never from request body.
- All indexes include `organizationId` as the leading key.

---

## 11. Acceptance Criteria

### AC-001 — Full Site Discovery

```
GIVEN a business website with 50 internal pages
WHEN an initial crawl is triggered
THEN the system discovers and fetches at least 90% of internal pages
AND skips all external links
AND skips all URLs disallowed by robots.txt
AND completes within 10 minutes
```

### AC-002 — SPA Support

```
GIVEN a React/Vue/Angular single-page application website
WHEN the crawler runs in auto mode
THEN the system detects the SPA rendering pattern
AND uses Playwright to fetch page content
AND extracts body text with >200 characters per page
```

### AC-003 — Content Extraction Quality

```
GIVEN any crawled page with main body content
WHEN the extraction pipeline runs
THEN the output contains no navigation HTML
AND no cookie banner text
AND no script or style tag content
AND the extracted text matches the visible page content
```

### AC-004 — Categorization Accuracy

```
GIVEN 20 pages with known correct categories (test fixture)
WHEN the classification pipeline runs
THEN at least 16/20 pages (80%) are correctly categorized
AND all FAQPage JSON-LD pages are classified as FAQs
AND all privacy/terms URLs are classified as Policies
```

### AC-005 — KB Structure

```
GIVEN a completed crawl for an org
WHEN the KB is queried
THEN all documents are organized under categories
AND each document has: sourceUrl, crawledAt, excerpt, keywords, version
AND no document appears in more than one category
AND duplicate pages are marked and excluded from active documents
```

### AC-006 — Re-sync Delta Detection

```
GIVEN an org with 100 existing KB documents
AND a re-sync crawl that finds:
  - 5 new pages (not in KB)
  - 10 pages with changed content
  - 3 pages that no longer exist
WHEN the re-sync completes
THEN kb_change_log records: 5 ADDED, 10 UPDATED, 3 DELETED, 82 UNCHANGED
AND the 10 updated documents have incremented version numbers
AND the 3 deleted documents have status='deleted'
AND all 5 new documents have version=1
```

### AC-007 — Version History

```
GIVEN a KB document at version 3
WHEN an admin restores to version 1
THEN the document content matches the version 1 snapshot
AND a new version 4 is created with changeType='restored_from_v1'
AND the original versions 1, 2, 3 are preserved in kb_versions
```

### AC-008 — Multi-Tenancy

```
GIVEN two orgs (Org A and Org B) each with active KB documents
WHEN a user from Org A queries /api/v1/kb/documents
THEN only Org A's documents are returned
AND Org B's documents are never included in any response
AND the database query always includes organizationId = Org A
```

### AC-009 — Crawl Safety

```
GIVEN a website with robots.txt disallowing /admin/*
WHEN the crawler runs
THEN no URLs under /admin/* are fetched
AND the crawl does not hang on a single slow page (timeout = 15s)
AND the crawl does not exceed maxPages limit
AND crawl results in a completed CrawlSession record with accurate stats
```

### AC-010 — Voice Agent Integration

```
GIVEN a KB with P1-tier documents (Business Hours, Contact Information)
WHEN a voice agent is provisioned for the org
THEN the system prompt includes extracted business hours and contact info
AND a caller asking "What are your hours?" receives the correct hours
AND a caller asking "What's your phone number?" receives the correct number
```

### AC-011 — Contact Change Alert

```
GIVEN an org with Business Hours: Mon-Fri 9am-6pm
WHEN a re-sync detects the hours changed to Mon-Sat 9am-8pm
THEN the change is recorded as UPDATED with diffSummary noting the hours change
AND a HIGH PRIORITY in-app alert is sent to the org admin
AND the voice agent system prompt is regenerated with new hours
```

### AC-012 — Search

```
GIVEN an org KB with 200 documents
WHEN a search query ?q=refund is executed
THEN results are returned within 500ms
AND results are ranked by relevance
AND each result includes: title, category, excerpt, sourceUrl
```

---

## Appendix A — Technology Recommendations

| Component | Recommended | Rationale |
|---|---|---|
| HTTP Fetcher | `got` or `axios` | Mature, retry support, stream support |
| HTML Parser | `cheerio` | Fast, jQuery-like API, no headless browser overhead |
| Readability | `@mozilla/readability` | Battle-tested; same algorithm as Firefox Reader View |
| SPA Renderer | `playwright` (Chromium) | More reliable than Puppeteer; better API |
| BFS Queue | BullMQ (existing) | Already in stack; supports concurrency + delays |
| Dedup Set | Redis SET | O(1) lookup; already in stack |
| URL Fingerprint | `SHA-256` via Node `crypto` | Built-in; no dependency |
| LLM Classifier | OpenAI `gpt-4o-mini` | Low cost (~$0.00015/page); fast; structured output |
| Text Diff | `diff` npm package | Lightweight; produces human-readable diff summaries |
| robots.txt Parser | `robots-parser` | Spec-compliant; handles edge cases |
| Sitemap Parser | `sitemapper` | Handles sitemap index files; supports gzipped sitemaps |

---

## Appendix B — Performance Targets

| Metric | Target |
|---|---|
| Initial crawl (100 pages, HTTP) | < 3 minutes |
| Initial crawl (100 pages, Playwright) | < 8 minutes |
| Re-sync (200 pages, 90% unchanged) | < 5 minutes |
| Extraction + categorization per page | < 2 seconds |
| KB search query p95 latency | < 300ms |
| Semantic search p95 latency (future) | < 800ms |
| Max concurrent crawl workers per org | 3 HTTP / 2 Playwright |
| Max total concurrent crawls (system) | 20 orgs simultaneously |

---

## Appendix C — Future Enhancements (Post-MVP)

1. **Vector Embeddings + Atlas Vector Search** — `text-embedding-3-small` per chunk; semantic similarity retrieval.
2. **CMS Webhooks** — Receive publish events from WordPress, Shopify, Webflow; trigger targeted re-sync on changed page only.
3. **PDF & Document Ingestion** — Crawl and parse downloadable PDFs (product catalogs, brochures, menus) into KB.
4. **Manual KB Entry** — Admin can manually add KB entries not from the website (internal SOPs, training materials).
5. **KB Analytics** — Track which KB documents are retrieved most by voice agents; surface low-retrieval documents for review.
6. **Multilingual Chunking** — Split Hindi/Punjabi text at sentence boundaries (different tokenizer than English).
7. **Image OCR** — Extract text from infographics and menu images on the website.
8. **Competitor Monitoring** (optional) — Scheduled crawl of competitor pricing pages; alert on changes.

---

*Document ends. Next action: T1 decision — promote to sprint or continue as R&D proposal.*
