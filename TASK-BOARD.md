# AgentOps Studio — Task Board

> **Founder**: Rishabh Sharma  
> **CEO Agent**: Claude (orchestrator)  
> **Last updated**: 2026-10-01 10:15 IST (launch-readiness checklist audit → Wave 5)
> **Operating model**: All 5 agents work in parallel on every task. No idle agents.  
> **Gaps register**: `main-project-docs/gaps.md` — every task ID below links to a gap ID there  
> **Go-to-market plan**: `main-project-docs/AI-Implementation-Offer-Plan.md` — sprints after S-HARDEN  
> **Execution Framework**: `agents/EXECUTION-FRAMEWORK.md` · **SOP**: `agents/SOP.md` · **R&D Log**: `main-project-docs/RD-LOG.md`

**Version history**
- [2026-10-01 10:40] v2.3 — CEO Agent — H1.1 (SEC-01) and H1.7 (SEC-13) code done on branch `harden/h1.1-h1.7`; active task → H1.2; founder action added to configure the Vapi tool secret before merge.
- [2026-10-01 10:15] v2.2 — CEO Agent — Launch-readiness audit (20-item checklist; `gaps.md` § 12). Added H1.7 (SEC-13 public source maps), Wave 5 (launch readiness: spam, analytics, cookies, speed, SEO, contrast, mobile, polish), FE-09 consent checkbox into H4.9, founder actions for Turnstile/analytics, and PROPOSED decision D6 (agent operating system, `gaps.md` § 13). No code changed.
- [2026-09-30 10:40] v2.1 — CEO Agent — Added Upcoming Sprints (S-NICHE → S-IMPLEMENT → S-PROOF) from `AI-Implementation-Offer-Plan.md`; H4.2 pulled forward into S-HARDEN; founder decisions D1–D5 added; "pick 2–3 launch industries" replaced by one beachhead niche (GTM-01); brand palette change logged. S-HARDEN scope otherwise unchanged.
- [2026-09-29 22:57] v2.0 — CEO Agent — Rewrote the board from a full code audit. Replaced the stale 2026-07-30 sprint (L2.F2 auth tests; the "L3–L5 pending" backlog) with the as-built status, a new Launch Hardening sprint mapped to `gaps.md`, and current founder actions. Old session logs are condensed under "Completed work"; the background-lane log and decision log are kept.
- 2026-07-30 v1.x — CEO Agent — Session logs from 2026-06-22 to 2026-07-30 (see git history of this file for full text).

---

## Legend

| Symbol | Agent |
|---|---|
| 🔵 | Product Agent (CPO · PM · UX Research) |
| 🟢 | Engineering Agent (Eng Mgr · Backend · Frontend · DevOps · QA) |
| 🟠 | AI Agent (Voice · LLM · RAG · Prompts · Evals) |
| 🟡 | Growth Agent (Marketing · Demand Gen · Sales) |
| 🟣 | Customer Agent (CS · Support · Analytics) |

| Status | Meaning |
|---|---|
| ✅ | Completed & QA-passed |
| 🟡 | Built but broken, partial, or unverified |
| 🔄 | In progress |
| ⏳ | Pending / queued |
| ❌ | Blocked — needs CEO or founder resolution |
| 🔁 | Background lane (always-on task) |

---

## ⚡ Zero-Idle Rule

Every sprint task has a lead agent. Every other agent runs a supporting or background lane (🔁). No agent ever shows nothing.

---

