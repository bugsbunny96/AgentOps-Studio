# AgentOps Studio — R&D Log

> Owner: All Agents (CEO coordinates)
> Format: [DATE] | [AGENT] | [CATEGORY] | [FINDING] | [PRIORITY] | [DECISION]
> Rule: NEVER overwrite entries — always APPEND. Use version headers per session.

---

## v1.3.0 — 2026-07-04 — Session: Business Hours Routing Webhook (Session 2)

### 🟢 Engineering — Webhook Architecture

**[2026-07-04 | Engineering R&D | Architecture Note]**
Type: Research Note
Trigger: post-task-review
Finding: Vapi's `assistant-request` event requires a synchronous response within ~5 s. All other Vapi webhook events (call-started, end-of-call-report) can be processed fire-and-forget. Our webhook controller now implements a two-path pattern: peek at `body.message.type` before sending HTTP 200 — if `assistant-request`, await response synchronously; otherwise, send 200 immediately and process async.
Opportunity: This pattern should be documented as the standard for any future synchronous webhook integrations (e.g., payment callbacks, Exotel DTMF routing).
Proposed artifact: ADR-003 (Draft) — Vapi Webhook Two-Response Pattern
Affects: webhook.controller.ts, webhook.service.ts
Founder decision needed: No (implementation complete, logged)

### 🟠 AI R&D — Business Hours Gate

**[2026-07-04 | AI R&D | Routing Design]**
Type: Research Note
Trigger: post-task-review
Finding: When an org has no vapiPhoneNumberId linked yet, the assistant-request handler returns a generic error message rather than a valid assistant config. This means test calls from Vapi dashboard (which use assistantId mode, not phoneNumberId mode) bypass the business-hours gate entirely. This is correct behavior for test calls but must be documented clearly.
Opportunity: Add a "Test Call" mode flag to the Vapi payload metadata so we can distinguish test vs. live calls in analytics.
Proposed artifact: BL-012 — Test Call Mode Detection
Affects: webhook.service.ts, agent.service.ts
Founder decision needed: No (backlog candidate logged)

### 🟡 Growth R&D — Phone Number Setup UX

**[2026-07-04 | Growth R&D | UX / Activation]**
Type: Research Note
Trigger: post-task-review
Finding: "Phone Number Setup" is now in Settings — a low-traffic page. Most founders will miss it during onboarding. Competitor review: Bland.ai and Retell show phone number linking as a prominent step in their "Go Live" flow, not buried in settings.
Opportunity: Add Phone Number linking as an explicit step in the onboarding wizard's Activate page, alongside the test call widget. This increases the chance the founder completes the end-to-end setup in a single flow.
Proposed artifact: RFC-005 (Draft) — Move Phone Number Setup to Activate Page
Affects: Roadmap, ActivatePage.tsx
Founder decision needed: Yes — promote to sprint (T1) if approved

---

## v1.0.0 — 2026-06-26 — Session: Framework Setup

---

### 🟢 Engineering — Security

**[2026-06-26] | 🟢 Engineering | Security | HttpOnly cookie auth implementation**
- Finding: Our current auth uses HttpOnly + SameSite=Strict cookies. This correctly prevents XSS token theft. However, we don't yet have CSRF protection on state-mutating routes (POST/PUT/DELETE). Express `csurf` is deprecated; recommend `csrf-csrf` package for double-submit cookie pattern.
- Priority: **High** (security-critical before production launch)
- Decision: **Backlog** — implement in Layer 5 before production deploy. Log as ADR.
- Action: Add to Feature-Ticket-List.md as A-016: CSRF Protection

---

**[2026-06-26] | 🟢 Engineering | Security | Rate limiter coverage gaps**
- Finding: Current rate limiter covers login/register/forgot/reset only. API endpoints like POST /api/v1/org/invite, POST /api/v1/knowledge-base, and the Vapi webhook receiver need separate rate limits.
- Priority: **Medium**
- Decision: **Backlog** — add per-endpoint rate limits when those endpoints are built (L2.F6, L2.F5, L3.F3 respectively)

---

