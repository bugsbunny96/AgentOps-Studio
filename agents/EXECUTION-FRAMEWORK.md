# AgentOps Studio — Execution Framework
# Multi-Layer WBS · Worker Assignment · Dependency Graph · Parallel Execution

> Version: 1.0.0 | Owner: CEO Agent | Last Updated: 2026-06-26
> This document is the single source of truth for ALL work decomposition.
> Read at session start. Update after every completed feature.

---

## 1. MULTI-LAYER WORK BREAKDOWN STRUCTURE (WBS)

Hierarchy: `EPIC → FEATURE → MODULE → TASK → SUBTASK → MICRO TASK → ATOMIC TASK`

Each Atomic Task (AT) is sized for one AI query. ID format: `L[layer].F[feature].M[module].AT[n]`

---

### LEGEND

| Symbol | Meaning |
|---|---|
| ✅ | Complete |
| 🔄 | In Progress |
| ⏳ | Pending |
| ❌ | Blocked |
| 🔁 | R&D / Background |

---

## EPIC 1 — Platform Foundation ✅ COMPLETE

| ID | Module | Atomic Task | Owner | Status |
|---|---|---|---|---|
| L1.F1.M1.AT1 | Backend scaffold | Express + TS + env + logger | 🟢 Eng | ✅ |
| L1.F1.M1.AT2 | Backend scaffold | MongoDB + Redis + BullMQ config | 🟢 Eng | ✅ |
| L1.F1.M1.AT3 | Backend scaffold | Error handler + rate limiter + /health | 🟢 Eng | ✅ |
| L1.F1.M2.AT1 | Frontend scaffold | React 19 + Vite + TailwindCSS 4 + Redux + TanStack | 🟢 Eng | ✅ |
| L1.F1.M2.AT2 | Frontend scaffold | Guards + Layouts + Route structure | 🟢 Eng | ✅ |
| L1.F1.M2.AT3 | Frontend scaffold | 15 placeholder feature pages | 🟢 Eng | ✅ |
| L1.F1.M3.AT1 | DevOps | Dockerfile multi-stage + docker-compose | 🟢 Eng | ✅ |
| L1.F1.M3.AT2 | DevOps | GitHub Actions CI + deploy workflows | 🟢 Eng | ✅ |
| L1.F1.M4.AT1 | Layer 1 Tests | Backend: health + errorHandler + env + rateLimiter + logger | 🟢 Eng | ✅ |
| L1.F1.M4.AT2 | Layer 1 Tests | Frontend: authSlice + orgSlice + cn + guards | 🟢 Eng | ✅ |
| L1.F1.M4.AT3 | Layer 1 Tests | E2E: Playwright setup + auth page navigation | 🟢 Eng | ✅ |

---

## EPIC 2 — Identity & Onboarding 🔄 IN PROGRESS

### Feature 2.1 — Authentication Module ✅ COMPLETE

| ID | Module | Atomic Task | Owner | Status |
|---|---|---|---|---|
| L2.F1.M1.AT1 | Backend Auth | User model + Mongoose schema | 🟢 Eng | ✅ |
| L2.F1.M1.AT2 | Backend Auth | Organization + Membership + Invitation + OnboardingSession models | 🟢 Eng | ✅ |
| L2.F1.M1.AT3 | Backend Auth | JWT utils (sign, verify, rotate) | 🟢 Eng | ✅ |
| L2.F1.M1.AT4 | Backend Auth | Email utils (Resend + dev fallback) | 🟢 Eng | ✅ |
| L2.F1.M1.AT5 | Backend Auth | Auth service: register + verifyEmail + login | 🟢 Eng | ✅ |
| L2.F1.M1.AT6 | Backend Auth | Auth service: refreshTokens + logout + getMe | 🟢 Eng | ✅ |
| L2.F1.M1.AT7 | Backend Auth | Auth service: forgotPassword + resetPassword | 🟢 Eng | ✅ |
| L2.F1.M1.AT8 | Backend Auth | Auth routes + controllers (8 endpoints) | 🟢 Eng | ✅ |
| L2.F1.M1.AT9 | Backend Auth | authenticate middleware + validateOrganization middleware | 🟢 Eng | ✅ |
| L2.F1.M2.AT1 | Frontend Auth | Redux authSlice + orgSlice | 🟢 Eng | ✅ |
| L2.F1.M2.AT2 | Frontend Auth | useAuth hook (verifySession, login, logout) | 🟢 Eng | ✅ |
| L2.F1.M2.AT3 | Frontend Auth | AuthGuard + GuestGuard + OrgGuard | 🟢 Eng | ✅ |
| L2.F1.M2.AT4 | Frontend Auth | LoginPage (RHF + Zod) | 🟢 Eng | ✅ |
| L2.F1.M2.AT5 | Frontend Auth | RegisterPage (RHF + Zod + strength indicator) | 🟢 Eng | ✅ |
| L2.F1.M2.AT6 | Frontend Auth | ForgotPasswordPage (RHF + Zod) | 🟢 Eng | ✅ |
| L2.F1.M2.AT7 | Frontend Auth | Axios interceptor (cookie-based, no reload loop) | 🟢 Eng | ✅ |
| L2.F1.M2.AT8 | Frontend Auth | TypeScript types: User, Organization, Membership, VoiceAgent, Call | 🟢 Eng | ✅ |