## 🏢 Company Status — 2026-09-29 (Full Codebase Audit)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | Founder decision recorded: multi-industry SaaS, with electrical retail (Ritu Electricals) as the first vertical. Industry-template gaps filed (IND-01…05). | ✅ |
| 🟢 Engineering | Read the whole codebase (backend modules, jobs, scripts, frontend features, CI, infra). Found 12 P0 and 44 P1 gaps; top issues are the order-tool secret, unmounted org middleware, dropped call artifact and disabled workers. | ✅ |
| 🟠 AI | Prompt audit: order-safety rules never injected, a transfer tool promised but not configured, FAQs duplicated, evals at 21/23 and electrical-only. | ✅ |
| 🟡 Growth | Marketing audit: the Pricing and Billing pages advertise about 10 unbuilt features, testimonials look like placeholders, and the contact form points to a placeholder endpoint. | ✅ |
| 🟣 Customer | Customer-impact audit: monthly call minutes never reset (orgs blocked permanently), crawl never completes, the Dashboard is likely to crash once calls exist. | ✅ |

**Session deliverables**: `main-project-docs/gaps.md` v2.0 (70 gaps: 12 P0, 44 P1, 14 P2) · this board v2.0 · `CLAUDE.md` facts refreshed (stack, infra, active task).  
**No code was changed this session.**

---

## 📦 As-Built Status (2026-09-29)

| Module | Backend | Frontend | Status | Main gaps |
|---|---|---|---|---|
| Auth (register, verify, login, refresh, logout, forgot/reset, profile, change password) | `modules/auth` · 47 tests | Login, Register, Verify, Forgot, Reset, AcceptInvite | ✅ | SEC-11, TEAM-04, CORE-05 |
| Onboarding wizard (connect → learn → crawl → configure → customize → activate) | `modules/onboarding` | 6 pages + PhoneNumberPicker + TestCallWidget | 🟡 | CORE-02, CORE-09 (crawl stuck) |
| Website crawler + KB extraction | `onboarding/crawler.service.ts` (sitemap/BFS ≤50 pages, GPT-4o-mini extraction) | KnowledgeBasePage | 🟡 worker disabled | CORE-02, SEC-07, OPS-08 |
| Knowledge base CRUD + Vapi sync | `modules/knowledge-base` | KnowledgeBasePage (1,730 lines) | 🟡 docs stay `pending` | CORE-02, TEAM-02, BIZ-03 |
| Voice agent provisioning + config + voice preview | `modules/agents` (Vapi assistant, adopt/idempotent) | AgentsPage, AgentDetailPage, VoiceSelector | 🟡 | SEC-05, CORE-07, FE-06 |
| Telephony (Vobiz pool → Vapi import) | `modules/telephony` | PhoneNumberPicker (Activate) | ✅ needs prod run | SEC-06, FE-05 |
| Vapi webhook (assistant-request, business hours, minutes gate, end-of-call) | `calls/webhook.*` + callReport worker | — | 🟡 | CORE-01, CORE-03, CORE-06, CORE-08, BIZ-01 |
| Calls (list, CSV export, detail, stats, transcript search, outbound) | `modules/calls` | CallsPage, CallDetailPage/Modal, Dashboard | 🟡 | CORE-04, BIZ-06, FE-07, OPS-07 |
| Catalog + Orders (submit_order tool) | `modules/catalog`, `modules/orders` | CatalogPage, OrdersPage | 🟡 electrical-only | SEC-01, SEC-12, IND-01/02, OPS-09 |
| Analytics | `modules/analytics` | AnalyticsPage | ✅ | OPS-07 |
| Team + permissions | `modules/team` | TeamPage | 🟡 | TEAM-01…03, SEC-08 |
| Billing (Stripe checkout/portal/webhook, INR prices, trial, minutes meter) | `modules/billing` | BillingPage | 🟡 | BIZ-01…05 |
| Super-admin portal (~85 endpoints, ~30 pages) | `modules/superadmin` | `features/superadmin/*` | 🟡 | SA-01…03, SEC-02, SEC-04, SEC-10 |
| Public site (landing, pricing, blog, changelog, legal, contact) | blog/changelog/announcements APIs | `features/public/*` | 🟡 | FE-01…04, FE-08…18, SEC-13, BIZ-07 |
| Background jobs (8 queues) | `jobs/*` | Job Inspector | 🟡 only callReport runs | CORE-02, OPS-04 |
| CI/CD + hosting | `ci.yml`, `render.yaml`, `vercel.json` | — | 🟡 | OPS-01, OPS-02, OPS-05 |
| Evals | `scripts/vapi-evals` (23 cases, Ritu Electricals) | — | 🟡 21/23 locally | OPS-06, IND-03 |