**[2026-06-26] | 🟢 Engineering | Tech Debt | TODO/FIXME scan results**
- Finding: Scanned codebase. Found the following TODO markers:
  - `backend/src/modules/organization/organization.routes.ts` — file exists but all routes commented (pending T2.2)
  - `frontend/src/features/onboarding/ConnectPage.tsx` — TODO marker: T2.2
  - `frontend/src/features/dashboard/DashboardPage.tsx` — TODO marker: T4.1
  - `frontend/src/features/calls/CallsPage.tsx` — placeholder: T4.1
  - `frontend/src/features/agents/AgentsPage.tsx` — placeholder: T3.1
  - `frontend/src/features/kb/KnowledgeBasePage.tsx` — placeholder: T2.3
  - `frontend/src/features/analytics/AnalyticsPage.tsx` — placeholder: T5.1
  - `frontend/src/features/settings/SettingsPage.tsx` — placeholder: T5.3
  - `frontend/src/features/team/TeamPage.tsx` — placeholder: T2.4
- Priority: **Low** (expected — placeholders are by design until respective sprint)
- Decision: **Monitor** — clear each TODO as its sprint begins

---

### 🟠 AI — Voice Stack

**[2026-06-26] | 🟠 AI | Voice API | Vapi integration planning**
- Finding: Vapi Server SDK (Node.js) is the recommended integration path. Key assistant configuration fields: `firstMessage`, `endCallMessage`, `idleTimeout`, `maxDurationSeconds`, `transcriber` (Deepgram), `model` (OpenAI), `voice` (ElevenLabs/Cartesia). Webhook events to handle: `call-started`, `call-ended`, `transcript`, `function-call`, `hang`.
- Priority: **High** (L3 dependency)
- Decision: **Adopt** — use Vapi Server SDK. Document full assistant provisioning spec before L3 begins.
- Action: Write `backend/src/config/vapi.ts` initialization module in L3.F3.

---

**[2026-06-26] | 🟠 AI | RAG | Vector store decision**
- Finding: Three options for RAG vector storage:
  1. **MongoDB Atlas Vector Search** — already using MongoDB, no extra infra, free tier available, cosine similarity supported, India region available (Mumbai ap-south-1). Latency: ~20-50ms. Best for our use case.
  2. **Pinecone** — dedicated vector DB, fastest queries (<10ms), but adds infra complexity + cost (~$70/month starter). No India region.
  3. **Qdrant** — open source, self-host on ECS, good performance, more DevOps overhead.
- Priority: **High** (L2.F5 knowledge base + L3 RAG pipeline)
- Decision: **MongoDB Atlas Vector Search** — minimizes infra complexity, same DB we already use, India region supported. Log as ADR-001.
- Action: CEO to create `main-project-docs/ADRs/ADR-001.md` (Vector Store Decision)

---

**[2026-06-26] | 🟠 AI | LLM | GPT-4o vs alternatives for voice**
- Finding: For voice agent LLM selection:
  - **GPT-4o** (our current plan): ~400ms median latency, $2.50/1M input tokens. Best balance for conversational AI.
  - **GPT-4o-mini**: ~200ms latency, $0.15/1M input — viable for simple FAQ agents, higher error rate on complex requests.
  - **Claude 3.5 Haiku**: ~300ms, good reasoning, but Vapi integration less mature.
  - Recommendation: GPT-4o for initial agents, GPT-4o-mini as a cost-optimization option for high-volume simple agents.
- Priority: **Medium**
- Decision: **Adopt GPT-4o as default**, add GPT-4o-mini as config option per agent in L3.
- Action: Add `llmModel` field to voice agent schema (enum: 'gpt-4o' | 'gpt-4o-mini')

---

**[2026-06-26] | 🟠 AI | Multilingual | Hindi/Punjabi TTS voice availability**
- Finding: Deepgram Nova-2 supports Hindi (hi) and Punjabi (pa) for STT. For TTS:
  - **ElevenLabs**: Hindi voices available (Aria Hindi, custom cloning). Punjabi support limited.
  - **Cartesia**: Supports Hindi. Punjabi not documented.
  - **Azure Neural TTS** (not in our current stack): Best Hindi/Punjabi coverage, 500 voices.
  - **Sarvam AI** (Indian startup): Purpose-built for Indian languages, lower latency from India region, supports all 22 Indian languages. API available.
- Priority: **High** (core differentiator for Indian market)
- Decision: **Backlog Sarvam AI** as secondary TTS option for Hindi/Punjabi. Stay with ElevenLabs for launch, add Sarvam as L3.1 option.
- Action: Add Sarvam AI to Feature-Ticket-List.md as enhancement in L3 sprint.

---

### 🟡 Growth — Competitive Intelligence

