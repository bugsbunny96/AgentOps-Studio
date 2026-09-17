# AgentOps Studio — Task Board

> **Founder**: Rishabh Sharma  
> **CEO Agent**: Claude (orchestrator)  
> **Last updated**: 2026-07-30 (Session 4)  
> **Operating model**: All 5 agents work in parallel on every task. No idle agents.  
> **Execution Framework**: `agents/EXECUTION-FRAMEWORK.md` — full WBS with atomic tasks  
> **SOP**: `agents/SOP.md` — read at session start  
> **R&D Log**: `main-project-docs/RD-LOG.md` — all research findings

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
| 🔄 | In Progress |
| ⏳ | Pending / Queued |
| ❌ | Blocked — needs CEO resolution |
| 🔁 | Background lane (always-on task) |

---

## ⚡ Zero-Idle Rule

Every sprint task below has a row for ALL 5 agents. If an agent's primary work is not on this task, it runs its background lane (marked 🔁). No agent ever shows nothing.

---

## 🏢 Company Status — 2026-07-30 Session 5 (Transcript Search)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | Full-text transcript search is a Tier 1 differentiator for Indian SMB CX teams — enables supervisors to review calls by keyword, find objection patterns, and audit agent quality at scale | ✅ |
| 🟢 Engineering | Added `fullText` + `organizationId` to TranscriptModel; MongoDB text index (`transcript_fulltext_idx`, language='none' for exact match); webhook service populates both fields on every new call; `searchTranscripts()` service with relevance sorting + snippet extraction; `searchTranscriptsHandler` controller; `GET /api/v1/calls/search` registered before `/:id`; tsc --noEmit clean | ✅ |
| 🟠 AI Agent | `fullText` format "AGENT: <text>\nUSER: <text>" is structured for future use as RAG retrieval source — each line can become a chunk in a KB re-sync pipeline | ✅ Background |
| 🟡 Growth Agent | "Search your call transcripts" is a compelling demo feature — recommend adding to feature matrix on /pricing and in outbound sequences | ✅ Background |
| 🟣 Customer Agent | Supervisors can now search for specific phrases ("want to cancel", "escalate") across all org transcripts — direct churn-signal extraction use case; update CS playbook | ✅ |

**Session deliverables**:
- `backend/src/modules/calls/call.model.ts` — `ITranscript` extended with `fullText?: string` and `organizationId?: ObjectId`; text index `transcript_fulltext_idx` with `default_language: 'none'` (exact/phrase matching, no stemming); compound index `{ organizationId, createdAt }`; `fullText` hidden by default via `select: false` + stripped from `toJSON`
- `backend/src/modules/calls/webhook.service.ts` — `handleEndOfCallReport` now derives `fullText` from turns ("AGENT: …\nUSER: …") and writes `organizationId` + `fullText` in the TranscriptModel upsert
- `backend/src/modules/calls/call.service.ts` — `SearchTranscriptsQuery` interface; `buildSnippet()` helper (±160-char context window centred on first matched term); `searchTranscripts()` service (org-scoped $text search, relevance-sorted, paginated, joins CallModel, returns turns[0..2])
- `backend/src/modules/calls/call.controller.ts` — `searchTranscriptsHandler` (GET /api/v1/calls/search)
- `backend/src/modules/calls/call.routes.ts` — `GET /search` registered before `/:id` (prevents Express treating "search" as ObjectId param)

**Founder note**:
- Pre-deployment transcripts lack `fullText`/`organizationId` → won't appear in search (correct — security > coverage)
- MongoDB Atlas creates the text index automatically on next app start (Mongoose `autoIndex: true` default)
- For production Atlas, if `autoIndex` is disabled, run in Atlas UI: `db.transcripts.createIndex({ fullText: "text" }, { name: "transcript_fulltext_idx", default_language: "none" })`

---