---

## 🚀 Active Sprint — S-HARDEN: Launch Hardening

**Goal**: close every P0 in `gaps.md`, then the P1s that block the first paying customer (multi-industry).  
**Active task**: **H1.2 — SEC-02: rotate the super-admin password; move script credentials to env**. (H1.1 + H1.7 code done on branch `harden/h1.1-h1.7`, awaiting the Vapi tool config before merge.)

### Wave 1 — Security P0 (do first; mostly small changes)

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| H1.1 | SEC-01 | Reject missing, mismatched or wrong-length `x-webhook-secret`; configure the header on the Vapi tool; add tests | 🟢 | 🟡 code + 10 tests done (branch `harden/h1.1-h1.7`); fails closed, accepts `x-webhook-secret` or `x-vapi-secret`. **Deploy blocked** until the Vapi tool sends the secret (Founder Actions) |
| H1.2 | SEC-02 | Rotate the super-admin password; move script credentials to env or a prompt | 🟢 + Founder | ⏳ |
| H1.3 | SEC-03 | Rotate the Redis password; strip the `.env` comment; delete `.env.bak` | Founder | ⏳ |
| H1.4 | SEC-04 | Make `SA_JWT_SECRET` required in production; confirm it is set on Render | 🟢 | ⏳ |
| H1.5 | SEC-05 | Mount `validateOrganization` + `attachEffectivePlan` + role/permission checks on all org routes; honour `X-Organization-ID` | 🟢 | ⏳ |
| H1.6 | SEC-06 | Phone-number link: uniqueness + ownership check, Owner-only; retire manual UUID entry | 🟢 | ⏳ |
| H1.7 | SEC-13 | Stop publishing source maps: `sourcemap: 'hidden'` + Sentry upload in CI; verify no `.map` is served | 🟢 | ✅ code done (same branch): build leaves 0 `.map` files; Sentry uploads then deletes when `SENTRY_AUTH_TOKEN` is set |

### Wave 2 — Core flow P0

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| H2.1 | CORE-01 | Pass `artifact` into the call-report job; webhook test | 🟢 + 🟠 | ⏳ |
| H2.2 | BIZ-01 | Minutes gate + billing status respect the month boundary | 🟢 | ⏳ |
| H2.3 | CORE-03 | Exclude Vapi webhook and tool routes from the global rate limiter | 🟢 | ⏳ |
| H2.4 | CORE-04 | Fix Dashboard response unwrapping (`/agents`, `/calls`) | 🟢 | ⏳ |
| H2.5 | CORE-05 | Verify production login; add a custom domain or a Vercel `/api` rewrite | 🟢 + Founder | ⏳ |
| H2.6 | CORE-02 | Consolidate worker Redis connections, or upgrade Redis; re-enable crawl → kb → callMinutesReset → followUpAlert → trial jobs | 🟢 | ⏳ |

### Wave 3 — Multi-industry foundation (P1)

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| H3.1 | IND-02, IND-05 | Design an industry-template contract (catalog on/off, tools, structured-output schema, prompt block, nav modules). Build the first template for the **beachhead niche only** (GTM-01) | 🔵 + 🟠 | ⏳ (moves to S-NICHE) |
| H3.2 | IND-01 | Generic catalog (free-form categories); seed per template on org creation | 🟢 | ⏳ |
| H3.3 | IND-02, INT-03 | Appointment/booking tool — only if the beachhead niche books appointments (see S-IMPLEMENT I3) | 🟢 + 🟠 | ⏳ (moves to S-IMPLEMENT) |
| H3.4 | IND-03, OPS-06 | Per-industry prompt blocks + eval sets (EN/HI/PA); fix `price-04` and `order-04` | 🟠 | ⏳ |
| H3.5 | CORE-07 | Inject order-safety rules; add or remove the transfer tool | 🟠 | ⏳ |
| H3.6 | IND-04 | Parameterise or move the Ritu-specific scripts; fix the broken ones | 🟢 | ⏳ |