---

### Feature 2.2 — Auth Test Suite ← ACTIVE SPRINT

**Prerequisites**: L2.F1 complete ✅  
**Blocks**: L2.F3 (cannot start Org Creation until auth tests green)

#### Module 2.2.1 — Backend Integration Tests

| ID | Atomic Task | Owner | Status | Done Condition |
|---|---|---|---|---|
| **L2.F2.M1.AT1** | Create `auth.test.ts` — test DB setup (beforeAll/afterAll, connect MongoDB, clear collections) | 🟢 Eng | ⏳ | Clean setup/teardown runs without errors |
| **L2.F2.M1.AT2** | POST /auth/register — happy path (201 + user created + email queued) | 🟢 Eng | ⏳ | Assertion: status 201, body.success true, user in DB |
| **L2.F2.M1.AT3** | POST /auth/register — error cases (duplicate email 409, weak password 400, missing fields 400) | 🟢 Eng | ⏳ | All 3 error shapes correct |
| **L2.F2.M1.AT4** | POST /auth/verify-email — happy path (200 + user.isVerified=true + user.status=Active) | 🟢 Eng | ⏳ | Token consumed, user activated |
| **L2.F2.M1.AT5** | POST /auth/verify-email — error cases (invalid token 400, expired token 400) | 🟢 Eng | ⏳ | Both error shapes correct |
| **L2.F2.M1.AT6** | POST /auth/login — happy path (200 + HttpOnly cookies set + user + orgs returned) | 🟢 Eng | ⏳ | Cookies present in response |
| **L2.F2.M1.AT7** | POST /auth/login — error cases (wrong password 401, unverified 401, suspended 403, not found 401) | 🟢 Eng | ⏳ | All 4 error shapes + codes correct |
| **L2.F2.M1.AT8** | POST /auth/refresh — happy path (200 + new cookies set, old tokenId rotated in Redis) | 🟢 Eng | ⏳ | Token rotation verified |
| **L2.F2.M1.AT9** | POST /auth/refresh — error cases (no cookie 401, invalid token 401, tokenId not in Redis 401) | 🟢 Eng | ⏳ | All 3 cases handled |
| **L2.F2.M1.AT10** | GET /auth/me — happy path (200 + user data + organizations) | 🟢 Eng | ⏳ | Correct user shape returned |
| **L2.F2.M1.AT11** | GET /auth/me — error (no cookie 401, expired token 401) | 🟢 Eng | ⏳ | Both cases correct |
| **L2.F2.M1.AT12** | POST /auth/logout — clears cookies + removes tokenId from Redis | 🟢 Eng | ⏳ | Redis key gone, cookies cleared |
| **L2.F2.M1.AT13** | POST /auth/forgot-password — anti-enumeration (always 200 regardless of email existence) | 🟢 Eng | ⏳ | Same response for valid/invalid email |
| **L2.F2.M1.AT14** | POST /auth/reset-password — happy path + error (expired token, already used) | 🟢 Eng | ⏳ | Password changed, token invalidated |

#### Module 2.2.2 — Middleware Tests

