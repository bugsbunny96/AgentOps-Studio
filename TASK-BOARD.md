# AgentOps Studio — Task Board

> **Founder**: Rishabh Sharma  
> **CEO Agent**: Claude (orchestrator)  
> **Last updated**: 2026-10-08 11:45 IST (Pricing v2 built on branch `feat/pricing-v2`, not committed; Waves 1–3 + cost reduction merged and deployed)
> **Operating model**: All 5 agents work in parallel on every task. No idle agents.  
> **Gaps register**: `main-project-docs/gaps.md` — every task ID below links to a gap ID there  
> **Go-to-market plan**: `main-project-docs/AI-Implementation-Offer-Plan.md` — sprints after S-HARDEN  
> **Execution Framework**: `agents/EXECUTION-FRAMEWORK.md` · **SOP**: `agents/SOP.md` · **R&D Log**: `main-project-docs/RD-LOG.md`

**Version history**
- [2026-10-08 11:45] v3.1 — CEO Agent — Pricing v2 (founder request): new Wave 7 (P1–P8) built on local branch `feat/pricing-v2` (from `main`, uncommitted): Starter ₹4,999 plan, Pro ₹29,999 / 1,500 min, annual billing, setup fees, prepaid top-up packs, per-plan simultaneous-call limit, fallback-number transfer, 80/100% usage emails; Pricing/Billing/landing/Terms/super-admin updated; H4.2 pricing-page claims done. Backend + frontend `tsc` clean, frontend 36/36 tests + build OK, 11 pure pricing tests + 82 non-DB backend tests pass; 20 DB-backed pricing tests written but not run (no MongoDB binary in the sandbox) → run `npm test` before merge.
- [2026-10-08 10:30] v3.0 — CEO Agent — Status refresh from git: Waves 1, 1b, 1c, 2, 3 and `feat/cost-reduction` are merged to `dev` and `main` (PRs #6–#15; Render/Vercel auto-deploy). Founder confirmed: Vapi tool secret set, Render secrets set, test phone order placed → SEC-01, SEC-04 closed. Added `scripts/create-premium-voice-prices.ts` (C7). Active task → production verification, then H4.2. Typecheck clean (backend + frontend); frontend tests 36/36 (AuthGuard/GuestGuard fixed in wave 1b).
- [2026-10-02 18:10] v2.9 — CEO Agent — Wave 3 on `harden/wave3`: CORE-05 (Vercel /api rewrite), CORE-02 (shared worker client, all 8 workers + schedules on), SEC-07 (SSRF-safe crawler). Decisions: stay on Render + free Redis.
- [2026-10-02 17:30] v2.8 — CEO Agent — Incident: SEC-12 single-org fallback overwrote Ritu's `vapiAssistantId` (restored). Wave 1: SEC-12 (`harden/wave1`), CI/OPS-01…03 + SEC-04 + SEC-02 (`harden/wave1b`), SEC-05 + SEC-06 (`harden/wave1c`).
- [2026-10-02 16:20] v2.7 — CEO Agent — Wave 2: H2.1–H2.4 code done on `harden/wave2` (branched from `feat/cost-reduction`); both branches committed locally, not pushed. Pre-existing failures: frontend AuthGuard + GuestGuard tests.
- [2026-10-02 16:10] v2.6 — CEO Agent — Premium Voices add-on (founder decision: Pro free; ₹2,999 Basic / ₹4,999 Standard) built as C7; tool safety net C8; founder action to create the Stripe add-on prices.
- [2026-10-02 09:50] v2.5 — CEO Agent — Cost reduction (founder request, steps 1–4): new S-HARDEN Wave 6 (C1–C6, `gaps.md` § 14) — code done on branch `feat/cost-reduction`; founder actions added for evals + live model switch; decision log updated (GPT-4o → GPT-4o-mini default, PROPOSED).
- [2026-10-01 11:05] v2.4 — CEO Agent — Design review (FE-19…FE-24, `gaps.md` § 12.1) → Wave 5 tasks H5.9–H5.14. H5.9 (remove false claims) landing part done on `dev`.
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
**P0 status (2026-10-08)**: every P0 is fixed in code and deployed from `main`. Still open: **SEC-03** (founder: rotate Redis password, remove the Redis URL comment in `backend/.env`) and three live checks below.  
**Active task**: **Production verification** — H2.5 (log in on the Vercel URL), H2.6 (crawl a site, a KB doc reaches `ready`, Redis < 30 connections), H2.1 (structured output on the next live call). **Then H4.2** (pricing claims, refund risk) and the rest of Wave 4.

### Wave 1 — Security P0 (do first; mostly small changes)

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| H1.1 | SEC-01 | Reject missing, mismatched or wrong-length `x-webhook-secret`; configure the header on the Vapi tool; add tests | 🟢 | ✅ deployed (`main`, PR #13); Vapi tool secret set + test phone order placed 2026-10-08 |
| H1.2 | SEC-02 | Rotate the super-admin password; move script credentials to env or a prompt | 🟢 + Founder | ✅ scripts read env/hidden prompt (PR #11); password rotated 2026-10-02. Optional: purge git history |
| H1.3 | SEC-03 | Rotate the Redis password; strip the `.env` comment; delete `.env.bak` | Founder | ⏳ `.env.bak` deleted; Redis URL still in a comment in `backend/.env` (lines 68–69); password rotation not confirmed |
| H1.4 | SEC-04 | Make `SA_JWT_SECRET` required in production; confirm it is set on Render | 🟢 | ✅ deployed (PR #11); `SA_JWT_SECRET` confirmed on Render 2026-10-08 |
| H1.5 | SEC-05 | Mount `validateOrganization` + `attachEffectivePlan` + role/permission checks on all org routes; honour `X-Organization-ID` | 🟢 | ✅ deployed (PR #12): `orgContext` + `requireOwner`/`requirePermission` on every org router; `attachEffectivePlan` → H4.1 |
| H1.6 | SEC-06 | Phone-number link: uniqueness + ownership check, Owner-only; retire manual UUID entry | 🟢 | 🟡 deployed (PR #12): Owner-only, UUID format, 409 if held by another org. Manual UUID entry in Settings not yet retired |
| H1.7 | SEC-13 | Stop publishing source maps: `sourcemap: 'hidden'` + Sentry upload in CI; verify no `.map` is served | 🟢 | ✅ code merged to `dev` (PR #6): build leaves 0 `.map` files; Sentry uploads then deletes when `SENTRY_AUTH_TOKEN` is set |

### Wave 2 — Core flow P0

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| H2.1 | CORE-01 | Pass `artifact` into the call-report job; webhook test | 🟢 + 🟠 | 🟡 deployed (PR #8): artifact, `costBreakdown`, `call.cost` passed to the job. Verify structured output on the next live call |
| H2.2 | BIZ-01 | Minutes gate + billing status respect the month boundary | 🟢 | ✅ deployed (PR #8): `utils/callMinutes.ts` + gate tests |
| H2.3 | CORE-03 | Exclude Vapi webhook and tool routes from the global rate limiter | 🟢 | ✅ deployed (PR #8): `middleware/rateLimitExempt.ts` + tests |
| H2.4 | CORE-04 | Fix Dashboard response unwrapping (`/agents`, `/calls`) | 🟢 | ✅ deployed (PR #8): `utils/unwrapList.ts` + frontend test |
| H2.5 | CORE-05 | Verify production login; add a custom domain or a Vercel `/api` rewrite | 🟢 + Founder | 🟡 deployed (PR #14/#15): Vercel `/api` rewrite, trust proxy 2, per-account auth limit. **Verify login on the Vercel URL** |
| H2.6 | CORE-02 | Consolidate worker Redis connections, or upgrade Redis; re-enable crawl → kb → callMinutesReset → followUpAlert → trial jobs | 🟢 | 🟡 deployed (PR #14/#15): Render log 2026-10-08 shows 8/8 workers started, 11 Redis connections, churn scan ran; SEC-07 SSRF fix. **Verify one crawl + KB doc reaches `ready`** |

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
| H4.2 | BIZ-04, BIZ-07 | Align plan numbers with the pricing doc; mark unbuilt features "coming soon" (WhatsApp, Sheets, CRM, n8n, booking, reports) | 🔵 + 🟡 | 🟡 Pricing page, landing pricing, Billing page, Terms done in Wave 7 (P6, only built features listed; plan numbers served from one catalog). Still open: Services + Industries copy (FE-19) |
| H4.3 | BIZ-05 | Stripe `invoice.payment_failed` handling + event idempotency | 🟢 | ⏳ |
| H4.4 | BIZ-06 | Gate outbound calls (trial, quota, role) | 🟢 | ⏳ |
| H4.5 | TEAM-01…04 | Invite permissions, backend permission parity, route guards, per-session refresh tokens | 🟢 | ⏳ |
| H4.6 | SA-01, SA-02 | Fix broadcast and transfer-ownership queries; wire or hide unused super-admin features | 🟢 | ⏳ |
| H4.7 | SEC-07…12 | Remaining security P1s (SSRF, access-log membership, email escaping, SA rate limit, auth hardening, order fallback) | 🟢 | ⏳ |
| H4.8 | CORE-06, 08, 09 | `status-update` handling, real transcript timestamps, crawl-poll timeout | 🟢 | ⏳ |
| H4.9 | FE-01…03, FE-09 | Contact form endpoint, real testimonials, legal placeholders; required Terms/Privacy consent checkbox at signup + `termsAcceptedAt` | 🟡 + 🟢 + Founder | ⏳ |
| H4.10 | OPS-01…03 | Remove the ECS deploy workflow; fix CI e2e; add webhook, orders and minutes tests | 🟢 | 🟡 OPS-01 done (ECS workflow removed, PR #11); e2e + webhook/orders/minutes tests partly done (OPS-02/03) |

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
| H5.9 | FE-19, FE-02 | **Remove false / unmeasured claims** — Critical (trust, consumer-protection risk) | 🟢 + 🟡 | 🟡 landing + Pricing pill done (on `dev`); Services + Industries copy with GTM-01, Pricing features with H4.2 |
| H5.10 | FE-20, FE-17 | Mobile first screen: no horizontal overflow at 320/375/414 px, short header CTA, compact cookie bar | 🟢 | ⏳ |
| H5.11 | FE-21 | Hero rewrite (5-second test): eyebrow (who), H1 (what), outcome line, one CTA + "Hear the voices", 3-fact row | 🟡 + 🟢 | ⏳ (final copy after D2) |
| H5.12 | FE-22 | Remove the AI look: blobs, grid bg, "New" pill, extra gradients/pills/CTAs; merge or drop low-value sections | 🟢 | ⏳ |
| H5.13 | FE-23, FE-24 | Colour + motion rules: rename tokens, one accent, neutral step numbers; one hero entrance, drop repeated `Reveal`, progress bar, decorative loops | 🟢 | ⏳ |
| H5.14 | — (process) | Designer pass each release: screenshot public pages at 375 px and 1366 px, list the top 10 issues, fix, re-check; later Playwright visual snapshots in CI | 🟢 + 🔵 | ⏳ recurring |

### Wave 6 — Cost reduction (founder request 2026-10-02) — `gaps.md` § 14

Merged to `dev` and `main` (with Wave 2, PR #8 → #13). Backend + frontend `tsc` clean; 23 new unit/route tests pass; DB-backed suites not run locally (no MongoDB binary in the sandbox) — run `npm test` in CI.

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| C1 | COST-01 | LLM registry `config/llm.ts` + `LLM_MODEL` (default gpt-4o-mini); one temperature (0.3); `scripts/set-assistant-model.ts` | 🟠 + 🟢 | ✅ deployed (`main`) |
| C2 | COST-02 | Compact catalog; lookup tools (`search_catalog`, `search_knowledge_base`, `POST /api/v1/tools/lookup`) above 60 items / 3,000 KB chars; FAQ de-dup | 🟠 + 🟢 | ✅ deployed (`main`) |
| C3 | COST-03 | Every prompt push re-sends tool IDs (KB sync / language change no longer detach `submit_order`) | 🟢 | ✅ deployed — verify tools stay attached after a KB sync |
| C4 | COST-04 | Voice tiers: premium voices Pro-only (API 403 + locked picker); Naina settings kept on voice change | 🟢 + 🔵 | ✅ deployed (`main`) |
| C5 | COST-05 | Real per-call cost + breakdown stored; margin page = Vapi + telephony, prorated revenue, cost/min, estimate share; `scripts/backfill-call-costs.ts` | 🟢 + 🟣 | ✅ deployed; backfill run 2026-10-08 → 0 calls missing a cost (all stored calls already carry Vapi cost). Remaining: set `TELEPHONY_COST_PER_MIN_USD` from the Vobiz invoice |
| C6 | COST-06 | Evals on gpt-4o-mini vs gpt-4o, then switch the live Ritu assistant | 🟠 → Founder | ⏳ |
| C7 | COST-07, BIZ-07 | Premium Voices add-on: Stripe checkout + webhook (never touches `plan`), Billing card, plan cards + pricing table, auto-cancel on Pro, voice downgrade when access is lost | 🟢 + 🟡 | 🟡 deployed; Stripe **test-mode** product `prod_VOx1okXak7TCWB` + prices created 2026-10-08 (Basic `price_1UO97mCSV37glksW99DenmFQ`, Standard `price_1UO97nCSV37glksW8bK0XP31`); portal cancel ON. Set IDs on Render; repeat with the live key at go-live |
| C8 | COST-08 | Tool safety net: every model update merges the live assistant's tools (submit_order / end call can't be dropped) | 🟢 | ✅ deployed (`main`) |

### Wave 7 — Pricing v2 (founder request 2026-10-08) — `gaps.md` § 15 · `Pricing-Redesign-2026-10.md`

Branch `feat/pricing-v2` (local, from `main`, **not committed**). Plan catalog: `backend/src/modules/billing/plan-catalog.ts` ⇄ `frontend/src/lib/pricing.ts` (values checked equal).

| Task | Gap | Description | Lead | Status |
|---|---|---|---|---|
| P1 | PRC-01, BIZ-04 | Plan catalog + `PLAN_LIMITS`: new `lite` = Starter ₹4,999 / 200 min / 1 call; Basic ₹9,999 / 500 / 2; Standard ₹17,999 / 1,000 / 3; Pro ₹29,999 / 1,500 / 5 (3,000-min hard cap removed); annual = 10× monthly | 🟢 + 🔵 | 🟡 code done, tests written |
| P2 | PRC-02, BIZ-05, OFR-01 | Checkout `{ plan, interval }`: annual prices; one-time setup fee (₹4,999 Basic/Standard, ₹14,999 Pro) on the first monthly checkout, waived on annual; webhook stores `billingInterval`, `setupFeePaidAt` | 🟢 | 🟡 code done |
| P3 | PRC-03, BIZ-05 | Prepaid top-up packs (100 min ₹2,000 · 500 min ₹9,000, 90 days): `POST /billing/topups/checkout`, credit on `checkout.session.completed` / `async_payment_succeeded` (idempotent per session), FIFO consumption after the plan allowance | 🟢 | 🟡 code done |
| P4 | PRC-04 | assistant-request gate: allowance + pack balance; per-plan simultaneous-call limit (active calls < 20 min old); transfer to `fallbackNumber` (Vapi `destination`) instead of a dead line; caller never hears "limit reached" | 🟢 + 🟠 | 🟡 code done — verify the Vapi transfer on a live call |
| P5 | PRC-05 | 80% / 100% usage emails (once per month, atomic claim) with top-up link | 🟢 + 🟣 | 🟡 code done |
| P6 | PRC-06, BIZ-07 | UI: Pricing page (4 plans, monthly/annual toggle, "every plan includes", top-ups, comparison), landing pricing, Billing page (plan names, interval switch, top-up card, simultaneous calls), Terms § 6, Why-us, super-admin plan lists/labels/MRR | 🔵 + 🟡 + 🟢 | 🟡 code done, build OK |
| P7 | PRC-07 | Premium Voices add-on on Starter (₹1,499) | 🟢 | 🟡 code done |
| P8 | PRC-08 | `scripts/create-pricing-v2-prices.ts` (dry run by default) + `.env.example` + `render.yaml` keys; `scripts/update-stripe-webhook-events.ts` adds `checkout.session.async_payment_succeeded` | 🟢 | ✅ backend `npm test` 388/388 (founder, 2026-10-08); Stripe **test-mode** prices created 2026-10-08 and written to local `.env` — set them on Render |

### Supporting lanes this sprint (zero-idle)

| Agent | Supporting / background lane |
|---|---|
| 🔵 Product | Score candidate niches and recommend one beachhead (GTM-01, plan § 7.1); acceptance criteria for H3.1 |
| 🟢 Engineering | Lead on Waves 1, 2 and 4 |
| 🟠 AI | Prompt + eval work (H3.4, H3.5); verify structured output after H2.1 |
| 🟡 Growth | Pricing and feature-claim cleanup (H4.2); real, consented testimonials from beta users (replaces FE-19 removals); per-page titles/descriptions copy (H5.4); define funnel events (H5.2); hero copy (H5.11) |
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
| 🔴 P0 | Rotate the **Redis Cloud password** (update `REDIS_URL` on Render + local `.env`); delete the `redis-cli -u …` comment at the end of `backend/.env` | SEC-03 |
| 🔴 P0 | Log in on `https://agent-ops-studio-eight.vercel.app` and confirm the dashboard loads | CORE-05 (H2.5) |
| 🔴 P0 | Run one website crawl in onboarding; add one KB document and confirm it reaches `ready` (8/8 workers running, 11 Redis connections — confirmed in Render logs 2026-10-08) | CORE-02 (H2.6) |
| 🟡 P1 | **Premium Voices**: set `STRIPE_PREMIUM_VOICES_BASIC_PRICE_ID_INR=price_1UO97mCSV37glksW99DenmFQ` and `STRIPE_PREMIUM_VOICES_STANDARD_PRICE_ID_INR=price_1UO97nCSV37glksW8bK0XP31` on Render (test mode; matches Render only if Render uses `sk_test_`). At go-live, re-run `create-premium-voice-prices.ts --apply` with the live key and swap the IDs | COST-07 (C7) |
| 🟡 P1 | Set `TELEPHONY_COST_PER_MIN_USD` on Render from the Vobiz invoice (default 0.006) — backfill already done (0 calls needed it) | COST-05 (C5) |
| 🟡 P1 | **D1**: approve the go-to-market model — AgentOps Studio platform + managed "AI implementation" offer (setup fee + monthly plan) | `AI-Implementation-Offer-Plan.md` § 4 |
| 🟡 P1 | **D2**: pick **one** beachhead niche (replaces "choose 2–3 launch industries"); default = electrical/hardware retail | GTM-01 |
| 🟡 P1 | Fill in the legal-page placeholders (entity, address, GSTIN, grievance officer); advocate review | FE-03 |
| 🔴 P0 (before charging) | **Pricing v2**: review branch `feat/pricing-v2`, run `npm test` (backend, needs MongoDB binary download) and commit/PR; then `cd backend && npx tsx scripts/create-pricing-v2-prices.ts` (dry run) → `--apply`, and set the printed 10 price IDs + new `STRIPE_PRO_PRICE_ID_INR` (₹29,999) on Render | PRC-01…08 |
| 🟡 P1 | Ask each customer to set a **fallback number** in Settings (calls transfer there when minutes run out or lines are busy) | PRC-04 |
| 🟢 P2 | **D3–D5**: managed service in Pro or paid add-on; which plans get webhooks/n8n; first CRM for templates | Plan § 8 |
| 🟢 P2 | Formspree form ID (or approve a backend contact endpoint); real testimonials | FE-01, FE-02 |
| 🟢 P2 | Set `VITE_SENTRY_DSN` in production; UptimeRobot on `/api/v1/health` | Monitoring |
| 🟢 P2 | Update `CLIENT_URL` in `render.yaml` / Render to the real Vercel URL | OPS-05 |
| 🟡 P1 | Create a Cloudflare Turnstile site (site key + secret) for Register and Contact | FE-10 |
| 🟡 P1 | Pick the analytics tool: Plausible (paid, cookieless) or Vercel Web Analytics; decide whether Sentry Replay stays on public pages | FE-11, FE-12 |
| 🟡 P1 | **Cost (C6)**: run evals on GPT-4o-mini vs GPT-4o (`node scripts/vapi-evals/local-evals.mjs --provider openai --model gpt-4o-mini --judge-model gpt-4o --repeat 3`, then the same with `--model gpt-4o`); if mini is as good, `cd backend && npx tsx scripts/set-assistant-model.ts --assistant 100b3bd9-5038-4f11-b487-7ced98d8a3dd --apply` | COST-06 |
| 🟢 P2 | **D6**: approve converting the 5 agents to Claude Code subagents + adding 3–4 specialists (AppSec, code reviewer) with chained handoffs instead of all-agents-every-turn | `gaps.md` § 13 |

---

## ✅ Completed Work (condensed history)

**Founder actions done 2026-10-08**: Vapi `submit_order` tool secret set; `SA_JWT_SECRET`, `VAPI_WEBHOOK_SECRET`, `VAPI_TOOL_WEBHOOK_SECRET` confirmed on Render; test phone order placed. Done 2026-10-02: super-admin password rotated; Redis decision (stay on free tier, shared worker client).

| Date | Milestone | Key deliverables |
|---|---|---|
| 2026-10-01 → 10-08 | S-HARDEN Waves 1–3 + cost reduction | All P0 code fixes and C1–C8 merged to `dev`/`main` (PRs #6, #8, #10–#15) and auto-deployed to Render + Vercel |
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
| 2026-10-08 | **Pricing v2**: Starter ₹4,999 (new) · Basic ₹9,999 · Standard ₹17,999 · Pro ₹29,999 (was ₹25,999, 1,500 min, no 3,000 cap); annual = 2 months free; setup ₹0/₹4,999/₹4,999/₹14,999 waived on annual; prepaid top-ups ₹20/₹18 per min; premium add-on ₹1,499 on Starter | Founder (T0) | Pro could lose up to ₹9,303/customer/month; blended margin ≈63%, floor ≈37% (`Pricing-Redesign-2026-10.md`) |
| 2026-10-02 | Keep the backend on Render (not Vercel); API reached through a Vercel `/api` rewrite; stay on the Redis Cloud free tier | Founder (T0) | Backend needs a long-running process (BullMQ workers, fast Vapi webhooks); rewrite makes cookies first-party without a domain; shared worker client fits 8 workers in ~11 connections |
| 2026-10-02 | Premium voices: **included on Pro; add-on ₹2,999/mo on Basic, ₹4,999/mo on Standard** (+ GST); not sold on the trial | Founder (T0) | Covers the extra ElevenLabs cost at full usage; Standard + add-on stays below Pro (pricing doc § 11) |
| 2026-10-02 | **PROPOSED**: default LLM GPT-4o → GPT-4o-mini (env `LLM_MODEL`, revert anytime); stay on Vapi (own platform revisit at ~20–30k min/month) | CEO Agent → Founder (T0 for pricing part) | GPT-4o was the largest controllable cost per minute; Vapi fee ($0.05/min) only pays back at volume (`gaps.md` § 14). Supersedes 2026-06-26 "GPT-4o default" once evals pass |
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