### Wave 4 — Launch P1 (billing, team, site, CI)

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| H4.1 | BIZ-02, BIZ-03 | Single `getEffectivePlan(org)` (trial = Basic; override + expiry) used everywhere | 🟢 | ⏳ |
| H4.2 | BIZ-04, BIZ-07 | Align plan numbers with the pricing doc; mark unbuilt features "coming soon" (WhatsApp, Sheets, CRM, n8n, booking, reports) | 🔵 + 🟡 | ⏳ ⚡ pull forward — do in S-HARDEN (refund/trust risk) |
| H4.3 | BIZ-05 | Stripe `invoice.payment_failed` handling + event idempotency | 🟢 | ⏳ |
| H4.4 | BIZ-06 | Gate outbound calls (trial, quota, role) | 🟢 | ⏳ |
| H4.5 | TEAM-01…04 | Invite permissions, backend permission parity, route guards, per-session refresh tokens | 🟢 | ⏳ |
| H4.6 | SA-01, SA-02 | Fix broadcast and transfer-ownership queries; wire or hide unused super-admin features | 🟢 | ⏳ |
| H4.7 | SEC-07…12 | Remaining security P1s (SSRF, access-log membership, email escaping, SA rate limit, auth hardening, order fallback) | 🟢 | ⏳ |
| H4.8 | CORE-06, 08, 09 | `status-update` handling, real transcript timestamps, crawl-poll timeout | 🟢 | ⏳ |
| H4.9 | FE-01…03, FE-09 | Contact form endpoint, real testimonials, legal placeholders; required Terms/Privacy consent checkbox at signup + `termsAcceptedAt` | 🟡 + 🟢 + Founder | ⏳ |
| H4.10 | OPS-01…03 | Remove the ECS deploy workflow; fix CI e2e; add webhook, orders and minutes tests | 🟢 | ⏳ |

### Wave 5 — Launch readiness (site, legal, SEO, performance) — from the 2026-10-01 checklist audit

Mostly frontend; can run in parallel with Waves 1–2. Checklist status: `gaps.md` § 12.

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| H5.1 | FE-10 | Cloudflare Turnstile on Register + Contact, verified on the backend | 🟢 | ⏳ |
| H5.2 | FE-11, FE-12 | Cookieless analytics (Plausible or Vercel) + funnel events (`signup`, `email_verified`, `onboarding_complete`, `first_call`); align cookie banner + Privacy Policy with Sentry Replay | 🟢 + 🟣 | ⏳ |
| H5.3 | FE-13 | Defer Sentry init + lazy Replay; Vapi SDK only on test-call pages; Lighthouse baseline (mobile ≥ 90, LCP < 2.5 s) on `/`, `/pricing`, `/register` | 🟢 | ⏳ |
| H5.4 | FE-14 | Per-route `<title>`/`<meta>` (React 19 native) for public pages and blog posts | 🟢 + 🟡 | ⏳ |
| H5.5 | FE-15 | Site URL from one env var; generated sitemap (blog posts, `lastmod`, no `/login`); fix `og:url`/robots — after CORE-05 custom domain | 🟢 | ⏳ |
| H5.6 | FE-16 | Replace the ~16 failing grey text colours with AA-passing tokens | 🟢 | ⏳ |
| H5.7 | FE-17 | Responsive grids (`auto-fit`) + 375 px pass on Dashboard, Calls, Billing, Onboarding, Pricing, Register | 🟢 + 🟣 | ⏳ |
| H5.8 | FE-18, FE-08 | PNG favicon + manifest, CSP in `vercel.json`, `noindex` on 404, blog cover alt, footer social links, delete `files.zip` | 🟢 | ⏳ |

### Supporting lanes this sprint (zero-idle)