| ID | Atomic Task | Owner | Status | Done Condition |
|---|---|---|---|---|
| **L2.F2.M2.AT1** | Create `middleware.test.ts` — authenticate middleware (valid token, expired, malformed, missing) | 🟢 Eng | ⏳ | req.userId populated on success; 401 on all failures |
| **L2.F2.M2.AT2** | validateOrganization middleware (valid header + membership, no header, invalid org, not a member) | 🟢 Eng | ⏳ | req.orgId + req.userRole populated; 400/403 on failures |

#### Module 2.2.3 — E2E Flow Tests

| ID | Atomic Task | Owner | Status | Done Condition |
|---|---|---|---|---|
| **L2.F2.M3.AT1** | E2E: `auth-flow.spec.ts` — register → check success screen → verify email (mock token) → login → dashboard redirect | 🟢 Eng | ⏳ | Full flow passes in Playwright |
| **L2.F2.M3.AT2** | E2E: Forgot password form → success state renders | 🟢 Eng | ⏳ | Playwright assertion passes |

---

### Feature 2.3 — Org Creation (Backend) ⏳ QUEUED

**Prerequisites**: L2.F2 (auth tests green) ✅  
**Blocks**: L2.F4 (Onboarding Wizard Frontend)

#### Module 2.3.1 — Org Creation Endpoint

| ID | Atomic Task | Owner | Status | Done Condition |
|---|---|---|---|---|
| **L2.F3.M1.AT1** | 🔵 Product: Write org creation spec — AC for POST /api/v1/onboarding/org (name, slug, timezone, industry, hasWebsite), slug collision rules, onboarding session creation | 🔵 Product | ⏳ | AC written, edge cases documented |
| **L2.F3.M1.AT2** | Organization service: createOrg (org + Membership as Owner + OnboardingSession) | 🟢 Eng | ⏳ | Blocked on AT1 spec |
| **L2.F3.M1.AT3** | Slug generation: auto-slug from name + collision prevention (append -2, -3, etc.) | 🟢 Eng | ⏳ | Slug uniqueness enforced |
| **L2.F3.M1.AT4** | Organization routes + controllers: POST /api/v1/onboarding/org | 🟢 Eng | ⏳ | Endpoint returns 201 + org + session |
| **L2.F3.M1.AT5** | Org creation integration tests: org.test.ts (happy path, slug collision, missing fields, auth required) | 🟢 Eng | ⏳ | All cases pass |
| **L2.F3.M1.AT6** | 🟠 AI: Document Vapi assistant provisioning trigger — when in onboarding flow does Vapi assistant get created? (Input for T2.5) | 🟠 AI | ⏳ | Decision documented in TASK-BOARD.md |

---

### Feature 2.4 — Onboarding Wizard (Frontend) ⏳ QUEUED

**Prerequisites**: L2.F3 (org creation BE) + OnboardingLayout already scaffolded  
**Blocks**: L2.F5 (Knowledge Base)

| ID | Atomic Task | Owner | Status | Done Condition |
|---|---|---|---|---|
| **L2.F4.M1.AT1** | 🔵 Product: Spec onboarding wizard — all 5 steps AC, step transition rules, hasWebsite branch logic | 🔵 Product | ⏳ | Full AC for all steps |
| **L2.F4.M1.AT2** | OnboardingLayout: stepper component (5 steps, active/complete/locked states) | 🟢 Eng | ⏳ | Visual stepper renders |
| **L2.F4.M1.AT3** | Step 0 — OrgCreationPage: form (name, slug auto-gen, timezone picker, industry select, hasWebsite toggle) | 🟢 Eng | ⏳ | Form submits to org endpoint; transitions to step 1 |
| **L2.F4.M1.AT4** | Step 1 — ConnectPage: website URL input + validate URL format + POST to crawl trigger | 🟢 Eng | ⏳ | URL submitted; moves to Learn step |
| **L2.F4.M1.AT5** | Step 2 — LearnPage: crawl progress UI (polling crawl job status from backend) | 🟢 Eng | ⏳ | Shows processing → complete states |
| **L2.F4.M1.AT6** | Step 3 — ConfigurePage: business hours (open/close per day), FAQ list (add/remove), contact info | 🟢 Eng | ⏳ | Config saved to org record |
| **L2.F4.M1.AT7** | Step 4 — CustomizePage: agent name, language selection (EN/HI/PA), voice selection (ElevenLabs voices) | 🟢 Eng | ⏳ | Voice agent config saved |
| **L2.F4.M1.AT8** | Step 5 — ActivatePage: VapiSandbox component + "Make Test Call" button + success/fail state | 🟢 Eng | ⏳ | Test call triggers and result shown |
| **L2.F4.M1.AT9** | Onboarding orgSlice actions: setOnboardingStep + setTempOrgId + step persistence | 🟢 Eng | ⏳ | Redux state persists step across refresh |
| **L2.F4.M1.AT10** | Onboarding frontend tests: step rendering, transitions, form validation | 🟢 Eng | ⏳ | All step component tests pass |