**[2026-06-26] | 🟡 Growth | Competitive | Competitor landscape summary**
- Finding: Key competitors in AI voice agent space as of June 2026:
  1. **Bland.ai** — US-focused, pricing $0.09/min, strong developer API, limited Indian language support, no India region.
  2. **Retell.ai** — $0.07/min, good dashboard, English only, US/EU customers.
  3. **Synthflow.ai** — No-code builder, €0.08/min, English + Spanish, EU-focused.
  4. **Vapi.ai** (as a product, not just platform) — $0.05/min, developer-focused, building their own dashboard.
  5. **Sarvam AI** — Indian competitor, voice AI focused on Indian languages, recently raised Series A (~$41M), enterprise focus.
  6. **Yellow.ai** — Indian enterprise chatbot/voice, established, expensive, complex setup.
- Positioning Gap: **No competitor combines English + Hindi + Punjabi in a self-serve SMB platform for Indian businesses.** This is our moat.
- Priority: **High**
- Decision: **Double down on Indian language support as primary differentiator** in all messaging.
- Action: Update ICP doc and all Growth agent materials with "Indian language native" positioning.

---

**[2026-06-26] | 🟡 Growth | Market | India B2B SaaS pricing signals**
- Finding: India B2B SaaS pricing benchmarks (2026):
  - Early-stage: ₹2,000–₹10,000/month for SMB tools
  - Voice AI is new category — can command premium if ROI is clear
  - Indian buyers prefer: annual billing with discount, per-minute or per-call pricing (predictable costs), free trial (not freemium)
  - Our ICP (logistics/healthcare/real estate/fintech) has clear cost centers: call center agents at ₹15,000–₹25,000/month each
  - AgentOps Studio replaces 2-3 agents at ₹30,000-₹75,000/month combined → price at ₹15,000-₹50,000/month = obvious ROI
- Priority: **High**
- Decision: **Recommend pricing to founder**: 3-tier — Starter (₹9,999/mo, 500 min, 1 agent), Growth (₹24,999/mo, 2000 min, 3 agents), Scale (₹59,999/mo, unlimited min, 10 agents). Annual: 20% discount.
- Action: Escalate to CEO for T0 pricing decision with founder.

---

### 🟣 Customer — Analytics & KPIs

**[2026-06-26] | 🟣 Customer | Analytics | Launch KPI framework**
- Finding: For a voice AI SaaS launching in India, the most important Day 0→Day 30 metrics are:
  1. **Activation rate**: % of sign-ups who complete onboarding AND handle first real call within 7 days. Target: >40%
  2. **Time to First Value (TTFV)**: minutes from sign-up to first test call completed. Target: <30 minutes
  3. **Week 1 retention**: did they log back in after Day 0? Target: >60%
  4. **Call completion rate**: % of AI-handled calls that don't result in human handoff or abandon. Target: >75%
  5. **MRR**: revenue metric, starts at $0, tracking from first paid customer
  6. **Churn**: starts unmeasurable, important from Month 2+
- Priority: **High**
- Decision: **Adopt** — use these 6 as our launch KPI set. Add to dashboard spec (T5.5).
- Action: Update 7-day activation plan in customer-agent.md to target TTFV <30 min.

---

**[2026-06-26] | 🟣 Customer | CS | Onboarding email sequence design**
- Finding: Best practice for B2B SaaS onboarding email sequences (based on Intercom, Vapi, Linear playbooks):
  - Day 0 (immediate): Welcome + what to do next (1 clear CTA)
  - Day 1: "Did you connect your website?" — nudge to complete Step 1
  - Day 3: "Your AI agent is ready to configure" — nudge to Step 3-4
  - Day 5: "Make your first test call today" — nudge to Activate step
  - Day 7: "Here's what your AI handled this week" — first value report
  - Day 14: Check-in from "founder" (personalized, not automated-feeling)
- Priority: **Medium**
- Decision: **Backlog** — implement in L2 after onboarding wizard is built (T2.2 complete)
- Action: Add email sequence to Growth agent backlog

---

## ADR Decisions Logged This Session

### ADR-001 — Vector Store: MongoDB Atlas Vector Search
```
ADR-001: Vector Store Selection for RAG Pipeline
Date   : 2026-06-26
Status : Accepted
Context: Need vector storage for KB document embeddings and semantic retrieval
Decision: MongoDB Atlas Vector Search (not Pinecone, not Qdrant)
Consequences:
  - Pro: No additional infrastructure, already using MongoDB Atlas, India region
  - Pro: Cosine similarity supported natively
  - Con: Slightly higher query latency than dedicated vector DBs (~20-50ms vs <10ms)
  - Con: Index rebuild required on document updates (acceptable for our use case)
```

---

---

## v1.2.0 — 2026-06-26 — Session: E2E Auth Tests + L2.F3 Planning

---

### 🟢 Engineering — E2E Testing