## 🏢 Company Status — 2026-07-30 Session 4 (Monitoring)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | Monitoring as a product-quality signal: Sentry surface-area maps to user-facing error hotspots; UptimeRobot uptime SLA is a future trust/pricing lever for enterprise tiers | ✅ |
| 🟢 Engineering | Installed @sentry/react + @sentry/vite-plugin; created lib/sentry.ts (init, captureException, setSentryUser); SentryErrorBoundary component; wired into main.tsx; sentryVitePlugin in vite.config.ts; added /api/v1/health alias (now returns 503 when Mongo is disconnected); tsc --noEmit clean on both frontend + backend | ✅ |
| 🟠 AI | Background: Sentry tags include plan + orgId — this unlocks AI error rate analysis by plan tier (e.g. voice call failures on Growth vs Starter) | ✅ Background |
| 🟡 Growth | UptimeRobot free tier gives a public-status-page URL once set up — link from footer increases enterprise trust; uptime SLA can be a paid-plan differentiator | ✅ |
| 🟣 Customer | Sentry error alerts → can be piped to email/Slack for CS team to proactively reach out to users hitting errors; UptimeRobot → instant downtime notification | ✅ |

**Session deliverables**:
- `frontend/src/lib/sentry.ts` — Sentry init (disabled in dev), captureException helper, setSentryUser / clearSentryUser for per-user error grouping
- `frontend/src/components/SentryErrorBoundary.tsx` — fullscreen dark-theme fallback; replaces blank white screen on unhandled render errors; shows error detail in dev only
- `frontend/src/main.tsx` — `initSentry()` called before React tree; `<SentryErrorBoundary>` wraps entire app
- `frontend/vite.config.ts` — `sentryVitePlugin` added; source maps uploaded to Sentry only when `SENTRY_AUTH_TOKEN` present (CI); no-ops in local dev
- `frontend/.env.example` — added `VITE_SENTRY_DSN`, `VITE_APP_VERSION`, and build-time Sentry env var comments
- `backend/src/app.ts` — `/health` refactored into named `healthHandler`; new `/api/v1/health` alias added; both return `503` when MongoDB is disconnected (proper degraded-state signalling for monitors)