| Agent | Supporting / background lane |
|---|---|
| 🔵 Product | Score candidate niches and recommend one beachhead (GTM-01, plan § 7.1); acceptance criteria for H3.1 |
| 🟢 Engineering | Lead on Waves 1, 2 and 4 |
| 🟠 AI | Prompt + eval work (H3.4, H3.5); verify structured output after H2.1 |
| 🟡 Growth | Pricing and feature-claim cleanup (H4.2); real testimonials from beta users; per-page titles/descriptions copy (H5.4); define funnel events (H5.2) |
| 🟣 Customer | Beta onboarding checklist; watch minutes-gate and crawl failures once fixed; 375 px mobile QA (H5.7) |

---

## 🗺️ Upcoming Sprints (after S-HARDEN) — PROPOSED

Source and full specs: `main-project-docs/AI-Implementation-Offer-Plan.md`. Gap IDs: `gaps.md` § 11. Start only when S-HARDEN has 0 open P0s. Requires founder decisions D1 + D2 (see Founder Actions).

### S-NICHE — one beachhead niche, ready to sell

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| N1 | GTM-01 | Score candidate niches (plan § 7.1); founder picks one (D2); log in Decision Log | 🔵 + 🟡 + Founder | ⏳ |
| N2 | IND-02, IND-05 | Industry-template contract (was H3.1) | 🔵 + 🟠 | ⏳ |
| N3 | IND-01, IND-03 | Beachhead template: prompt block, tools, structured-output schema, nav modules, ≥10 evals (EN/HI/PA) | 🟠 + 🟢 | ⏳ |
| N4 | GTM-01 | Align Industries + landing copy to the beachhead niche | 🟡 | ⏳ |

### S-IMPLEMENT — connect the client's tools (n8n)

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| I1 | INT-01 | `integrations` module: per-org signed webhooks, `webhook-delivery` queue (on consolidated worker), retries, delivery log, Settings → Integrations UI, test event | 🟢 | ⏳ |
| I2 | INT-02 | n8n templates: Google Sheets, CRM (per D5), Google Calendar + setup guide | 🟢 + contractor | ⏳ |
| I3 | INT-03 | `book_appointment` tool (only if the niche books appointments) | 🟢 + 🟠 | ⏳ |
| I4 | INT-04 | Follow-up: worker on, escaped content, `followup.required` event | 🟢 | ⏳ |

### S-PROOF — sell and prove

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| P1 | ROI-01 | ROI dashboard card + monthly results email | 🟢 + 🟣 | ⏳ |
| P2 | OFR-01, BIZ-05 | Billable setup fee; managed-service tier (per D3) | 🟢 + Founder | ⏳ |
| P3 | OFR-02 | `Client-Delivery-SOP.md` | 🔵 + 🟣 | ⏳ |
| P4 | GTM-02 | Demo org + public demo number on the beachhead template | 🟠 + 🟡 | ⏳ |
| P5 | GTM-03 | 30-day first-client plan: prospect list, outreach, discovery questions | 🟡 + Founder | ⏳ |

**Exit goal**: 3 paying clients in the beachhead niche, each with a monthly ROI report.  
**Not before S-PROOF exits**: native CRM connectors, a second niche, new super-admin features.

---

## 👤 Founder Actions (current)