**[2026-06-26] | 🟢 Engineering | Testing | Playwright route mocking pattern for frontend-only E2E**
- Finding: Playwright config starts only the frontend dev server (no backend). All API calls must be intercepted with `page.route()`. The axios interceptor in `@/utils/api` retries any 401 by calling `POST /auth/refresh` before re-throwing. Tests in the "unauthenticated" state MUST mock `POST /auth/refresh → 401` or the interceptor hangs waiting for a backend that isn't running.
- Pattern: Use a closure variable `sessionState` to make `GET /auth/me` return 401 or 200 dynamically within a single test (required for the register→login→onboarding flow where the guard state changes mid-test).
- Files created: `e2e/tests/auth-flow.spec.ts` (8 test cases: AT1 full flow × 4 cases + AT2 forgot-password × 4 cases + AT1.7 GuestGuard redirect)

**[2026-06-26] | 🟢 Engineering | Testing | GuestGuard + AuthGuard timing in Playwright**
- Finding: GuestGuard calls `verifySession()` on mount → dispatches `setAuthLoading(true)` → GET /auth/me → sets `isLoading=false`. Must call `page.waitForSelector('#form-field', { state: 'visible' })` rather than asserting immediately after `page.goto()` to allow the guard's async resolution before the form renders.
- Finding: After login, `setCredentials()` sets `isLoading=false` in Redux. When AuthGuard mounts at /onboarding, it calls `verifySession()` again (useEffect), causing a brief `isLoading=true` → spinner → then resolves to 200. Playwright `toBeVisible()` with default 5s timeout handles this transparently.

### 🔵 Product — L2.F3 Org Creation