---

### Feature 2.5 — Knowledge Base ⏳ QUEUED

**Prerequisites**: L2.F4 (ConnectPage triggers crawl)  
**Blocks**: L3 (RAG pipeline needs KB documents)

| ID | Atomic Task | Owner | Status | Done Condition |
|---|---|---|---|---|
| **L2.F5.M1.AT1** | 🔵 Product: KB spec (document list AC, upload AC, re-sync AC, viewer AC) | 🔵 Product | ⏳ | AC complete |
| **L2.F5.M1.AT2** | Document model: `documents` collection (title, content, sourceUrl, type, status, crawledAt) | 🟢 Eng | ⏳ | Schema + indexes created |
| **L2.F5.M1.AT3** | POST /api/v1/knowledge-base — upload/add document (URL or manual text) | 🟢 Eng | ⏳ | Document created, crawl job queued |
| **L2.F5.M1.AT4** | GET /api/v1/knowledge-base — list documents with status, pagination | 🟢 Eng | ⏳ | Returns paginated document list |
| **L2.F5.M1.AT5** | DELETE /api/v1/knowledge-base/:id + re-sync POST /api/v1/knowledge-base/:id/sync | 🟢 Eng | ⏳ | Delete and sync endpoints functional |
| **L2.F5.M1.AT6** | BullMQ crawl job: Firecrawl API integration + store chunks to DB | 🟢 Eng | ⏳ | Crawl job processes URL, stores content |
| **L2.F5.M1.AT7** | BullMQ summarization job: GPT-4o summary of crawled content | 🟢 Eng | ⏳ | Summary stored on document record |
| **L2.F5.M2.AT1** | KnowledgeBasePage: document list table + upload modal + status badges | 🟢 Eng | ⏳ | UI renders document list |
| **L2.F5.M2.AT2** | DocumentViewer: expandable content panel + re-sync button | 🟢 Eng | ⏳ | View and re-sync UI works |
| **L2.F5.M2.AT3** | KB frontend tests | 🟢 Eng | ⏳ | Tests pass |

---

### Feature 2.6 — Team Management ⏳ QUEUED

**Prerequisites**: L2.F3 (org exists)

| ID | Atomic Task | Owner | Status | Done Condition |
|---|---|---|---|---|
| **L2.F6.M1.AT1** | 🔵 Product: Team management spec (invite flow AC, role permissions, expiry rules) | 🔵 Product | ⏳ | AC complete |
| **L2.F6.M1.AT2** | POST /api/v1/org/invite — send invitation email (token TTL 7d, Invitation model) | 🟢 Eng | ⏳ | Invite sent, token stored |
| **L2.F6.M1.AT3** | GET /api/v1/org/members — list members with roles | 🟢 Eng | ⏳ | Returns membership list |
| **L2.F6.M1.AT4** | DELETE /api/v1/org/members/:userId — remove member (Owner/Admin only) | 🟢 Eng | ⏳ | Membership removed |
| **L2.F6.M1.AT5** | POST /api/v1/accept-invite/:token — accept invite (register if new, link to org) | 🟢 Eng | ⏳ | User linked to org, redirect to login |
| **L2.F6.M1.AT6** | checkRole middleware (Owner/Admin only routes) | 🟢 Eng | ⏳ | 403 for insufficient role |
| **L2.F6.M2.AT1** | TeamPage: member list table + invite modal + role badges | 🟢 Eng | ⏳ | UI functional |
| **L2.F6.M2.AT2** | AcceptInvitePage: token validation + register/login flow | 🟢 Eng | ⏳ | Accept flow works |
| **L2.F6.M2.AT3** | Team + invite integration tests | 🟢 Eng | ⏳ | Tests pass |

---