**Founder action required**:
1. Create free Sentry account → create project "agentops-frontend" → copy DSN → add `VITE_SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz` to production `.env`
2. Create free UptimeRobot account → add HTTP monitor → URL: `https://api.agentopsstudio.com/api/v1/health` → keyword: `"status":"ok"` → alert to your email
3. (Optional CI source-maps) Add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` to GitHub Actions secrets
4. Stripe webhook monitoring — Stripe Dashboard → Developers → Webhooks → click your endpoint → "Event deliveries" tab shows success/failure log; enable email alerts under Developer → Alerts

---

## 🏢 Company Status — 2026-07-29 Session 3 (Legal Pages)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | Legal pages as a trust and conversion asset: T&C + Privacy required for Stripe approval, SMB trust signal, reduces support questions on data handling | ✅ |
| 🟢 Engineering | Created TermsPage.tsx + PrivacyPolicyPage.tsx; added /terms + /privacy routes to routes/index.tsx; refactored PublicLayout.tsx footer link columns from href="#" to proper <Link> components; tsc --noEmit clean | ✅ |
| 🟠 AI | Background: Privacy Policy Section 5 documents all AI data processors (OpenAI, Deepgram, ElevenLabs, Vapi) transparently — surfaces our AI data flow for user trust | ✅ Background |
| 🟡 Growth | Terms + Privacy required for Stripe approval workflow — unblocks go-live. Trust badges on public site reduces checkout friction. | ✅ |
| 🟣 Customer | SPDI Rules Grievance Officer designation + 30-day resolution SLA reduces regulatory risk; Section 9 call recording notice clarifies user obligations = fewer compliance support tickets | ✅ |

**Session deliverables**:
- `frontend/src/features/public/TermsPage.tsx` — India-specific Terms of Service: 20 sections covering IT Act 2000, TRAI regulations, subscription/billing terms (INR + GST), refund policy (Consumer Protection Act 2019), call recording obligations, AUP, IP, limitation of liability, Bengaluru arbitration clause, Grievance Officer contact
- `frontend/src/features/public/PrivacyPolicyPage.tsx` — India-specific Privacy Policy: SPDI Rules 2011 + DPDPA 2023 aligned; 15 sections covering data categories, third-party processors table (9 processors), data retention schedule, 7 user rights cards, call recording notice (critical), cookies table, mandatory Grievance Officer section
- `frontend/src/routes/index.tsx` — added `/terms` and `/privacy` lazy routes as children of PublicLayout
- `frontend/src/layouts/PublicLayout.tsx` — refactored footer's 3 link columns (Product, Company, Legal) from string arrays + href="#" to typed `{ label, to }` objects + `<Link>` components with real routes

**Founder action required before publishing**:
1. Replace `[LEGAL ENTITY NAME]` with your registered company name in both pages
2. Replace `[REGISTERED ADDRESS]` with actual registered address
3. Replace `[YOUR GSTIN]` with actual GSTIN
4. Replace `[GRIEVANCE OFFICER NAME]` in TermsPage.tsx (PrivacyPage already uses "Rishabh Sharma")
5. Set up grievance@agentopsstudio.com, legal@agentopsstudio.com, privacy@agentopsstudio.com email addresses
6. Have a licensed Indian advocate review both documents before publication

---

## 🏢 Company Status — 2026-07-29 Session 2 (Stripe Customer Portal)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | Identified self-serve portal removes founder from cancellation/invoice support loop; hardcoded placeholder link flagged and replaced | ✅ |
| 🟢 Engineering | Task #62–66: createPortalSession() + handler + POST /portal route + billingPortal mock + 3 tests + BillingPage button — tsc clean | ✅ |
| 🟠 AI | Background: portal session URL is stateless/single-use — no persistence or queue interaction needed | ✅ Background |
| 🟡 Growth | "Manage subscription" CTA surfaces Stripe-hosted invoice history — reduces support tickets and increases trust | ✅ Background |
| 🟣 Customer | Self-serve cancel + downgrade removes founder from support loop entirely; churn still logged via Stripe webhook subscription.deleted | ✅ |

**Session deliverables**:
- `backend/src/modules/billing/billing.service.ts` — `createPortalSession(userId)`: resolves org's Stripe customer ID, calls `stripe.billingPortal.sessions.create`, returns one-time portal URL; 400 `NO_STRIPE_CUSTOMER` guard for free/trial orgs
- `backend/src/modules/billing/billing.controller.ts` — `createPortalSessionHandler`
- `backend/src/modules/billing/billing.routes.ts` — `POST /api/v1/billing/portal` (express.json + authenticate)
- `backend/src/__tests__/billing.test.ts` — `mockPortalCreate` in vi.hoisted + Stripe mock; 3 new tests (401, 400 no customer, 200 portal URL)
- `frontend/src/features/billing/BillingPage.tsx` — `portalMutation` (POST /billing/portal); replaced hardcoded `<a href="...test_placeholder">` with proper button (Loader2 spinner, error toast, `window.location.href` redirect)

**Founder action required**: Stripe Dashboard → Customers → Customer portal → Activate portal → configure what customers can do (cancel, downgrade, update card, download invoices). Until activated, the portal API call will throw a Stripe error.

---

## 🏢 Company Status — 2026-07-29 (Session: INR Pricing + Call Minutes + Rate Limiting)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | Reviewed entire billing UX — KnowledgeBasePage + TeamPage flat-field references fixed; all billing meters use nested API shape | ✅ |
| 🟢 Engineering | Task #50–56: callMinutesUsed + BullMQ cron + Vapi gate + billing meters; Task #57–61: INR Stripe price IDs — tsc clean both sides | ✅ |
| 🟠 AI | Call minutes limit gate in `handleAssistantRequest` — inline Vapi assistant blocks over-limit calls before STT/LLM cost incurred | ✅ |
| 🟡 Growth | All public pages already ₹ INR — PricingPage, HomePage, ContactPage verified; .env.example Stripe section added | ✅ |
| 🟣 Customer | Rate limiting confirmed: auth endpoints already at 10/15min (more restrictive than requested); no change needed | ✅ |

**Session deliverables**:
- `backend/src/config/env.ts` — added `STRIPE_STARTER_PRICE_ID_INR` + `STRIPE_GROWTH_PRICE_ID_INR` optional env vars
- `backend/src/modules/billing/billing.service.ts` — `getPlanPriceId()` prefers INR variants; `getPlanFromPriceId()` checks both variants for subscription webhook matching
- `backend/src/__tests__/billing.test.ts` — INR price ID mocks added; test assertions updated to `price_starter_inr_mock` / `price_growth_inr_mock`
- `backend/.env.example` — full Stripe section added (SK, webhook secret, starter/growth USD + INR price IDs)
- `backend/src/modules/organization/organization.model.ts` — `callMinutesUsed` + `callMinutesResetAt` fields
- `backend/src/jobs/callMinutesReset.queue.ts` + `callMinutesReset.worker.ts` — monthly BullMQ cron + self-healing aggregation-pipeline reset
- `backend/src/modules/calls/webhook.service.ts` — call minutes gate + atomic increment in end-of-call-report
- `frontend/src/features/billing/BillingPage.tsx` — call minutes UsageMeter with reset date subtitle
- `frontend/src/features/knowledge-base/KnowledgeBasePage.tsx` + `frontend/src/features/team/TeamPage.tsx` — fixed nested API field references

**Founder action required (INR)**: Create INR-denominated prices in Stripe Dashboard (Products → Add price → Currency: INR), then set `STRIPE_STARTER_PRICE_ID_INR` and `STRIPE_GROWTH_PRICE_ID_INR` in your `.env`. Existing checkout works with USD prices until then.

---

## 🏢 Company Status — 2026-07-09 (Week 2 Session 3: Calls Page Polish)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | Reviewed call detail UX — endedReason chip + live state indicator locked into spec | ✅ |
| 🟢 Engineering | Task #26: fixed `getOrgId` role filter; Task #27: polished CallDetailPage (timestamps, copy, endedReason, live indicator); Task #28: `tsc --noEmit` clean both sides | ✅ |
| 🟠 AI | Background: active call polling wired (5s refetchInterval while `status === 'active'`) | ✅ Background |
| 🟡 Growth | Background: ICP doc / content queue | 🔁 |
| 🟣 Customer | Background: KPI snapshot + health score review | 🔁 |

**Session 3 deliverables**:
- `frontend/src/types/index.ts` — added `endedReason?: string` and `updatedAt: string` to `Call` interface
- `frontend/src/features/calls/CallDetailPage.tsx` — enhanced:
  - `endedReason` chip in HeroCard (humanized label, shown for completed/failed only)
  - `formatTurnOffset()` helper — "m:ss" offset from first turn timestamp shown on each bubble
  - "Copy transcript" button with clipboard API + 2s "Copied" confirmation flash
  - `TranscriptLiveState` component — pulsing emerald indicator when `call.status === 'active'` and no transcript yet
  - Summary card also shows "will be generated when the call ends" message for active calls
  - `refetchInterval: 5000` when call is active (auto-polls until transcript arrives)
- Both sides `tsc --noEmit` clean (zero errors)

---

## 🏢 Company Status — 2026-07-04 (Session: Business Hours Routing)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | R&D: Phone number setup UX — filed RFC-005 (move to Activate page) | ✅ |
| 🟢 Engineering | Session 2 complete: assistant-request handler + linkPhoneNumber endpoint + SettingsPage — tsc clean | ✅ |
| 🟠 AI | Business hours gate live: isWithinBusinessHours() + after-hours inline assistant | ✅ |
| 🟡 Growth | R&D: competitors show phone setup in Go Live flow, not settings — RFC-005 queued | ✅ Background |
| 🟣 Customer | Business hours default open on bad timezone = zero missed calls — logged | ✅ Background |

**Active WBS Node**: `Week 1 Session 3` — Vobiz SIP setup (founder manual) + end-to-end test call
**Session 2 deliverables**:
- `backend/src/utils/businessHours.ts` — timezone-aware hours check (Node built-in Intl)
- `backend/src/modules/calls/webhook.service.ts` — `handleAssistantRequest()` with business hours gate + after-hours inline assistant
- `backend/src/modules/calls/webhook.controller.ts` — dual-path: synchronous for `assistant-request`, fire-and-forget for everything else
- `backend/src/modules/agents/agent.service.ts` — `linkPhoneNumber()` + `getPhoneNumber()`
- `backend/src/modules/agents/agent.controller.ts` — `linkPhoneNumberHandler` + `getPhoneNumberHandler`
- `backend/src/modules/agents/agent.routes.ts` — `GET/POST /api/v1/agents/phone-number`
- `frontend/src/features/settings/SettingsPage.tsx` — Phone Number Setup live section with UUID validation + TanStack Query
**Founder action required**: Session 3 — see below.

### Session 3 Checklist (founder manual tasks)

| Step | Task | Done? |
|---|---|---|
| 1 | Vobiz console → buy DID number → SIP trunk → point SIP endpoint to `sip.vapi.ai` | ⬜ |
| 2 | Vapi dashboard → Phone Numbers → import Vobiz number | ⬜ |
| 3 | Vapi phone number settings → Server URL = `https://<your-api>/api/v1/webhooks/vapi` | ⬜ |
| 4 | Vapi phone number settings → Secret = value from `VAPI_WEBHOOK_SECRET` in backend `.env` | ⬜ |
| 5 | Copy phone number UUID from Vapi → paste into Settings → Phone Number Setup → Save | ⬜ |
| 6 | Call the DID number → verify business hours routing → confirm call appears in Calls page | ⬜ |

