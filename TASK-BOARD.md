# AgentOps Studio — Task Board

> **Founder**: Rishabh Sharma  
> **CEO Agent**: Claude (orchestrator)  
> **Last updated**: 2026-06-26  
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
| T3.2 | 🟠 AI | Exotel | SIP trunk provisioning + Indian number setup | ⏳ |
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
| 🟡 P1 | L3 Voice AI | Exotel business verification | Founder to initiate Exotel account verification |
| 🟡 P1 | L3 Vapi | Vapi API keys | Founder to provision Vapi account + share API key in .env |
| 🟢 P2 | Git commit | All L2.1 + framework work uncommitted | Run: `git add . && git commit -m "feat: Layer 2 auth + execution framework" && git push origin dev` |