### Feature 2.7 — Layer 2 QA Sign-off ⏳ QUEUED

**Prerequisites**: All L2.F2-F6 complete

| ID | Atomic Task | Owner | Status | Done Condition |
|---|---|---|---|---|
| **L2.F7.M1.AT1** | Full regression: npm test backend + frontend, tsc --noEmit both | 🟢 Eng | ⏳ | Zero failures, zero TS errors |
| **L2.F7.M1.AT2** | E2E: full register → verify → login → org creation → onboarding → dashboard | 🟢 Eng | ⏳ | Playwright full flow passes |
| **L2.F7.M1.AT3** | 🟣 Customer: Define Layer 2 activation metrics + update 7-day plan | 🟣 Customer | ⏳ | Metrics documented |
| **L2.F7.M1.AT4** | Git: commit + push all Layer 2 work | 🟢 Eng | ⏳ | PR merged to dev |

---

## EPIC 3 — Voice AI Infrastructure ⏳ (Layer 3)

**Prerequisite**: Epic 2 complete + Exotel account verified + Vapi API key provisioned

### Feature-Level Breakdown (will be atomized when sprint begins)

| Feature | Description | Primary Agent | Blocked By |
|---|---|---|---|
| F3.1 — Voice Agent CRUD | voice_agents schema + CRUD endpoints + UI | 🟢 Eng + 🔵 Product | L2 complete |
| F3.2 — Exotel SIP | DID number setup + SIP trunk → Vapi | 🟠 AI | Exotel account |
| F3.3 — Vapi Integration | Vapi SDK + assistant provisioning + webhook receiver | 🟠 AI + 🟢 Eng | Vapi API key |
| F3.4 — Multi-lingual | EN/HI/PA auto-detect + TTS voice per language | 🟠 AI | Vapi integration |
| F3.5 — Business Hours | Routing rules + fallback webhook | 🟢 Eng | Vapi integration |
| F3.6 — System Prompt v1.0 | Base voice agent persona prompt | 🟠 AI | Vapi integration |
| F3.QA — Layer 3 Tests | voiceAgent.test.ts + vapiWebhook.test.ts + eval harness v1 | 🟢 Eng + 🟠 AI | All F3 complete |

---

## EPIC 4 — Intelligence Pipeline ⏳ (Layer 4)

**Prerequisite**: Epic 3 complete (calls must be happening)

| Feature | Description | Primary Agent |
|---|---|---|
| F4.1 — Call Logging | Call model + recording metadata | 🟢 Eng |
| F4.2 — Transcripts | Transcript aggregator + TranscriptViewer component | 🟢 Eng |
| F4.3 — Post-Call Pipeline | BullMQ GPT-4o summarization job | 🟠 AI + 🟢 Eng |
| F4.4 — Call Log UI | Paginated table + filter bar | 🟢 Eng |
| F4.QA — Layer 4 Tests | calls.test.ts + BullMQ job mocks | 🟢 Eng |

---

## EPIC 5 — Observability & Launch ⏳ (Layer 5)

**Prerequisite**: Epic 4 complete

| Feature | Description | Primary Agent |
|---|---|---|
| F5.1 — Analytics Dashboard | MongoDB aggregation + Recharts widgets | 🟢 Eng + 🟣 Customer |
| F5.2 — Audit Log | Immutable audit hooks + collection | 🟢 Eng |
| F5.3 — Settings Page | Workspace settings UI | 🟢 Eng |
| F5.4 — Production Deploy | AWS ECS + Vercel + env secrets | 🟢 Eng |
| F5.5 — KPI Dashboard | CEO-level ARR/churn/adoption view | 🟣 Customer |
| F5.6 — Launch Content | Product page + LinkedIn + email sequence | 🟡 Growth |
| F5.QA — Full Regression | Coverage report + load test | 🟢 Eng |

---

## 2. WORKER ASSIGNMENT MATRIX

For each Atomic Task category, this matrix shows WHO does WHAT:

| Task Category | 🔵 Product | 🟢 Engineering | 🟠 AI | 🟡 Growth | 🟣 Customer |
|---|---|---|---|---|---|
| **Auth tests** | ✓ Verify AC testability | ✓ PRIMARY: write + run all tests | ✓ Confirm no AI surface | ✓ R&D: content on quality | ✓ R&D: KPI snapshot |
| **Org creation BE** | ✓ PRIMARY: write spec + AC | ✓ Implement endpoint | ✓ Document Vapi trigger point | ✓ R&D: onboarding copy | ✓ Define activation metric |
| **Onboarding wizard** | ✓ PRIMARY: step-by-step spec | ✓ Implement all pages | ✓ PRIMARY (Step 5): VapiSandbox | ✓ Write onboarding UX copy | ✓ Map to 7-day activation plan |
| **Knowledge Base** | ✓ PRIMARY: KB spec + AC | ✓ Implement KB CRUD + jobs | ✓ PRIMARY: RAG pipeline design | ✓ R&D: KB feature positioning | ✓ Define KB adoption metric |
| **Team management** | ✓ PRIMARY: RBAC spec | ✓ Implement invite + membership | ✓ R&D: security review | ✓ Invite flow as upsell copy | ✓ Support doc for invites |
| **Voice agent CRUD** | ✓ PRIMARY: voice spec, fields | ✓ Schema + CRUD endpoints | ✓ PRIMARY: Vapi provisioning | ✓ Voice feature positioning | ✓ Call quality KPI definition |
| **Exotel/Vapi setup** | ✓ R&D: spec for voice flows | ✓ Webhook plumbing | ✓ PRIMARY: all voice config | ✓ R&D: voice AI market | ✓ Track call quality metrics |
| **Analytics/KPIs** | ✓ Use data for RICE | ✓ Dashboard implementation | ✓ AI accuracy metrics | ✓ Funnel metrics | ✓ PRIMARY: KPI report |
| **Any infra** | ✓ R&D: spec gaps | ✓ PRIMARY: infra work | ✓ R&D: latency impact | ✓ R&D: perf as differentiator | ✓ Uptime customer impact |
| **R&D session** | ✓ UX patterns + backlog | ✓ Security + tech debt | ✓ AI/voice API updates | ✓ Competitor analysis | ✓ CS frameworks + retention |

---

## 3. TASK DEPENDENCY GRAPH

```
L1.F1 Platform Foundation (DONE)
  └─────────────────────────────────────────────────────────────┐
                                                                 ▼
                                                    L2.F1 Auth Module (DONE)
                                                                 │
                                              ┌──────────────────┘
                                              ▼
                                    L2.F2 Auth Tests ← ACTIVE
                                              │
                              ┌───────────────┘
                              ▼
                    L2.F3 Org Creation BE
                     (Requires: L2.F2 ✅)
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
          L2.F4 Onboarding        L2.F6 Team Mgmt
          Wizard FE                (Parallel OK)
          (Requires: L2.F3)
                    │
                    ▼
          L2.F5 Knowledge Base
          (Requires: L2.F4 Connect step)
                    │
                    ▼
          L2.F7 Layer 2 QA Sign-off
          (Requires: All L2 features)
                    │
                    ├── Exotel verified ← FOUNDER ACTION
                    ├── Vapi API key   ← FOUNDER ACTION
                    ▼
          L3 Voice AI Infrastructure
                    │
                    ▼
          L4 Intelligence Pipeline
                    │
                    ▼
          L5 Observability & Launch
```

### Blocking Dependencies (immediate)

| Blocked Task | Blocked By | Status |
|---|---|---|
| L2.F3.M1.AT2 (Org BE impl) | L2.F3.M1.AT1 (Product spec) | ❌ Spec not written |
| L2.F3.M1.AT2 (Org BE impl) | L2.F2 (Auth tests green) | ⏳ Tests not written |
| L2.F4 (Onboarding FE) | L2.F3 (Org BE endpoint) | ⏳ Waiting on L2.F3 |
| L3 (Voice AI) | L2 fully complete + Exotel + Vapi | ❌ Founder action required |

---

## 4. PARALLEL EXECUTION PLAN

### Current Sprint — L2.F2 Auth Tests

All 5 agents work THIS session:

```
🔵 PRODUCT   → Review all auth AC in Feature-Ticket-List.md for testability gaps;
               flag any AC that can't be asserted in an integration test
               Secondary: RICE-rescore L2.F3 vs L2.F6 (which to prioritize after tests)

🟢 ENGINEERING → PRIMARY: Write L2.F2.M1.AT1 through L2.F2.M1.AT14 (auth.test.ts)
                  Then: L2.F2.M2.AT1-AT2 (middleware.test.ts)
                  Then: L2.F2.M3.AT1-AT2 (auth-flow E2E)
                  QA Gate: npm test + tsc --noEmit both green

🟠 AI AGENT  → R&D: Research Vapi SDK v2 latest changes; document any breaking
               changes vs what we'll implement in T2.5
               Secondary: Audit RAG approach — compare MongoDB Atlas Vector Search
               vs Pinecone vs Qdrant for our use case (cost + latency + India hosting)

🟡 GROWTH    → R&D: Research top 3 competitors (Bland.ai, Retell.ai, Synthflow.ai)
               — what features did they ship in last 30 days? Any pricing changes?
               Draft 1 LinkedIn post: "Why we're building AI voice agents for Indian SMBs"

🟣 CUSTOMER  → R&D: Define the complete KPI dashboard we need at launch:
               - Which metrics matter in the first 30 days post-launch?
               - What does "activation" mean exactly? (Day 3 or Day 5 milestone?)
               - Draft the first monthly customer report template
```

### Next Sprint — L2.F3 Org Creation

Once L2.F2 tests are green, immediately dispatch:

```
🔵 PRODUCT   → PRIMARY: Write L2.F3.M1.AT1 (org creation spec + AC)
🟢 ENGINEERING → PRIMARY: L2.F3.M1.AT2-AT5 (org endpoint implementation)
🟠 AI AGENT  → PRIMARY: L2.F3.M1.AT6 (Vapi trigger documentation)
🟡 GROWTH    → Write onboarding completion email ("Your AI agent is ready")
🟣 CUSTOMER  → Define org activation milestone → update 7-day plan
```

---

## 5. CONTINUOUS R&D WORKFLOW

R&D runs automatically when an agent has no primary implementation task.

### R&D Assignment Queue (Pull from top when idle)

#### 🔵 Product R&D Queue
| Priority | Topic | Output |
|---|---|---|
| 1 | Onboarding UX: study how Linear/Intercom/Vapi onboard first user in <10 min | Friction reduction spec |
| 2 | Feature gap: what does Retell.ai offer that we don't in the roadmap? | Feature backlog additions |
| 3 | Pricing model research: per-minute vs per-agent vs seat-based for Indian market | Pricing input for CEO |
| 4 | User journey map: new customer Day 0 → Day 7 → Day 30 | Journey map doc |
| 5 | Mobile-first considerations: Indian SMB users likely on mobile | Mobile spec requirements |