---

## 🏢 Company Status — 2026-06-26 (Session 4)

| Agent | Current Task | Status |
|---|---|---|
| 🔵 Product | L2.F4 wizard spec + UX copy: all 4 real pages reviewed; ConnectPage industry list + CTA copy locked | ✅ |
| 🟢 Engineering | **L2.F3** POST/PATCH/complete onboarding endpoints + 15 tests; **L2.F4** all 5 wizard pages implemented | ✅ |
| 🟠 AI | Vapi provisioning gate confirmed: NOT at org creation; placeholder in ActivatePage until L3 | ✅ |
| 🟡 Growth | Onboarding completion email copy drafted (background); "You're live!" launch moment copy queued | ✅ Background |
| 🟣 Customer | Org creation → COMPLETED flow = activation milestone; health score gate now code-enforced in OrgGuard | ✅ Background |

**Active WBS Node**: `L2.F5` — Knowledge Base (next sprint)  
**Next 3 atomic tasks**: L2.F5.M1.AT1 (KB schema) → AT2 (Firecrawl integration) → AT3 (BullMQ pipeline)  
**Founder action required**: None — L2.F3 + L2.F4 complete. Git commit recommended before starting L2.F5.

---

## Active Sprint — Layer 2: Identity & Onboarding

### Atomic Task Tracker (L2.F2 — Auth Tests) ← CURRENT