| Priority | Action | Why |
|---|---|---|
| 🔴 P0 | **Before merging `harden/h1.1-h1.7`**: in the Vapi dashboard, open the `submit_order` tool → Server → set **Secret** to the same value as `VAPI_TOOL_WEBHOOK_SECRET` (Vapi then sends `x-vapi-secret`), and confirm that variable is set on Render. Otherwise every order tool call returns 401 after deploy. Then place one test order by phone | SEC-01 |
| 🔴 P0 | Rotate the **super-admin password** (it is committed in `backend/scripts/*super-admin*.js`) | SEC-02 |
| 🔴 P0 | Rotate the **Redis Cloud password**; remove the commented URL from `backend/.env`; delete `backend/.env.bak` | SEC-03 |
| 🔴 P0 | Confirm `SA_JWT_SECRET`, `VAPI_WEBHOOK_SECRET` and `VAPI_TOOL_WEBHOOK_SECRET` are set on Render | SEC-01, SEC-04 |
| 🔴 P0 | Log in on the production Vercel URL and confirm the dashboard loads (cross-site cookie check) | CORE-05 |
| 🟡 P1 | Decide: paid Redis plan, or approve worker consolidation work | CORE-02, OPS-04 |
| 🟡 P1 | **D1**: approve the go-to-market model — AgentOps Studio platform + managed "AI implementation" offer (setup fee + monthly plan) | `AI-Implementation-Offer-Plan.md` § 4 |
| 🟡 P1 | **D2**: pick **one** beachhead niche (replaces "choose 2–3 launch industries"); default = electrical/hardware retail | GTM-01 |
| 🟡 P1 | Fill in the legal-page placeholders (entity, address, GSTIN, grievance officer); advocate review | FE-03 |
| 🟡 P1 | Stripe: INR prices for all 3 plans (incl. `STRIPE_PRO_PRICE_ID_INR`), activate the customer portal | BIZ-05 |
| 🟢 P2 | **D3–D5**: managed service in Pro or paid add-on; which plans get webhooks/n8n; first CRM for templates | Plan § 8 |
| 🟢 P2 | Formspree form ID (or approve a backend contact endpoint); real testimonials | FE-01, FE-02 |
| 🟢 P2 | Set `VITE_SENTRY_DSN` in production; UptimeRobot on `/api/v1/health` | Monitoring |
| 🟢 P2 | Update `CLIENT_URL` in `render.yaml` / Render to the real Vercel URL | OPS-05 |
| 🟡 P1 | Create a Cloudflare Turnstile site (site key + secret) for Register and Contact | FE-10 |
| 🟡 P1 | Pick the analytics tool: Plausible (paid, cookieless) or Vercel Web Analytics; decide whether Sentry Replay stays on public pages | FE-11, FE-12 |
| 🟢 P2 | **D6**: approve converting the 5 agents to Claude Code subagents + adding 3–4 specialists (AppSec, code reviewer) with chained handoffs instead of all-agents-every-turn | `gaps.md` § 13 |

---

## ✅ Completed Work (condensed history)