#### 🟢 Engineering R&D Queue
| Priority | Topic | Output |
|---|---|---|
| 1 | Security audit: OWASP Top 10 — which items does our current stack address? | Security gap report |
| 2 | MongoDB Atlas Vector Search vs Pinecone for RAG | Architecture decision |
| 3 | Node.js 22 LTS migration readiness (we're on 20) | Migration timeline |
| 4 | BullMQ v5 new features vs our BullMQ version | Upgrade decision |
| 5 | Docker image size optimization (multi-stage build review) | Optimized Dockerfile |
| 6 | Rate limiting strategy: should we use Redis-backed sliding window? | ADR |

#### 🟠 AI R&D Queue
| Priority | Topic | Output |
|---|---|---|
| 1 | Vapi SDK v2 changelog — breaking changes for our planned integration | Integration notes |
| 2 | Deepgram Nova-3 vs Nova-2: accuracy improvement for Hindi/Punjabi? | Model decision |
| 3 | GPT-4o vs Claude 3.5 Sonnet for voice agent LLM: latency + cost comparison | LLM decision |
| 4 | ElevenLabs v3 API changes | Integration notes |
| 5 | RAG: chunk size experiments for customer support KB (512 vs 1024 tokens) | Chunk size recommendation |
| 6 | Prompt caching with Anthropic API: cost savings for long system prompts | Cost optimization |
| 7 | Multi-lingual TTS: which voices support Hindi/Punjabi natively in 2026? | Voice selection guide |

#### 🟡 Growth R&D Queue
| Priority | Topic | Output |
|---|---|---|
| 1 | Competitor analysis: Bland.ai, Retell.ai, Synthflow.ai, Vapi (product), AirCall AI | Competitor brief update |
| 2 | India B2B SaaS pricing benchmarks 2026 | Pricing research note |
| 3 | LinkedIn content strategy for AI/voice niche in India | Content calendar |
| 4 | Cold outreach sequences that work for Indian SMB founders | Outbound sequence draft |
| 5 | Product Hunt launch strategy for AI voice agent tools | Launch checklist |
| 6 | Case study template: "How [Company] reduced missed calls by X% with AgentOps" | CS template |

#### 🟣 Customer R&D Queue
| Priority | Topic | Output |
|---|---|---|
| 1 | Define complete KPI dashboard for launch monitoring | KPI framework doc |
| 2 | Customer health score formula validation: is 0.4/0.4/0.2 weighting right? | Health score v2 |
| 3 | Onboarding email sequence: Day 0, Day 1, Day 3, Day 7 messages | Email sequence |
| 4 | Support doc template library: 10 most common voice AI questions | Support doc set |
| 5 | NPS survey design for voice AI platform | NPS template |
| 6 | Churn early warning signals specific to voice AI SaaS | Churn signal playbook |

---

## 6. DOCUMENTATION UPDATE WORKFLOW

### Trigger → Doc → Version

When a trigger event occurs, this is the exact update to make:

```
Trigger: New API endpoint added
→ Update: main-project-docs/Technical-Architecture-Document.md
→ Append under section "API Endpoints" with:
   ## v[X.Y.Z] — [DATE] — 🟢 Engineering
   - ADDED: [METHOD] [path] — [description]

Trigger: Feature spec written
→ Update: main-project-docs/Feature-Ticket-List.md
→ Append new ticket with A-NNN format

Trigger: Architecture decision made
→ Create: main-project-docs/ADRs/ADR-NNN.md
→ Use ADR format from engineering-agent.md

Trigger: R&D finding worth acting on
→ Update: main-project-docs/RD-LOG.md
→ Append with format: [DATE] | [AGENT] | [CATEGORY] | [FINDING] | [PRIORITY] | [DECISION]

Trigger: Prompt changed
→ Create/Update: prompts/CHANGELOG.md
→ Entry: v[X.Y.Z] [DATE] — [what changed] — [eval delta]

Trigger: Security issue found or fixed
→ Update: main-project-docs/Security-Document.md (create if not exists)
→ Append: [DATE] — [issue] — [fix] — [severity]

Trigger: Roadmap priority changed
→ Update: main-project-docs/MVP-Development-Roadmap.md
→ Append under "## Change Log" section
```

---

## 7. LAYER 2 EXECUTION SEQUENCE (Recommended Order)

```
Session 1  → L2.F2.M1.AT1-AT7   (auth.test.ts: register + verify + login)
Session 2  → L2.F2.M1.AT8-AT14  (auth.test.ts: refresh + logout + me + forgot + reset)
Session 3  → L2.F2.M2.AT1-AT2   (middleware tests) + L2.F2.M3.AT1-AT2 (E2E)
Session 4  → L2.F3.M1.AT1       (Product: org spec) in parallel with R&D
Session 5  → L2.F3.M1.AT2-AT5   (Org creation BE endpoint + tests)
Session 6  → L2.F3.M1.AT6       (AI: Vapi trigger doc) + L2.F4.M1.AT1 (Product: onboarding spec)
Session 7  → L2.F4.M1.AT2-AT5   (Onboarding: layout + steps 0-1)
Session 8  → L2.F4.M1.AT6-AT9   (Onboarding: steps 2-5 + Redux)
Session 9  → L2.F4.M1.AT10      (Onboarding tests)
Session 10 → L2.F5.M1.AT1-AT3   (Product KB spec + Document model + POST endpoint)
Session 11 → L2.F5.M1.AT4-AT7   (KB GET/DELETE + BullMQ jobs)
Session 12 → L2.F5.M2.AT1-AT3   (KB frontend + tests)
Session 13 → L2.F6.M1.AT1-AT3   (Team: spec + invite endpoint + members list)
Session 14 → L2.F6.M1.AT4-AT6   (Team: remove + accept-invite + checkRole)
Session 15 → L2.F6.M2.AT1-AT3   (Team: frontend + tests)
Session 16 → L2.F7.M1.AT1-AT4   (Layer 2 QA sign-off + git commit)
```

Each session = one founder query. All 5 agents work. One or two atomic tasks complete per session.