| Atomic Task ID | Description | Status |
|---|---|---|
| L2.F2.M1.AT1 | auth.test.ts — test DB setup (beforeAll/afterAll) | ✅ |
| L2.F2.M1.AT2 | POST /auth/register — happy path (AT1.1–AT1.3) | ✅ |
| L2.F2.M1.AT3 | POST /auth/register — error cases (AT1.4–AT1.10) | ✅ |
| L2.F2.M1.AT4 | POST /auth/verify-email — happy path (AT2.1–AT2.2) | ✅ |
| L2.F2.M1.AT5 | POST /auth/verify-email — error cases (AT2.3–AT2.5) | ✅ |
| L2.F2.M1.AT6 | POST /auth/login — happy path (AT3.1–AT3.6) | ✅ |
| L2.F2.M1.AT7 | POST /auth/login — error cases (AT3.7–AT3.10) | ✅ |
| L2.F2.M1.AT8 | POST /auth/refresh — happy path + token rotation (AT4.1–AT4.2) | ✅ |
| L2.F2.M1.AT9 | POST /auth/refresh — error cases (AT4.3–AT4.4) | ✅ |
| L2.F2.M1.AT10 | GET /auth/me — happy path (AT5.1–AT5.2) | ✅ |
| L2.F2.M1.AT11 | GET /auth/me — error cases (AT5.3–AT5.4) | ✅ |
| L2.F2.M1.AT12 | POST /auth/logout — cookie clear + Redis (AT6.1–AT6.3) | ✅ |
| L2.F2.M1.AT13 | POST /auth/forgot-password — anti-enumeration (AT7.1–AT7.4) | ✅ |
| L2.F2.M1.AT14 | POST /auth/reset-password — happy path + errors (AT8.1–AT8.7) | ✅ |
| L2.F2.M2.AT1 | middleware.test.ts — authenticate (AT1.1–AT1.5) | ✅ |
| L2.F2.M2.AT2 | middleware.test.ts — validateOrganization (AT2.1–AT2.5) | ✅ |
| L2.F2.M3.AT1 | E2E: auth-flow.spec.ts — full register→verify→login | ✅ |
| L2.F2.M3.AT2 | E2E: forgot-password form success state | ✅ |
| L2.F3.M1.AT1 | `onboarding.schema.ts` — CreateOrgSchema + UpdateOrgSchema (discriminated union) | ✅ |
| L2.F3.M1.AT2 | `onboarding.service.ts` — generateUniqueSlug() + toSlugBase() | ✅ |
| L2.F3.M1.AT3 | `onboarding.service.ts` — createOrg / updateOrgStep / completeOnboarding | ✅ |
| L2.F3.M1.AT4 | `onboarding.controller.ts` — 3 handlers (create / update / complete) | ✅ |
| L2.F3.M1.AT5 | `onboarding.routes.ts` + `app.ts` — router wired | ✅ |
| L2.F3.M1.AT6 | `onboarding.test.ts` — 15 integration tests (5 unit + 7 POST + 2 PATCH + 1 complete) | ✅ |
| L2.F4.M1.AT1 | `useAuth.ts` — createOrg / updateOnboardingStep / completeOnboarding hooks | ✅ |
| L2.F4.M1.AT2 | `ConnectPage.tsx` — org name + industry dropdown + hidden timezone | ✅ |
| L2.F4.M1.AT3 | `LearnPage.tsx` — hasWebsite toggle + conditional websiteUrl + Skip | ✅ |
| L2.F4.M1.AT4 | `ConfigurePage.tsx` — description + services tags + hours + contact + Skip | ✅ |
| L2.F4.M1.AT5 | `CustomizePage.tsx` — language checkboxes (en-US/hi-IN/pa-IN) + fallback number | ✅ |
| L2.F4.M1.AT6 | `ActivatePage.tsx` — checklist summary + Launch CTA + Vapi placeholder | ✅ |
| L2.F5.M1.AT1 | `kb.schema.ts` — knowledge base Mongoose model + Zod schemas | ⏳ NEXT |

