# AgentOps Studio — R&D Log

> Owner: All Agents (CEO coordinates)
> Format: [DATE] | [AGENT] | [CATEGORY] | [FINDING] | [PRIORITY] | [DECISION]
> Rule: NEVER overwrite entries — always APPEND. Use version headers per session.

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