**[2026-06-26] | 🔵 Product | Spec | OnboardingSession model already exists in organization.model.ts**
- Finding: The `OnboardingSessionModel` is already implemented in `backend/src/modules/organization/organization.model.ts` alongside Org, Membership, and Invitation models. Contains: `userId, organizationId?, currentStep (Connect|Learn|Configure|Customize|Activate), stepStatus, draftPayload, resumeToken`. This means L2.F3 needs NO new model files — only service/controller/route files.
- Finding: `onboardingStatus` on Organization uses enum: `REGISTRATION → ORG_CREATION → WEBSITE_CRAWL → BUSINESS_CONFIG → VOICE_SETUP → COMPLETED`. Default is `'ORG_CREATION'`, which correctly represents "org just created, onboarding incomplete" state that OrgGuard uses to keep users in /onboarding/*.

**[2026-06-26] | 🔵 Product | AC | Open questions for founder (see L2F3 notes §13)**
- Gap 1: Org limit per user — restrict to 1 during onboarding, or allow unlimited from start?
- Gap 2: Industry field — predefined dropdown or free text?
- Gap 3: Timezone — always default Asia/Kolkata or auto-detect from browser?
- Action: Founder to review `main-project-docs/session-notes/L2F3-org-creation-backend-notes.md` §13 before L2.F3.M1 implementation begins.

### 🟠 AI — Vapi Provisioning Gate

**[2026-06-26] | 🟠 AI | Integration | Vapi provisioning is NOT triggered at org creation**
- Finding: Vapi assistant provisioning (creating a Vapi assistant object linked to the org) should NOT happen at `POST /api/v1/onboarding/org`. It should be triggered at the Activate step (T2.5) when the user has completed Configure + Customize and has a full system prompt ready.
- Rationale: Creating a Vapi assistant before the business config (Step 3) and voice customization (Step 4) are complete would require updating the assistant multiple times, wasting API calls and creating orphaned assistants if the user abandons onboarding.
- Decision: `POST /api/v1/onboarding/org` creates Org + Membership + OnboardingSession ONLY. No Vapi call at this step.
- Action: Vapi provisioning spec to be written in T2.5 planning.

### 🟡 Growth — Onboarding UX

**[2026-06-26] | 🟡 Growth | UX | ConnectPage industry dropdown — recommended list**
- For Indian SMB ICP, recommended industry options: Technology, Healthcare, Real Estate, Logistics / Delivery, Finance & BFSI, Education & EdTech, Retail, Hospitality & Food, Legal, Manufacturing, Other.
- Note: "Logistics / Delivery" and "Finance & BFSI" are high-intent for voice agents in India.
- Action: Pass this list to Engineering for ConnectPage form (L2.F4).

### 🟣 Customer — Org Creation Milestone

**[2026-06-26] | 🟣 Customer | Analytics | Org creation = Activation Gate Milestone 1**
- Definition: A user who successfully calls `POST /api/v1/onboarding/org` has crossed the first activation gate.
- Health score trigger: Move user from "Registered" to "Activating" on first org creation.
- TTFV implication: Org creation should take <2 minutes from login (ConnectPage is a simple 3-4 field form). If p50 org creation time exceeds 5 minutes, flag UX friction.
- Action: Log `event: 'ORG_CREATED'` in analytics on successful POST /onboarding/org (to be implemented in L5 analytics module).

---

## R&D Backlog (prioritized, not yet investigated)

| Priority | Agent | Topic | Target Session |
|---|---|---|---|
| 1 | 🟢 Eng | CSRF protection implementation | Session before L5 deploy |
| 2 | 🟠 AI | Sarvam AI API evaluation | Before L3.F4 multilingual |
| 3 | 🟡 Growth | Product Hunt launch strategy | Before L5 launch |
| 4 | 🔵 Product | Mobile UX requirements for Indian users | L4 sprint planning |
| 5 | 🟢 Eng | Node.js 22 upgrade feasibility | L4 or L5 sprint |
| 6 | 🟠 AI | Prompt caching cost optimization | L3 sprint |
| 7 | 🟣 Customer | NPS survey design | Post-launch Month 1 |
| 8 | 🟡 Growth | Cold outreach sequence for Indian SMBs | L5 GTM prep |
| 9 | 🟢 Eng | Docker image size optimization | L3/L4 DevOps sprint |
| 10 | 🔵 Product | Onboarding friction reduction study | L2.F4 planning |

---

## v1.1.0 — 2026-06-26 — Session: Auth Integration Tests

---

### 🟢 Engineering — Testing

**[2026-06-26] | 🟢 Engineering | Testing | Rate limiter skip for test environment**
- Finding: Auth endpoints have a 10 req/15min rate limiter using in-memory MemoryStore. Integration tests send 35+ requests to `/register` across the test suite. This would fail in CI without a skip.
- Resolution: Added `skip: () => process.env.NODE_ENV === 'test'` to all three rate limiters in `app.ts`. Vitest sets `NODE_ENV=test` automatically. Production behavior unchanged.
- Files changed: `backend/src/app.ts`

**[2026-06-26] | 🟢 Engineering | Testing | Redis mocking pattern for auth tests**
- Finding: `auth.service.ts` calls `redis.setex/get/del` in login, refreshTokens, logout, and resetPassword. Real Redis is not available in test environment. Pattern established: mock `@/config/redis` with an in-memory Map that mirrors Redis semantics. This enables full integration testing of token rotation and session invalidation logic without a real Redis instance.
- Pattern: See `backend/src/__tests__/auth.test.ts` lines 14–30.

**[2026-06-26] | 🟢 Engineering | Testing | Email mock + token capture pattern**
- Finding: `sendVerificationEmail` and `sendPasswordResetEmail` are fire-and-forget with `.catch(() => {})`. Mocking them prevents Resend API calls in tests. The raw reset token (passed as arg[2] to `sendPasswordResetEmail`) can be captured from `mock.calls[0][2]` for use in reset-password test cases. This is the only way to access the raw token since only the sha256 hash is stored in MongoDB.

### 🔵 Product — Auth AC Gaps

**[2026-06-26] | 🔵 Product | Spec | 7 missing auth edge-case ACs identified**
- Gap 1: Register duplicate email — no AC specifies 409 + EMAIL_TAKEN code
- Gap 2: Login invalid credentials — no AC on response format (anti-enumeration implied but not stated)
- Gap 3: Login unverified account — no AC specifying EMAIL_NOT_VERIFIED code
- Gap 4: POST /auth/refresh — ENTIRELY MISSING from A-001 spec. No AC for token rotation or replay rejection.
- Gap 5: Reset-password token reuse — no one-time-use AC
- Gap 6: Forgot-password non-existent email — anti-enumeration not explicitly documented
- Gap 7: Rate limiting behavior — no AC on brute-force protection
- Action: Update Feature-Ticket-List.md A-001 to add these 7 ACs in next Product background lane session.

### 🟠 AI — Vapi Webhook R&D

**[2026-06-26] | 🟠 AI | Integration | Vapi webhook events + signature verification**
- Key event types: `status-update`, `transcript`, `end-of-call-report`, `function-call`, `tool-calls`, `assistant-request`, `hang`
- Payload envelope: `{ message: { type, call, timestamp, ...type-specific-fields } }`
- Signature verification: Use HMAC-SHA256 (`X-Vapi-Signature` header). Verify against raw request body (not JSON.stringify). Store secret as `VAPI_WEBHOOK_SECRET`.
- Key L3.F1 implementation note: `assistant-request` and `tool-calls` events require synchronous JSON response. All others can respond with 200 immediately.
- Action: Design webhook handler as `POST /api/v1/webhooks/vapi` in L3.F1. Use raw body middleware for HMAC verification before JSON parsing.

### 🟡 Growth — Content

**[2026-06-26] | 🟡 Growth | Content | LinkedIn post: Indian SMBs + AI voice agents**
- Angle: 63M Indian SMBs, all running on 1-3 people, losing ₹1,200–₹45,000/day in missed calls
- CTA: "What's your biggest operational bottleneck?" (comment engagement hook)
- Status: DRAFT READY. Founder to review and post when ready.

### 🟣 Customer — KPIs

**[2026-06-26] | 🟣 Customer | Analytics | Launch KPI dashboard — 6 metric definitions**
- Activation Rate: % of users who create org + configure ≥1 agent. Target ≥40% W1. Alert <25%.
- TTFV: Median minutes from registration to first completed call. Target <30 min. Alert >45 min.
- Week-1 Retention: % of activated users with ≥1 action Days 2–7. Target ≥55%. Alert <40%.
- Call Completion Rate: % of calls reaching `status:completed`. Target ≥85%. Alert <75% any 1h window.
- MRR: Sum of active subscription amounts. Target $5k in 30 days post-launch.
- Monthly Churn: % of paying orgs cancelling per month. Target <5%. Alert ≥2 churns in any 7-day window.
- Action: Implement this as a live artifact dashboard when MCP + data tools are connected (L5).

---

## v1.3.0 — 2026-06-26 — Session: Onboarding Design Review (Steps 1 + 2)

---

### 🔵 Product — Step 1 (Connect) Design Decisions [LOCKED]

**[2026-06-26] | 🔵 Product | Design | Timezone must be visible and editable (not hidden)**
- Finding: Hiding timezone silently breaks business hours for VPN users and travelers. Auto-detect is correct as default, but user must be able to confirm and change it.
- Resolution: Timezone shown as collapsed confirm chip with `ChevronDown` toggle → expands to curated 25-timezone IANA select.
- Files changed: `ConnectPage.tsx`

**[2026-06-26] | 🔵 Product | Design | Heading frames the agent, not the org**
- Decision: Heading changed from "Connect your business" → "Let's set up your AI receptionist." Sub-heading: "First, tell us about your business."
- Rationale: Users are here to get an AI agent, not to "connect" an abstract business entity. Framing around the agent creates purpose and motivation.
- Files changed: `ConnectPage.tsx`

**[2026-06-26] | 🔵 Product | Design | Wizard personalization from Step 2**
- Decision: Layout sub-header shows "Setting up your AI agent for [Business Name]" from Step 2 onward (once the org exists in Redux). Step 1 shows no personalization.
- Files changed: `OnboardingLayout.tsx`

**[2026-06-26] | 🔵 Product | Design | Industry hint text reduces drop-off**
- Decision: Added hint below industry dropdown: "This helps your AI use the right language and terminology for your sector."
- Rationale: Unexplained required fields cause abandonment. The hint explains the value, making the choice feel purposeful.

**[2026-06-26] | 🔵 Product | Design | CTA changed to "Create my workspace →"**
- Previous: "Continue →" — generic, no weight.
- New: "Create my workspace →" — confirms the action being taken.

### 🔵 Product — Step 2 (Learn) Design Decisions [LOCKED]

**[2026-06-26] | 🔵 Product | Design | Yes/No toggle replaced with 3-path card selector**
- Finding: Original binary toggle collapsed Path B (has website, doesn't want to crawl) into Path C (no website), losing information and sending Path B users to Configure with a blank slate and no context.
- Decision: Three explicit cards: "Yes, scan my website" (Path A) / "I'll add content manually" (Path B) / "No website yet" (Path C).
- Impact: Path B users get clear Configure prompts; Path C users get contextual "describe your business" prompts; no ambiguity.
- Files changed: `LearnPage.tsx`, `onboarding.schema.ts`, `organization.model.ts`, `onboarding.service.ts`, `useAuth.ts`, `types/index.ts`

**[2026-06-26] | 🔵 Product | Design | HTTPS-only URL validation**
- Decision: Website URL must start with `https://`. `http://` URLs are rejected with error "Website URL must use HTTPS".
- Rationale: Firecrawl and most crawlers fail silently on http:// URLs (redirects, mixed-content blocks, server restrictions). Enforcing HTTPS upfront prevents users from submitting a URL and getting an empty KB with no error.
- Implementation: Zod `.refine(url => url.startsWith('https://'))` in `LearnStepSchema`; `superRefine` cross-validates `crawlEnabled=true` requires `websiteUrl`.

**[2026-06-26] | 🔵 Product | Design | "Skip" button removed; Path C is the explicit skip**
- Previous: "Skip" button sent `{ hasWebsite: false }` silently.
- New: Path C card "No website yet" achieves the same outcome but makes it an intentional, visible choice. Users understand what they're skipping and why.

**[2026-06-26] | 🔵 Product | Design | Crawl queued at Step 2 submit, not at Activate**
- Decision: BullMQ crawl job fires immediately when user submits Path A. `KnowledgeBase` record created with `status: 'crawling'`.
- Rationale: Crawl takes 30–120s. If queued at Activate, users sit watching a spinner during the most important moment. Queuing at Step 2 means the crawl is likely complete before they reach Step 5.
- Status: L2.F5 scope (KB module). Placeholder noted in ActivatePage and Step 3 Configure.

### 🟢 Engineering — Schema Changes

**[2026-06-26] | 🟢 Engineering | Schema | Organization.crawlEnabled added**
- New field: `crawlEnabled: Boolean, default: false` on `OrganizationModel` and `IOrganization` interface.
- Frontend: Added to `Organization` interface in `types/index.ts`; `RawOrg` in `useAuth.ts`; `mapRawOrg()` default = false.
- Backend: `onboarding.schema.ts` LearnStepSchema; `onboarding.service.ts` learn branch.

**[2026-06-26] | 🟢 Engineering | Testing | New test cases AT6.8b, AT6.8c, AT6.8d added**
- AT6.8: Updated to Path A (crawlEnabled=true + URL) — verifies `crawlEnabled: true` in DB
- AT6.8b: Path B (hasWebsite=true, crawlEnabled=false) — verifies no crawl, no URL required
- AT6.8c: crawlEnabled=true + no URL → 400 VALIDATION_ERROR (superRefine)
- AT6.8d: http:// URL → 400 VALIDATION_ERROR (HTTPS refine)
- AT6.9: Updated to Path C (hasWebsite=false, crawlEnabled=false) — explicit

### 🟠 AI — Crawl Integration Notes

**[2026-06-26] | 🟠 AI | Architecture | Crawl-to-Configure auto-population pipeline (L2.F5 scope)**
- After Path A crawl completes, pipeline extracts:
  - `businessDescription` ← About/Home page first 2 paragraphs
  - `services[]` ← service/product headings
  - `contactDetails.email` ← mailto links
  - `contactDetails.phone` ← tel links
  - `businessHours` ← `schema.org/OpeningHoursSpecification` structured data if present
- These become editable pre-populated suggestions in Step 3 (Configure).
- Also: run GPT-4o industry classification on crawl text; surface soft prompt if it differs from Step 1 selection.
- Action: Design KB pipeline and Configure pre-population API in L2.F5.

### 🟣 Customer — Path Distribution Hypothesis

**[2026-06-26] | 🟣 Customer | Analytics | Expected path distribution for Indian SMB ICP**
- Hypothesis: Path A ~60%, Path B ~15%, Path C ~25%.
- India has high mobile-first usage; many SMBs have a website but it may be low-quality or inaccessible. Path B uptake may be higher than expected.
- Action: Track `Organization.crawlEnabled` as a segment split in analytics from Day 1. If Path A < 50%, investigate crawl failure rate and URL validation UX.

---

## v1.3.0 — 2026-06-26 — Session: L2.F3 Backend + L2.F4 Wizard Pages

---

### 🔵 Product — T0 Decisions Locked

**[2026-06-26] | 🔵 Product | Decision | Org limit per user = 1 during onboarding**
- Decision: 1 org maximum per user enforced at service layer via `MembershipModel.findOne({ userId, role: 'Owner' })`. Throws `Conflict` with code `ORG_LIMIT_REACHED` on second attempt.
- Rationale: Prevents test orgs polluting production data; single clear activation path; multiple orgs unlocked in Settings (T5.3).

**[2026-06-26] | 🔵 Product | Decision | Industry field = predefined dropdown (11 options)**
- Final list: Technology, Healthcare, Real Estate, Logistics & Delivery, Finance & BFSI, Education & EdTech, Retail, Hospitality & Food, Legal, Manufacturing, Other.
- Synced in: `backend/src/modules/onboarding/onboarding.schema.ts` (Zod enum) AND `frontend/src/features/onboarding/ConnectPage.tsx` (select options). Change both or neither.

**[2026-06-26] | 🔵 Product | Decision | Timezone = auto-detected from browser (never shown)**
- Detection: `Intl.DateTimeFormat().resolvedOptions().timeZone` in `useEffect` on ConnectPage mount.
- Fallback: `'Asia/Kolkata'` if Intl API unavailable.
- Transport: Sent as hidden field in POST body. User never sees this field.

### 🟢 Engineering — L2.F3 Implementation Notes

**[2026-06-26] | 🟢 Engineering | Architecture | No validateOrganization middleware for onboarding endpoints**
- Decision: Onboarding PATCH/complete endpoints resolve org via `MembershipModel.findOne({ userId, role: 'Owner' })` directly — NOT via `X-Organization-ID` header.
- Rationale: During onboarding steps 2-4, the frontend may not yet have set up the org header. Service-layer lookup is simpler and correct for the single-org onboarding use case. Header-based lookup is used for all post-onboarding routes.

**[2026-06-26] | 🟢 Engineering | Slug Generation | toSlugBase + generateUniqueSlug pattern**
- `toSlugBase`: NFKD normalize → strip diacritics → remove non-alnum → collapse hyphens → trim edges.
- `generateUniqueSlug`: Appends `-1`, `-2`, … up to 20 attempts. Fails with `DUPLICATE_SLUG` after 20.
- Edge case: All-special-char name (e.g. "!!!!") → base is `''` → slug defaults to `'org'`.
- Tested: 5 unit test cases for `toSlugBase()` + 2 integration cases for uniqueness collision handling.

**[2026-06-26] | 🟢 Engineering | Testing | onboarding.test.ts pattern (15 tests)**
- Same Redis mock pattern as auth.test.ts (in-memory Map).
- `createUserAndToken(suffix)` creates user directly via `UserModel.create()` + `signAccessToken()` — no HTTP round-trip.
- DB state verified in AT6.1 (org + membership + session) and AT6.14 (COMPLETED status + session stepStatus).

### 🟢 Engineering — L2.F4 Implementation Notes

**[2026-06-26] | 🟢 Engineering | Frontend | mapRawOrg() helper in useAuth.ts**
- Backend returns `_id` (Mongoose default). Frontend `Organization` type uses `id`. `mapRawOrg()` handles this mapping and sets defaults for optional fields (timezone, supportedLanguages, businessHours).
- All 3 new hooks (`createOrg`, `updateOnboardingStep`, `completeOnboarding`) call `mapRawOrg()` and update both `availableOrgs` and `currentOrg` in Redux to keep OrgGuard in sync.

**[2026-06-26] | 🟢 Engineering | Frontend | ConfigurePage useFieldArray for services tags**
- Services are entered as a tag/chip UI: type in input → press Enter or "Add" button → appends to RHF field array → displayed as dismissible chips. Max 20 services, 100 chars each.
- RHF `useFieldArray` manages the array; the raw `newService` input state is separate (not registered in form).

**[2026-06-26] | 🟢 Engineering | Frontend | CustomizePage checkbox pattern**
- Language selection uses button-based toggle cards rather than native checkboxes. `setValue('supportedLanguages', next)` called manually. Hidden `<input type="hidden" {...register('supportedLanguages')} />` keeps RHF in sync.
- Validation: Zod `.min(1)` enforced — at least one language required.

### 🟠 AI — ActivatePage Scope

**[2026-06-26] | 🟠 AI | Scope | Vapi sandbox widget deferred to L3**
- ActivatePage (L2.F4) contains a placeholder card: "Live test calls via Vapi will be available in the next release."
- When L3.F2 ships: replace placeholder with `<VapiSandboxWidget />` that calls `POST /api/v1/onboarding/voice-agent/test-call` and streams call status back.
- Current "Launch" CTA calls `POST /api/v1/onboarding/complete` directly — no Vapi dependency.

### 🟣 Customer — Onboarding Flow Friction Notes

**[2026-06-26] | 🟣 Customer | UX | LearnPage + ConfigurePage have Skip options**
- LearnPage: "Skip" sends `{ step: 'learn', hasWebsite: false }` — org proceeds without website crawl.
- ConfigurePage: "Skip" sends `{ step: 'configure' }` with no body fields — all optional fields stay empty.
- CustomizePage: No skip — language selection is required (min 1). Default selection is `en-US`.
- Implication: A user can complete onboarding in <30 seconds by skipping Learn + Configure. TTFV metric starts from org creation completion (ConnectPage submit), not from the Activate CTA click.