> Full atomic task specs with Done Conditions: `agents/EXECUTION-FRAMEWORK.md § Feature 2.2`

### T2.1 — Auth Module (BE + FE)

| Agent | Task | Status | Notes |
|---|---|---|---|
| 🔵 Product | Spec auth flows (register, login, verify, forgot-pw, reset-pw) | ✅ | AC written; all endpoints specced |
| 🟢 Engineering | Implement all 8 auth endpoints + frontend auth forms | ✅ | Login, Register, ForgotPw complete; loop bug fixed |
| 🟠 AI | Check auth flow for Vapi provisioning dependencies | ✅ | No Vapi dependency at auth layer; documented |
| 🟡 Growth | Draft welcome email sequence triggered by registration | ⏳ | Background task — queue after T2.2 |
| 🟣 Customer | Define auth success metrics + activation milestone definition | ⏳ | Health score definition pending org creation |

---

### T2-QA — Auth Tests

| Agent | Task | Status | Notes |
|---|---|---|---|
| 🔵 Product | Auth AC review: 7 missing edge-case ACs flagged; refresh endpoint needs spec | ✅ | See RD-LOG 2026-06-26 |
| 🟢 Engineering | auth.test.ts (36 cases AT1–AT14) + middleware.test.ts (10 cases AT1–AT2); tsc clean | ✅ | Rate limiter skip added to app.ts |
| 🟠 AI | Vapi webhook events + HMAC signature verification researched → RD-LOG | ✅ | Background |
| 🟡 Growth | LinkedIn post: "Indian SMBs — perfect AI voice agent market" drafted | ✅ | Ready to post |
| 🟣 Customer | Launch KPI dashboard spec: 6 metrics, formulas, thresholds, alert conditions | ✅ | Background |

---

### L2.F3 — Org Creation + Onboarding Backend ✅ COMPLETE

| Agent | Task | Status | Notes |
|---|---|---|---|
| 🔵 Product | T0 decisions: org limit=1, industry=11-option dropdown, timezone=auto-detect | ✅ | Locked |
| 🟢 Engineering | POST /onboarding/org + PATCH /onboarding/org + POST /onboarding/complete; 15 tests | ✅ | All handlers + routes wired |
| 🟠 AI | Vapi provisioning gate: confirmed NOT at org creation; placeholder ActivatePage → L3 | ✅ | Background |
| 🟡 Growth | Onboarding completion email copy drafted; "you're live" moment copy queued | ✅ | Background |
| 🟣 Customer | Org creation = activation milestone; COMPLETED status enforced in OrgGuard | ✅ | Background |