| Date | Milestone | Key deliverables |
|---|---|---|
| 2026-06-16 → 06-26 | Layer 1 foundation + L2 auth | Express/TS/Mongo/Redis/BullMQ skeleton; React 19/Vite/Tailwind 4 shell; guards; Docker; CI; 8 auth endpoints |
| 2026-06-26 | L2.F3–F4 onboarding | `POST/PATCH /onboarding/org`, `/complete`; 5-step wizard |
| 2026-07-04 → 07-09 | Voice routing + calls UI | assistant-request handler, business hours gate, phone-number link, CallDetailPage polish |
| 2026-07-06 → 07-26 | Agents, crawler, KB, billing, team | Vapi provisioning, crawler, KB system, Stripe checkout, team invites, call detail modal |
| 2026-07-29 → 07-30 | Billing + trust | INR prices, call-minutes quota, customer portal, Terms/Privacy, Sentry, `/api/v1/health`, transcript full-text search (backend) |
| 2026-09-15 → 09-16 | POC integration (electrical shop) | Catalog, Orders + `submit_order` tool, structured output, Vobiz, super-admin portal, public site, trials, Render deploy, Redis connection fixes (7 workers disabled) |
| 2026-09-17 → 09-18 | Polish | Analytics + Catalog pages, 47/47 auth tests, TS build fixes for Vercel, Basic/Standard/Pro pricing (₹9,999 / ₹17,999 / ₹25,999) |
| 2026-09-30 | Brand palette + dark theme (uncommitted) | "Tiffany × Dark Gray" (#21F1A8 on #171717) applied across ~104 frontend files: `brand` scale = mint, `slate` = neutral grays, new `surface`/`surface-2` tokens; all light pages converted to dark; Super Admin red/purple brand → Tiffany (red kept for danger); logos/favicons recoloured. Typecheck + build pass |
| 2026-09-29 | Telephony + evals | Vobiz number picker, Render keep-alive, Sarvam TTS bridge removed, 23 Vapi evals (21/23 local) |

### Original WBS layers — status

| Layer | Plan | Status |
|---|---|---|
| L1 Platform foundation | Backend + frontend skeleton, CI | ✅ (deploy workflow targets ECS; see OPS-01) |
| L2 Identity & onboarding | Auth, org, wizard, KB, team, test call | 🟡 built; crawl/KB workers off |
| L3 Voice AI infrastructure | Vapi, Vobiz, voice config, business hours, multilingual | 🟡 built; webhook and security gaps |
| L4 Intelligence pipeline | Call logs, transcripts, summaries | 🟡 built; structured output dropped (CORE-01) |
| L5 Observability & launch | Analytics, audit logs, settings, prod deploy, KPIs | 🟡 analytics, super-admin audit, Sentry done; prod runs on Render free, not ECS |

---

## Background Lane Log (always-on work per session)

| Date | Agent | Background Task | Output |
|---|---|---|---|
| 2026-06-24 | 🔵 Product | Auth AC completeness review | All auth ACs verified testable |
| 2026-06-24 | 🟠 AI | Prompt audit — no prompts exist yet | Documented: v1.0.0 to be written in T3.3 |
| 2026-06-24 | 🟡 Growth | ICP doc review | ICP confirmed: India B2B, 10-200 employees, high call volume |
| 2026-06-24 | 🟣 Customer | KPI baseline | Pre-launch: no tenant data yet; baseline set for post-launch tracking |
| 2026-06-26 | 🟠 AI | R&D: Vapi SDK + RAG options | ADR-001: MongoDB Atlas Vector Search selected → RD-LOG.md |
| 2026-06-26 | 🟠 AI | R&D: GPT-4o vs alternatives | GPT-4o default; GPT-4o-mini as cost option → RD-LOG.md |
| 2026-06-26 | 🟠 AI | R&D: Multilingual TTS | Sarvam AI backlogged for Hindi/Punjabi → RD-LOG.md |
| 2026-06-26 | 🟡 Growth | R&D: Competitor analysis | Bland/Retell/Synthflow/Sarvam — Indian lang gap is our moat → RD-LOG.md |
| 2026-06-26 | 🟡 Growth | R&D: India B2B pricing | Pricing tiers recommended to CEO → RD-LOG.md |
| 2026-06-26 | 🟣 Customer | R&D: Launch KPI framework | 6 metrics defined, TTFV <30 min target set → RD-LOG.md |
| 2026-06-26 | 🟢 Engineering | R&D: Security scan + TODO audit | CSRF gap found (backlogged L5), all TODOs mapped → RD-LOG.md |
| 2026-06-26 | 🟢 Engineering | L2.F2.M3: auth-flow.spec.ts (8 E2E tests) + rate-limiter mock review | ✅ Written |
| 2026-06-26 | 🔵 Product | L2.F3 org creation notes + open questions for founder | ✅ Written → session-notes/L2F3-org-creation-backend-notes.md |
| 2026-06-26 | 🟠 AI | Vapi provisioning gate decision: org creation NOT the trigger | ✅ Documented |
| 2026-06-26 | 🟡 Growth | ConnectPage UX inputs (industry list, timezone) → L2F3 notes §11 | ✅ Background |
| 2026-06-26 | 🟣 Customer | Org creation = first activation milestone; health score gate | ✅ Background |

---

## Decision Log

| Date | Decision | Owner | Rationale |
|---|---|---|---|
| 2026-10-01 | Launch-readiness checklist audit: 9/20 covered, 9 partial, 2 missing (page speed, analytics). Added S-HARDEN Wave 5 + H1.7 | CEO Agent | Gaps SEC-13, FE-09…18 (`gaps.md` § 12) |
| 2026-10-01 | **PROPOSED (D6)**: real Claude Code subagents + 3–4 Agency specialists, chained per task type; retire the zero-idle rule | CEO Agent → Founder (T0) | Agent files are not loadable as subagents; 11-agent dispatch costs more than it returns (`gaps.md` § 13) |
| 2026-09-30 | **PROPOSED (awaiting D1/D2)**: go to market as platform + managed "AI implementation" offer for one beachhead niche; sprints S-NICHE → S-IMPLEMENT → S-PROOF after S-HARDEN | CEO Agent → Founder (T0) | Product already solves missed calls; clients pay for the problem handled; follow-up, booking, CRM/calendar via n8n and ROI proof are missing (`gaps.md` § 11) |
| 2026-09-30 | Brand palette = "Tiffany × Dark Gray" (#21F1A8 / #171717), dark-first UI across the app | Founder | Chosen from 3 shortlisted combos (design.deb Color Combo Part 09) |
| 2026-09-29 | Product is a **multi-industry SaaS**; electrical retail (Ritu Electricals) is the first vertical, generalised via industry templates | Founder (T0) | Catalog, orders, prompt and evals are electrical-only today; industry templates avoid a rewrite per vertical |
| 2026-09-29 | Docs policy for living docs: rewrite stale sections in place + dated version line (instead of strict append-only) | Founder | Stale content was misleading every session (ECS, ElevenLabs, old active task) |
| 2026-09-29 | Keep the 11-agent CEO framework in CLAUDE.md; refresh facts only | Founder | Operating model unchanged |
| 2026-09-29 | Next sprint = S-HARDEN (close all P0s in gaps.md before new features) | CEO Agent | 12 P0s include order injection, credential exposure and permanent minute blocking |
| 2026-09-17 | Pricing finalised: Basic ₹9,999 / Standard ₹17,999 / Pro ₹25,999 per month + GST, 7-day trial with 30 min (supersedes the 2026-06-26 recommendation) | Founder (T0) | Source: `main-project-docs/AgentOps Studio — SaaS Pricing & Stripe Setup.md` |
| 2026-06-26 | Multi-layer WBS (Atomic Task system) adopted | CEO Agent | Keeps each AI query focused; prevents context bloat; compounds across sessions |
| 2026-06-26 | SOP.md + EXECUTION-FRAMEWORK.md created | CEO Agent | Scalable operating system for solo founder + AI org |
| 2026-06-26 | ADR-001: MongoDB Atlas Vector Search for RAG | 🟠 AI | No extra infra; India region; cosine similarity native |
| 2026-06-26 | GPT-4o as default LLM for voice agents | 🟠 AI | Best latency/quality balance for conversational AI |
| 2026-06-26 | Indian language support = primary differentiator | 🟡 Growth | No competitor offers EN+HI+PA in self-serve SMB platform |
| 2026-06-26 | Pricing recommendation: 3-tier ₹9,999/₹24,999/₹59,999/mo | 🟡 Growth | Escalated to CEO → T0 decision for founder to approve |
| 2026-06-24 | All-5 parallel dispatch on every query; zero-idle rule enforced | CEO Agent | Maximizes throughput; every agent compounds value every session |
| 2026-06-24 | Background lanes defined per agent; no empty task slots | CEO Agent | Prevents context loss; agents always advancing their domain |
| 2026-06-22 | Rate limiter scoped to login/register/forgot/reset only | 🟢 Engineering | /me and /refresh on every page load; broad rate limit caused false 429s |
| 2026-06-22 | Axios interceptor: removed window.location.href from 401 catch | 🟢 Engineering | Hard redirects caused infinite reload loop; React Router guards handle nav |
| 2026-06-22 | Resend dev fallback: logs token URL to console when domain unverified | 🟢 Engineering | Allows local testing without verified Resend domain |

---