---

### L2.F4 — Onboarding Wizard Frontend ✅ COMPLETE

| Agent | Task | Status | Notes |
|---|---|---|---|
| 🔵 Product | UX spec: 5-step wizard AC; industry dropdown confirmed; timezone hidden + auto-detect | ✅ | All AC met |
| 🟢 Engineering | useAuth hooks (createOrg/updateOnboardingStep/completeOnboarding) + all 5 pages | ✅ | ConnectPage/LearnPage/ConfigurePage/CustomizePage/ActivatePage |
| 🟠 AI | ActivatePage Vapi placeholder: "Test call widget — coming in next release" | ✅ | Clearly scoped for L3 |
| 🟡 Growth | Copy review: step headers, CTAs, hint text all polished | ✅ | Background |
| 🟣 Customer | Wizard flow mapped to 7-day onboarding plan; Skip options lower friction | ✅ | Background |

---

### T2.3 — Knowledge Base (Backend + Frontend)

| Agent | Task | Status | Notes |
|---|---|---|---|
| 🔵 Product | Spec KB CRUD: document list, upload, viewer, editor, re-sync | ⏳ | — |
| 🟢 Engineering | POST/GET/DELETE /api/v1/knowledge-base; Firecrawl + BullMQ pipeline; KB dashboard UI | ⏳ | — |
| 🟠 AI | RAG pipeline design: chunking, embedding, retrieval config; re-sync trigger | ⏳ | Core AI work |
| 🟡 Growth | Draft "knowledge base" feature launch copy + use-case blog post | ⏳ | Background lane |
| 🟣 Customer | KB adoption metric definition; support doc for "how to upload docs" | ⏳ | Background lane |

---

### T2.4 — Team Management

| Agent | Task | Status | Notes |
|---|---|---|---|
| 🔵 Product | Spec: invite flow, role permissions (Owner/Admin/Member), invite expiry | ⏳ | — |
| 🟢 Engineering | Team invite endpoints + membership CRUD + invite modal UI | ⏳ | — |
| 🟠 AI | No AI dependency; background lane | 🔁 | — |
| 🟡 Growth | Team collaboration as upsell trigger — draft messaging | ⏳ | Background lane |
| 🟣 Customer | Support doc: "how to invite team members"; CS playbook update | ⏳ | Background lane |

---

### T2.5 — Voice Agent Test Call (Activate Step)

| Agent | Task | Status | Notes |
|---|---|---|---|
| 🔵 Product | Spec: test call UX, success state, fallback if call fails | ⏳ | — |
| 🟢 Engineering | POST /onboarding/voice-agent/test-call endpoint; VapiSandbox React component | ⏳ | — |
| 🟠 AI | Vapi assistant provisioning flow on org creation; test call setup | ⏳ | Core AI work |
| 🟡 Growth | "Your AI agent just answered its first call" moment copy | ⏳ | Background lane |
| 🟣 Customer | First call success as activation milestone; update health score trigger | ⏳ | — |

---

## Backlog

### Layer 1 — Platform Foundation ✅ COMPLETE

| ID | Agent | Sub-Role | Task | Status |
|---|---|---|---|---|
| T1.1 | 🟢 Engineering | Backend | Express + TS + env + logger + Mongoose + Redis + BullMQ | ✅ |
| T1.1 | 🟢 Engineering | Backend | Error handler + rate limiter + /health | ✅ |
| T1.2 | 🟢 Engineering | Frontend | React 19 + Vite + TailwindCSS 4 + Redux + TanStack Query + Router | ✅ |
| T1.2 | 🟢 Engineering | Frontend | AuthGuard + GuestGuard + OrgGuard + 3 layouts + 15 placeholder pages | ✅ |
| T1.3 | 🟢 Engineering | DevOps | Dockerfile (multi-stage) + docker-compose.yml | ✅ |
| T1.3 | 🟢 Engineering | DevOps | GitHub Actions CI + deploy-backend + deploy-frontend | ✅ |
| T1-QA | 🟢 Engineering | QA | 20 backend tests + 16 frontend tests + Playwright E2E setup | ✅ |

### Layer 3 — Voice AI Infrastructure

| ID | Agent | Sub-Role | Task | Status |
|---|---|---|---|---|
| T3.1 | 🔵 Product | PM | Spec: voice agent CRUD, fields, AC | ⏳ |
| T3.1 | 🟢 Engineering | Backend | `voice_agents` schema + CRUD endpoints | ⏳ |
| T3.2 | 🟠 AI | Vobiz | SIP trunk provisioning + Indian number setup | ⏳ |
| T3.2 | 🟠 AI | Vapi | Vapi Server SDK integration + assistant management | ⏳ |
| T3.2 | 🟢 Engineering | Backend | Vapi webhook receiver: `call.started`, `call.completed`, `transcript.completed` | ⏳ |
| T3.3 | 🟠 AI | Voice | Deepgram STT + GPT-4o LLM + ElevenLabs TTS configuration | ⏳ |
| T3.3 | 🟠 AI | Voice | Multi-lingual: English + Hindi + Punjabi auto-detect | ⏳ |
| T3.3 | 🟠 AI | Prompt | System prompt v1.0.0 — base voice agent persona | ⏳ |
| T3.4 | 🟢 Engineering | Backend | Business hours routing + fallback webhook | ⏳ |
| T3-QA | 🟢 Engineering | QA | voiceAgent.test.ts: CRUD + multi-tenant isolation | ⏳ |
| T3-QA | 🟢 Engineering | QA | vapiWebhook.test.ts: HMAC + event routing | ⏳ |
| T3-QA | 🟠 AI | Evals | Eval harness v1: golden test set + intent accuracy baseline | ⏳ |

### Layer 4 — Intelligence Pipeline

| ID | Agent | Sub-Role | Task | Status |
|---|---|---|---|---|
| T4.1 | 🟢 Engineering | Backend | Call logging + recording metadata | ⏳ |
| T4.2 | 🟢 Engineering | Backend | Transcript aggregator → `transcripts` collection | ⏳ |
| T4.2 | 🟢 Engineering | Frontend | TranscriptViewer component (bubble stream) | ⏳ |
| T4.3 | 🟠 AI | LLM | BullMQ post-call pipeline: GPT-4o summarization | ⏳ |
| T4.4 | 🟢 Engineering | Frontend | Paginated call log table + filter bar | ⏳ |
| T4-QA | 🟢 Engineering | QA | calls.test.ts + BullMQ job test (mock OpenAI) | ⏳ |

### Layer 5 — Observability & Launch

| ID | Agent | Sub-Role | Task | Status |
|---|---|---|---|---|
| T5.1 | 🟢 Engineering | Backend | MongoDB aggregation: call counts, durations, outcomes | ⏳ |
| T5.1 | 🟢 Engineering | Frontend | Dashboard analytics widgets (Recharts) | ⏳ |
| T5.2 | 🟢 Engineering | Backend | Immutable audit log hooks + collection | ⏳ |
| T5.3 | 🟢 Engineering | Frontend | Workspace settings page | ⏳ |
| T5.4 | 🟢 Engineering | DevOps | Production deploy: AWS ECS + Vercel | ⏳ |
| T5.5 | 🟣 Customer | Analytics | KPI dashboard: calls, ARR, churn, adoption | ⏳ |
| T5.6 | 🟡 Growth | Marketing | Launch content: product page + LinkedIn + email sequence | ⏳ |
| T5-QA | 🟢 Engineering | QA | Full regression + coverage report | ⏳ |

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

## CEO Blockers / Pending Founder Actions

| Priority | Item | Blocker | Action needed |
|---|---|---|---|
| 🔴 P0 | L2.F2 auth tests | Need to write auth.test.ts | Send next message to start L2.F2.M1.AT1 |
| 🔴 P0 | Login flow verification | Browser may have cached old JS | Hard refresh (Cmd+Shift+R) at localhost:5173/login |
| 🔴 P0 | Pricing decision | Growth Agent recommends 3-tier pricing | Founder to approve or modify recommended tiers |
| 🟡 P1 | L3 Voice AI | Vobiz account setup | Founder to initiate Vobiz account verification |
| 🟡 P1 | L3 Vapi | Vapi API keys | Founder to provision Vapi account + share API key in .env |
| 🟢 P2 | Git commit | All L2.1 + framework work uncommitted | Run: `git add . && git commit -m "feat: Layer 2 auth + execution framework" && git push origin dev` |
