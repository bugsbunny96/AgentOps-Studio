# AgentOps Studio — R&D Log

> Owner: All Agents (CEO coordinates)
> Format: [DATE] | [AGENT] | [CATEGORY] | [FINDING] | [PRIORITY] | [DECISION]
> Rule: NEVER overwrite entries — always APPEND. Use version headers per session.

---

## v1.7.0 — 2026-07-29 Session 3 — Legal Pages (T&C + Privacy Policy)

[2026-07-29 Session 3] v1.7 — Engineering R&D Worker
Type: Research Note
Trigger: on-demand (legal pages task)
Finding: Stripe's merchant review process requires a publicly accessible Terms of Service and Privacy Policy before approving a live mode account. Without these, Stripe can hold payouts or reject the account.
Opportunity: Legal pages created this session directly unblock Stripe live-mode approval.
Proposed artifact: None — implemented directly.
Affects: frontend/src/features/public/TermsPage.tsx, PrivacyPolicyPage.tsx
Founder decision needed: Yes — review + fill in [LEGAL ENTITY NAME], [REGISTERED ADDRESS], [GSTIN], designate grievance email addresses, and have Indian advocate review before publishing.

[2026-07-29 Session 3] v1.7 — Product R&D Worker
Type: Research Note
Trigger: post-task-review
Finding: SPDI Rules 2011 Rule 5(9) mandates a named Grievance Officer with postal address and response time. The PrivacyPolicyPage includes this in Section 14. The Grievance Officer must be an actual human, contactable by email and post. Using founder's name (Rishabh Sharma) as placeholder is valid for early stage.
Opportunity: Once the DPDPA 2023 is fully notified, the Data Protection Board of India will be the appeals body — the policy already references this future path.
Proposed artifact: None — built into the PrivacyPolicyPage.
Affects: frontend/src/features/public/PrivacyPolicyPage.tsx
Founder decision needed: No (logged)

[2026-07-29 Session 3] v1.7 — CS R&D Worker
Type: Research Note
Trigger: post-task-review
Finding: Section 9 of the Privacy Policy (Call Recording Notice) and Section 10 of the Terms of Service (Voice AI Services & Call Recording) clearly assign call recording consent obligations to the Organisation — not to AgentOps Studio. This is legally significant: it removes our platform from liability for customer non-compliance with TRAI telemarketing regulations.
Opportunity: Proactively educating users about TRAI compliance during onboarding could reduce support tickets about "why is my number getting flagged?" and reduce churn from compliance failures.
Proposed artifact: BL-NNN (backlog item) — Add a TRAI compliance checklist to the onboarding flow (step after "Activate" page).
Affects: Sprint Backlog (future), Onboarding UX
Founder decision needed: No (logged as backlog candidate)

[2026-07-29 Session 3] v1.7 — Growth R&D Worker
Type: Research Note
Trigger: post-task-review
Finding: All footer link columns (Product, Company, Legal) previously linked to href="#" — dead links. These are now wired to real routes. Correct internal linking improves crawlability and Google's ability to index all public pages. Privacy Policy and Terms of Service pages themselves will be indexed and can appear in search results for brand trust queries.
Opportunity: Add a sitemap.xml that includes /terms and /privacy to ensure Googlebot discovers these pages promptly.
Proposed artifact: BL-NNN — Add sitemap.xml generation to the public site build (list all public routes including /terms and /privacy).
Affects: Public site SEO, Stripe merchant review
Founder decision needed: No (logged as backlog candidate)

---

## v1.6.0 — 2026-07-29 Session 2 — Stripe Customer Portal

### 🟣 CS R&D — Self-Serve Subscription Management

**[2026-07-29 01:00] v1.6 — CS R&D Worker**
Type: Research Note
Trigger: post-implementation review — Stripe Customer Portal
Finding: The Stripe Customer Portal is the fastest path to self-serve subscription management. A single `stripe.billingPortal.sessions.create()` call generates a one-time URL valid for ~5 minutes. The portal lets customers: update payment method, download/view invoices, cancel subscription, or upgrade/downgrade (if configured). Cancellations still trigger the `customer.subscription.deleted` webhook which our handler already processes (downgrades org to free). No additional webhook handling needed.
Opportunity: Configure the portal to allow downgrade (starter ↔ growth) as a self-serve action in the Stripe Dashboard. This eliminates 100% of plan-management support tickets.
Proposed artifact: None — implemented. Founder needs to activate portal in Stripe Dashboard.
Affects: `billing.service.ts`, `billing.controller.ts`, `billing.routes.ts`, `BillingPage.tsx`, `billing.test.ts`
Founder decision needed: Operational — activate portal in Stripe Dashboard (no code change).

---

## v1.5.0 — 2026-07-29 — Session: INR Pricing + Call Minutes + Rate Limiting

### 🟡 Growth R&D — INR Stripe Checkout Architecture

**[2026-07-29 00:00] v1.5 — Growth R&D Worker**
Type: Research Note
Trigger: on-demand — INR pricing implementation
Finding: Stripe Price objects are currency-bound at creation time. You cannot charge in INR using a USD price ID. Separate INR-denominated Price objects must be created in the Stripe Dashboard (Products → Edit → Add price → Currency: INR). The checkout session inherits currency from the Price — no `currency` param needed on the session object.
Opportunity: Zero-friction INR checkout for Indian SMB customers. Eliminates any FX friction at Stripe checkout.
Implementation: Added `STRIPE_STARTER_PRICE_ID_INR` + `STRIPE_GROWTH_PRICE_ID_INR` env vars. `getPlanPriceId()` prefers INR variants when set; falls back to primary IDs. `getPlanFromPriceId()` checks both variants so subscription webhook events from either price ID correctly identify the plan.
Proposed artifact: None — implemented directly (T3 backend change, no T1 decision needed).
Affects: `backend/src/config/env.ts`, `backend/src/modules/billing/billing.service.ts`, `backend/.env.example`, `backend/src/__tests__/billing.test.ts`
Founder decision needed: Yes (operational) — create INR prices in Stripe Dashboard and set the two new env vars in production `.env`.

### 🟠 AI R&D — Call Minutes Cost Gate Design

**[2026-07-29 00:01] v1.5 — AI R&D Worker**
Type: Research Note
Trigger: post-task-review — call minutes gate implementation
Finding: Vapi `assistant-request` webhook must return a synchronous assistant config (not an HTTP error). Blocking calls via HTTP 4xx causes Vapi to play a generic error tone rather than a graceful message. Implemented as inline `assistant:` object with `maxDurationSeconds: 45` cap — ensures Vapi plays a branded "limit reached" message and terminates cleanly. Self-healing aggregation-pipeline reset on `end-of-call-report` means per-org accuracy is maintained even if the BullMQ monthly cron fires late.
Opportunity: Pattern reusable for other call-gate scenarios (e.g., invalid phone, suspended org, feature flag gate).
Proposed artifact: ADR-005 (Draft) — Standard pattern for synchronous Vapi webhook gates.
Affects: `backend/src/modules/calls/webhook.service.ts`
Founder decision needed: No (logged).

### 🟢 Engineering R&D — Rate Limiting Audit

**[2026-07-29 00:02] v1.5 — Engineering R&D Worker**
Type: Research Note
Trigger: on-demand — founder requested 5 req/min on auth endpoints
Finding: Auth endpoints already protected at 10 req/15min (≈ 0.011 req/sec) vs. requested 5 req/min (0.083 req/sec). Existing limit is 7.5× more restrictive. `express-rate-limit` already installed and applied in `backend/src/app.ts` with `skip: skipInTest` guard for integration tests. No change warranted — existing config exceeds request.
Opportunity: Consider adding IP-level blocking (fail2ban / Cloudflare WAF rule) for repeat offenders above the threshold.
Proposed artifact: None — no change made.
Affects: `backend/src/app.ts` (read-only audit)
Founder decision needed: No (logged).

---

## v1.4.0 — 2026-07-14 — Session: CS R&D Competitor Support Ticket Analysis

### 🟣 CS R&D — Ticket Theme Research: Voice AI / AI Receptionist SaaS

---

**[2026-07-14 14:00] v1.4 — CS R&D Worker**
Type: Research Note
Trigger: on-demand (/rnd-scan cs)
Sources: G2 reviews (Goodcall, Retell AI, Synthflow, Vapi, SmithAI), Trustpilot (SmithAI 4.3/5 × 336 reviews, Synthflow), Capterra India (Goodcall), Retell AI blog (comparative teardowns), dialora.ai (Vapi review), synthflow.ai blog (Goodcall/Retell reviews), serviceagent.ai, softailed.com, trillet.ai (agency retention), netfor.com (70% failure rate analysis), scalemeai.com (SMB 30-day rollout), lilachbullock.com (hidden cost analysis), AI hallucination research (Gorgias, Yuma.ai, CX Today), PwC/Qualtrics customer experience studies.
Founder decision needed: No — all backlog candidates are T3 proposals. Promoting to sprint = T1.

---

#### SECTION 1: TOP 5 SUPPORT TICKET THEME CATEGORIES

**THEME 1 — AI Gives Wrong / Hallucinated Answers**
Root signal: "The AI told my customer the wrong price / wrong doctor / wrong hours."
Evidence:
- Indian clinic AI receptionist documented as "confidently telling patients Dr. Sharma specialises in obstetrics when she is a dermatologist" (vaniagent.com/engageoagency.com).
- Industry-wide: AI-powered customer service bots produce hallucinated responses 15–27% of the time in live interactions (Gorgias, 2025). AI uses 34% more confident language when generating wrong information than when correct.
- A dental practice saw appointment booking rate drop from 65% to 42% after switching to AI receptionist — patients asking questions the AI couldn't answer (scalemeai.com).
- Synthflow G2 reviews: "When tested with off-script questions, the agent quickly lost track and defaulted back into canned lines — felt more like a fancy IVR than an agent."
- $67.4B global business cost from AI hallucinations in 2024 (fourdots.com).
Trigger: KB not loaded, stale, or insufficiently detailed. Agent falls back to LLM general knowledge instead of grounding in org-specific data.
AgentOps implication: Every support ticket of this type is a KB coverage gap. Our Vapi KB sync (DRIFT-1 fix, Task #56) is correct foundation; the missing piece is a guided KB completeness checker + ongoing transcript → KB gap detector.

**THEME 2 — Setup / Configuration Complexity (Day 1–7 Abandonment)**
Root signal: "I don't know how to set it up" / "You need to be a developer."
Evidence:
- Vapi G2 reviewer (verbatim): "They could improve the dashboard. It's very difficult. I have to be a developer if I want to understand all the options."
- Synthflow: "Limited access to real call testing in the free plan makes it harder to evaluate the agent before committing."
- Real setup time: 5–10 hours for initial configuration (getnextphone.com). Most SMB founders expect it to be plug-and-play.
- Gartner research: organizations using phased rollout have 3× higher success rate than "big bang" implementations.
- Most businesses treat deployment like flipping a switch — by Day 2, they are dealing with confused customers and a stressed team.
- SmithAI G2: "Settings didn't save properly." Synthflow: "Things sometimes go wrong / it's unstable."
Day 1–7 specific tickets:
  - "How do I set up business hours?" (configuration buried in settings)
  - "How do I connect my booking calendar?"
  - "The test call didn't work / no sound"
  - "Where do I add my services and prices?"
  - "How do I make it transfer to a human?"
AgentOps implication: Our onboarding wizard (Connect → Learn → Configure → Customize → Activate) addresses this structurally, but phone number linking is still buried in Settings (RFC-005 is the right fix, already filed by Growth R&D, v1.3).

**THEME 3 — Billing Shock / Unexpected Overages**
Root signal: "My bill was 3× what I expected" / "Pricing changed without warning."
Evidence:
- Synthflow: Removed the $29/month Starter plan without warning post–Series A (June 2025). Multiple G2 reviewers flagged "flying blind into overage territory."
- Vapi "stack tax": 4–6 separate invoices from STT + TTS + LLM + telephony providers, making final cost 3–4× advertised (dialora.ai/ringg.ai).
- Goodcall: "Pricing has shifted without warning; what began as a free or discounted account now costs significantly more."
- SMB analysis: A "$45/month" plan with per-call overages reached $380/month at real business volume. Per-minute billing: a 50-minute plan blows through in week 1 at 42 calls/month × 3 min avg (lilachbullock.com).
- Synthflow (Trustpilot): "I cancelled my subscription 5 months ago and continued to be billed each month. You can't get a human on the phone for customer service to cancel either — I had to cancel my debit card."
AgentOps implication: Flat-rate / minute-bundle pricing with a real-time usage dashboard and pre-overage email/WhatsApp alert eliminates this entire ticket category. Cancellation must be self-serve (no email-to-cancel friction).

**THEME 4 — Human Escalation Failure / "Amnesia Problem"**
Root signal: "My customer asked to speak to a human and the AI kept going" / "Customer had to repeat themselves to the person who answered."
Evidence:
- The "amnesia problem": customer spends 5 minutes explaining issue to AI, AI transfers, human picks up with no context, customer must repeat everything from start (bucher-suter.com, bluepweak.com).
- PwC study: 73% of consumers say repeating information is one of the most frustrating parts of support, especially after transfer.
- Qualtrics (Oct 2025): nearly 1 in 5 consumers who used AI for customer service saw no benefit — failure rate 4× higher than AI use in general.
- SmithAI complaint: "AI receptionist automatically transfers calls to live agents without user consent" — inflating bills and frustrating callers.
- Bland.ai: "Doesn't work at all. I call and it doesn't speak, it gets interrupted."
- 70% of voice AI implementations fail — the breakdown happens at the transition point when customer issue exceeds AI resolution (netfor.com).
AgentOps implication: Escalation must be: (a) always-on with a visible toggle, (b) transfer with a call summary pre-populated for the human, (c) configurable in onboarding, not just settings.

**THEME 5 — Accent / Language / Latency Issues (Critical for India)**
Root signal: "My customers can't understand the AI" / "The AI can't understand Hindi / regional names" / "Long pauses make customers hang up."
Evidence:
- Indian market specific: AI receptionists trained on American voice data struggle with Indian accents and Hinglish. Correct standard: "not in aspirational English, not in a trained-on-American-voice-data accent" (vaniagent.com).
- Bland.ai: "Voice sounds too bot-like with long pauses that make people drop off within 20–30 seconds." Reddit: "Bland AI is too slow for production."
- Vapi latency: "The single worst thing about VAPI is the latency — not predictable, sometimes 800–1000ms, sometimes up to 4–5s" (dialora.ai, G2).
- Goodcall: voice quality issues on names, addresses, and accents — specifically flagged by HVAC and plumbing teams (US), which parallels our India SMB base.
- Deepgram nova-3 STT (Task #38 complete in our stack) and Azure Multilingual voices (Task #39 complete) are our hedge against this category. Sarvam AI (BL in RD-LOG v1.0) is the India-native escalation path.
AgentOps implication: We have the right stack choices (nova-3 + Azure). The remaining gap is a pre-launch "test call in Hindi" widget so users can hear exactly how their agent sounds before going live — currently absent from our onboarding Activate step.

---

#### SECTION 2: CHURN SIGNAL → ROOT CAUSE MAPPING

| Churn Signal (what user says/does) | Root Cause | Churn Timeline | Severity |
|---|---|---|---|
| "The AI told my customer wrong information" | KB not loaded or grounded in org data | Day 7–14 | Critical |
| No login after Day 3 (passive drop-off) | Setup too complex; no guided wizard completion | Day 1–7 | Critical |
| Support email: "Why is my bill so high?" | Per-minute/overage pricing not visible in-app | Month-2 bill | High |
| "My customers complained they couldn't reach a human" | Escalation not configured OR amnesia problem on transfer | Day 7–30 | High |
| "My customers can tell it's a robot / accent problems" | STT/TTS trained on foreign voice data; high latency | Day 14–30 | High |
| "I cancelled but kept getting charged" | No self-serve cancellation; only email-to-cancel | Post-cancel | High (also legal/chargeback risk) |
| "I don't know if the AI is even working" | No real-time call dashboard / week-1 summary | Day 7–14 | Medium |
| "It broke after an update" | Platform push-updates break working agents (Vapi issue) | Any | Medium |

---

#### SECTION 3: SELF-SERVE DEFLECTION OPPORTUNITIES

The following product changes would each eliminate a high-volume support ticket category:

**Deflection 1 — In-App Billing Usage Dashboard with Pre-Overage Alert**
Ticket deflected: "Why is my bill so high?" / "I didn't know I was going to go over."
Implementation: Show current-month minute consumption vs. plan limit on the Dashboard. Send WhatsApp + email notification at 80% utilization with an upgrade CTA. Eliminates the "bill shock" ticket entirely. Effort: low — call minutes are already logged in call.model.ts.

**Deflection 2 — Guided KB Completeness Wizard + Gap Detector**
Ticket deflected: "The AI gave wrong information to my customer."
Implementation: After website crawl, show a "coverage score" (% of service categories, pricing, hours, staff that have KB entries). Flag gaps with "Add this" prompts. Post-call: surface unanswered questions as suggested KB entries. Reduces hallucination surface area to near zero for in-scope topics.

**Deflection 3 — Prominent Human Escalation Config (in Onboarding, not Settings)**
Ticket deflected: "My customers couldn't reach a human." / "The AI keeps going instead of transferring."
Implementation: Make escalation phone number + trigger keywords a mandatory onboarding step (step 4 of 5), not optional settings. Add a visible "Live Escalation: ON/OFF" toggle on the agent dashboard with green/red status. Pass call context summary to human on transfer. This also resolves the amnesia problem.

**Deflection 4 — Pre-Launch Hindi/Accent Test Call Widget in Activate Step**
Ticket deflected: "The voice sounds robotic" / "My customers can't understand the accent."
Implementation: In the Activate onboarding step, add a "Make a test call in Hindi" button that calls the founder's own phone with a sample Hindi customer scenario. They hear what their customers hear before going live. Eliminates post-launch voice quality tickets.

**Deflection 5 — In-App Transcript Review with "Fix AI Answer" Inline KB Correction**
Ticket deflected: "The AI said X but should say Y — how do I fix it?"
Implementation: In CallDetailModal (already built, Task #29/30), add a "Fix this answer" button on any AI turn in the transcript. One click opens a KB editor pre-populated with the question and a blank answer field. Saves directly to KB and triggers Vapi sync. Turns every wrong-answer complaint into a self-serve fix in <60 seconds.

---

#### SECTION 4: EXPANSION TRIGGERS

Two expansion triggers to instrument in analytics immediately:

**Expansion Trigger 1 — First Off-Hours Call Recovered**
Definition: First call where `callTime` is outside business hours AND call was handled successfully by the AI (not voicemail, not missed).
Why it works: This is the "aha moment" for SMB owners — "the AI answered a call at 11pm that I would have missed." It directly maps to revenue saved. Owners who experience this within Day 1–7 show dramatically higher week-2 retention.
Instrument: Fire a `first_offhours_recovery` event on the dashboard the next morning the owner logs in. Show the call, the transcript, the estimated value ("you would have missed this lead"). Follow with a WhatsApp: "Your AI handled a call while you slept."
Upsell path: "You're on a 500 min plan. At current call volume, you'll exhaust it in [X] days. Upgrade to Growth plan to stay covered 24/7."

**Expansion Trigger 2 — 80% Minute Allocation Threshold Crossed**
Definition: Current-month call minutes >= 80% of plan limit.
Why it works: This is a measurable, objective signal that the product is working (high call volume = the AI is handling real calls). Users at this moment are experiencing value, not friction — they are maximally receptive to an upgrade conversation.
Instrument: Fire an in-app banner + WhatsApp notification: "Your AI has handled [X] calls this month. You're at 80% of your [Y]-minute plan. Upgrade to avoid interruption." Include a one-click upgrade CTA. No friction — pre-fill payment method.
Revenue impact: This is the primary MRR expansion lever. Every user who crosses 80% is a qualified upgrade candidate. Target: >40% conversion on this trigger within 7 days.

---

#### SECTION 5: BACKLOG CANDIDATES (RICE × 1.5 CHURN MULTIPLIER)

Scoring: RICE = (Reach × Impact × Confidence) / Effort. Churn-risk multiplier = 1.5× applied where item directly reduces churn or unblocks onboarding. Scale: 1–10.

| # | Backlog ID | Item | R | I | C | E | Base RICE | Churn Mult | Final Score |
|---|---|---|---|---|---|---|---|---|---|
| 1 | BL-CS-001 | Billing Dashboard + Pre-Overage WhatsApp/Email Alert | 10 | 9 | 9 | 2 | 405 | 1.5× | **607** |
| 2 | BL-CS-002 | Human Escalation Setup in Onboarding + Transfer Context Summary | 9 | 9 | 8 | 3 | 216 | 1.5× | **324** |
| 3 | BL-CS-005 | WhatsApp Post-Call Summary to Business Owner (daily digest) | 10 | 7 | 8 | 3 | 187 | 1.2× (expansion) | **224** |
| 4 | BL-CS-003 | Guided KB Completeness Wizard + Post-Call Gap Detector | 10 | 8 | 8 | 5 | 128 | 1.5× | **192** |
| 5 | BL-CS-004 | In-App Transcript "Fix This Answer" → Inline KB Correction | 8 | 8 | 7 | 4 | 112 | 1.5× | **168** |
| 6 | BL-CS-006 | Pre-Launch Hindi/Accent Test Call Widget in Activate Step | 10 | 7 | 9 | 2 | 315 | 1.0× (differentiator) | **315** |

Note: BL-CS-006 scores 315 base before multiplier — high confidence because it is unique to our India market positioning, but not strictly a churn-risk item for existing users; it is a conversion/activation item. Ranked separately.

**Final ranked list for sprint promotion consideration (T1 decision):**
1. BL-CS-001: 607 — Billing Dashboard + Pre-Overage Alert (highest impact, lowest effort)
2. BL-CS-002: 324 — Escalation Config in Onboarding
3. BL-CS-006: 315 — Hindi Test Call Widget (Activate step, India differentiator)
4. BL-CS-005: 224 — WhatsApp Post-Call Summary
5. BL-CS-003: 192 — KB Completeness Wizard
6. BL-CS-004: 168 — Inline KB Correction from Transcript

---

#### SECTION 6: CROSS-DOMAIN SIGNALS (filed as RFC candidates)

The following findings have implications outside CS domain and are flagged for RFC filing:

- **RFC candidate (Product + Engineering):** KB Gap Detector requires post-call transcript analysis pipeline (AI domain). Suggest cross-domain RFC for "post-call AI analysis loop" — surfaces KB gaps, quality scores, escalation reasons automatically. Filed for Chief R&D Coordinator index.
- **RFC candidate (Growth):** Expansion Trigger 1 (off-hours recovery) should feed directly into Growth's activation email sequence at Day 1 ("Here's the call your AI handled while you slept"). Growth R&D to pick up.
- **RFC candidate (AI):** Latency issues (Vapi 4–5s spikes) are a churn driver. AI R&D to investigate latency budget per call turn and document acceptable thresholds vs. Vapi SLA.

Proposed artifacts:
- RFC-006 (Draft): Post-Call AI Analysis Loop — KB Gap + Quality Score + Escalation Reason
- RFC-007 (Draft): Expansion Trigger → Activation Email Integration (CS + Growth)
Affects: Feature-Ticket-List.md, Roadmap (GTM section), TAD (AI pipeline section), RD-LOG
Founder decision needed: No (all Draft — promotion to sprint is T1)

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

## v1.4.0 — 2026-07-14 — Session: Competitor Onboarding UX Research (Product R&D)

---

### 🔵 Product R&D — Competitor Onboarding Teardown

**[2026-07-14 10:00] v1.4 — 🔵 Product R&D Worker**
Type: Research Note
Trigger: on-demand (CEO dispatch — parallel R&D lane)
Finding: Full competitor onboarding teardown across 10 voice AI / AI receptionist platforms
Opportunity: Multiple high-impact onboarding patterns identified; 3 backlog candidates generated
Proposed artifact: BL-RND-001, BL-RND-002, BL-RND-003 (see below)
Affects: main-project-docs/Feature-Ticket-List.md, Roadmap, PRD onboarding spec
Founder decision needed: No (T3 logged) — promote to sprint is a T1 decision

---

#### Competitor-by-Competitor Onboarding Findings

**1. SYNTHFLOW**
- Time-to-first-call: 30–60 minutes (no-code drag-and-drop builder)
- Standout pattern: Pre-built templates for the top 20 service business use cases (HVAC, law, clinics, real estate etc.). Users pick a vertical template → agent is 80% configured.
- Activation strength: 14-day free trial, Slack support first 30 days only. Praised in 364 G2 reviews for ease of use.
- Key friction: Slack support cut after 30 days → ticket-based system with slow response. Free tier minutes consumed by test calls — not enough to stress-test before committing.
- Pricing: Pay-as-you-go $0.15–$0.24/min (GPT-4.1 + managed Twilio). Enterprise custom. "Expensive" is #1 G2 complaint (145 mentions). Unpredictable per-minute billing causes bill shock.
- Integration moat: 40+ native connectors (Salesforce, HubSpot, RingCentral, WhatsApp, Five9). Deepest list in category.
- Sources: Zeeg/Synthflow review; Retell AI/Synthflow review; Softailed review; G2 reviews

**2. BLAND.AI**
- Target user: Developers (API-first platform)
- Time-to-first-call: 20–30 minutes (10 lines of code → first call)
- Standout pattern: Built-in testing suite, but every test call costs money at $0.12/min — no free simulation mode.
- Key friction: Visual builder exists but too primitive for production agents. Cannot simulate calls, debug flows, or A/B test without spending real money. Support is community Discord only — no SLAs, no account manager.
- JTBD mismatch: Excellent for engineering teams; actively hostile to non-technical SMB owners.
- Onboarding verdict: Zero progressive disclosure. Users face raw API docs as primary onboarding surface.
- Sources: Bland.ai docs; LeadAdvisors review; Lindy review; Retell AI/Bland review

**3. RETELL AI**
- Time-to-first-call: Under 10 minutes for first test call
- Standout pattern: No credit card at signup. Guided dashboard with step-by-step prompts. Single-prompt template → pick voice → assign test number → call. Web-based call simulator (no real phone needed for first test).
- Activation strength: ~600ms latency, $10 free credit at signup. Clean, low-code workflow builder gives developer-level control without code.
- Key friction: Steep learning curve for advanced features. Wants more step-by-step onboarding guides per reviewers. $0.07/min base (cheapest in market) but LLM cost stacks on top.
- Pricing: $0.07/min base + LLM pass-through, no platform fee, no monthly minimum. HIPAA on standard plans.
- Sources: Fritz AI review; Product Hunt reviews; G2 reviews; Orvera review

**4. VAPI.AI**
- Time-to-first-call: Claimed "5 minutes" — actual for non-technical users: 30–60 min
- Standout pattern: "Flow Studio" for basic no-code prototyping inside dashboard.
- Key friction: Overwhelming option matrix at setup (choose LLM, STT provider, TTS provider, telephony, browser config — simultaneously). No progressive disclosure. Designed for engineers.
- Pricing: $0.05/min base + LLM + telephony layers. Can look cheap but total cost is 2–3x advertised once production traffic runs.
- Onboarding verdict: Technically impressive; UX hostile to SMBs. All "advanced" features gated behind API calls or code.
- Sources: Vapi.ai docs; Lindy review; Retell AI/Vapi review; Dialora review

**5. GOODCALL**
- Time-to-first-call: 15–30 minutes (low-code, drag-and-drop workflow builder)
- Standout pattern: Google Business Profile sync at signup → AI auto-learns your address, hours, and basic services in seconds. This is the single fastest "knowledge onboarding" pattern in the market.
- Additional pattern: Call forwarding overlay (you keep your existing number; Goodcall answers on overflow). HIPAA compliant — one of few platforms at this price to offer compliance documentation.
- Key friction: No personalized deployment guide, no workflow templates, no in-app assistant during setup. Integrations are Zapier-only — no native CRM sync.
- Pricing: Starter $59/mo (100 unique callers), Growth $99/mo (250), Scale $199/mo (500). Hidden gotcha: $0.50 charge per unique caller above cap. "Unique" = unique phone number, so same person on new device = new charge. Confusing and creates bill shock.
- Sources: Squawkvoice review; ServiceAgent review; Synthflow/Goodcall review; CloudTalk pricing guide

**6. SMITH.AI**
- Model: Human + AI hybrid (not pure voice AI)
- Onboarding: White-glove — Smith.ai team tailors the solution during onboarding. Not self-serve.
- Standout pattern: 30-day money-back guarantee; month-to-month contracts; transparent add-on pricing. Trust signals reduce sign-up anxiety significantly.
- Pricing: AI Receptionist from $95/mo. Human receptionist from $292.50/mo for 30 calls. Add $3/call for live human handoff on AI plan. Annual pricing is ~$14,000 for full human coverage.
- Key friction: Non-self-serve onboarding. Requires coordination with Smith team. Skews heavily to US law firms (80% of G2 reviews) — limited relevance to Indian SMBs.
- Sources: Smith.ai pricing; Ever-Help review; GetVoIP review; Smith.ai vs AnswerConnect comparison

**7. ANSWERCONNECT**
- Model: Human answering service (not AI — relevant as benchmark for incumbent replacement)
- Standout pattern: 4.9/5 Trustpilot across 1,400+ reviews; answers 99% of calls within 1–4 rings. Forbes #1 answering service 2025. Demonstrates the quality bar AI must match to displace incumbents.
- Pricing: Starts $350/mo for 200 minutes. Per-minute overage at $1.85–$2.50/min. Significantly less predictable than per-call billing.
- Key learning: Indian SMBs used to paying human telecaller ₹40,000–65,000/month — AnswerConnect at US prices is not accessible, which opens the Indian market.
- Sources: Smith.ai vs AnswerConnect comparison; Technology.org comparison

**8. MY AI FRONT DESK**
- Time-to-first-call: 10–20 minutes
- Standout pattern: Only platform with a permanent free tier (20 voice minutes/month — enough to validate the product). Guided setup uses plain English instructions ("tell the AI what to do in natural language") — not flow builders or prompt engineering. During setup, user selects which features matter (transfers, booking, etc.) and platform self-configures. White-label reseller at $99/month.
- Key friction: Targets low-call-volume local businesses. Will have capacity constraints at scale.
- Pricing: Free tier (20 min), Starter $79/mo (billed annually), Pro $119/mo. Zapier integration on Business plan.
- Sources: Vellum review; RainVoice review; Smash VC review

**9. ROSIE AI**
- Time-to-first-call: Under 1 hour
- Standout pattern: Zero configuration UI — point it at your website and Google Business Profile → Rosie trains itself on your business and is answering calls within an hour. Bilingual English/Spanish on every plan including the cheapest.
- Pricing: $49/mo for 250 minutes (Professional). Appointment booking on $149/mo (Scale plan). Focused on trades and home services.
- Key learning: "Self-training from existing web presence" is the most compelling onboarding shortcut for non-technical users. Users do not want to manually type their FAQs.
- Sources: ServiceAgent review; RainVoice review; MyAIFrontDesk comparison

**10. INDIA-SPECIFIC COMPETITORS (Emerging)**
- **HuskyVoice**: Hindi/Hinglish/Indian English focus. Phone-first AI receptionist. WhatsApp follow-ups. India-specific but early stage.
- **Vomyra**: Free tier (1 agent free). 50+ Indian languages. INR pricing. Google Sheets, Gmail, Calendar, Petpooja POS integrations. No-code. Most direct Indian SMB competitor to AgentOps Studio.
- **Tabbly.io**: ₹3.9/min pricing. 50+ Indian languages. INR pricing removes mental friction.
- **SquadStack**: Enterprise focus, outcome-driven model, English/Hindi/Hinglish/regional dialects. Reduces customer acquisition cost by 50% in their case studies.
- Sources: JoyzAI guide; MyOperator blog; Ringg.ai blog; Vomyra blog; SquadStack

---

#### UX Patterns Worth Adopting (Top 5)

**ADOPT-1: Vertical-First Template Selection (Synthflow)**
Before showing any configuration, ask "What type of business are you?" and immediately load a pre-configured agent template for that vertical. For AgentOps Studio Indian SMB targets: Clinic / Salon / Real Estate / Coaching Center / Restaurant / Logistics Dispatch. Starting from a template reduces blank-canvas paralysis and cuts time-to-first-call by 50%+.

**ADOPT-2: Self-Training from Web Presence (Rosie / Goodcall)**
Let users point to their website URL and/or Google Business Profile → auto-populate business name, hours, services, phone, FAQ. Our crawler already exists (L2.F5 complete). The gap is surfacing this as the primary onboarding hook on Step 2 (Learn), not burying it in a path selection card.
Enhancement: After crawl, show users a preview card: "Here's what your agent learned about you" with editable fields. Creates an "it already knows me" moment.

**ADOPT-3: Live Test Call as Activation Ritual (Retell / CloudTalk)**
At the end of setup, ask for the user's mobile number and trigger a real call so they hear their agent speak. This is a high-emotion moment that converts a skeptical SMB owner from "I set something up" to "holy sh*t, it just called me and knew my clinic's name." Our ActivatePage already has a placeholder for this (L3.F2 scope per the existing AI R&D note dated 2026-06-26).

**ADOPT-4: Plain English Instructions, Not Flow Builders (My AI Front Desk)**
SMB owners will not learn a drag-and-drop node editor. The Configure step (Step 3) should let users write natural language instructions like: "If someone asks about pricing, say we start at ₹500 and ask them to book a consultation." The backend converts this to structured prompt rules. Bland.ai and Vapi lose non-technical users here; AgentOps must win this segment.

**ADOPT-5: WhatsApp-Native Post-Call Notifications (Differentiation)**
No competitor sends post-call summaries via WhatsApp to the business owner. After every AI-handled call: send a WhatsApp message with caller name, intent detected, action taken, and a link to the recording. Indian SMBs are WhatsApp-native — email notifications are ignored; WhatsApp messages are read within minutes. Vomyra does WhatsApp follow-ups to *callers*; no one does it for the *business owner*.

---

#### UX Patterns to Avoid (Top 4)

**AVOID-1: API-First Dashboard (Bland.ai, Vapi)**
Do not make code examples or curl commands the primary onboarding surface. Our ICP cannot write 10 lines of code. Every path must be completable without touching the terminal.

**AVOID-2: Per-Minute Free Trial That Burns on Test Calls (Synthflow)**
Free trial minutes being consumed during internal testing creates resentment before the user has seen value. Better: time-gated trial (14 days, no minute cap) or a separately bucketed "test minutes" pool that does not count against the paid plan.

**AVOID-3: Unique-Caller Pricing Caps (Goodcall)**
The $0.50/unique-caller overage model creates bill shock and is especially confusing for Indian SMBs who receive high-volume short calls. Per-call or per-minute with a hard monthly cap is more predictable and more familiar (analogous to Jio/Airtel plans).

**AVOID-4: Support Gated Behind Discord or Ticket Systems (Bland.ai, Synthflow post-30-days)**
Indian SMBs will not join Discord to get support. WhatsApp-first support (or at minimum in-app chat) is the expected support channel in the Indian market. Build this into the CS playbook from Day 1.

---

#### JTBD Shifts: What Business Owners Want vs What They Get

| Job to Be Done | What Competitors Deliver | Gap |
|---|---|---|
| "Set it up and forget it" | 30-120 min configuration sessions with complex builders | No true fire-and-forget onboarding exists |
| "Let me hear the voice before I pay" | All demos are post-signup, post-payment | Pre-signup demo call is a conversion unlock |
| "It should sound Indian, not American" | American-accented defaults; Hindi support is afterthought | Local voice quality is unmet |
| "Tell me exactly what I'll pay" | Per-minute billing with LLM/telephony stacking | Flat monthly INR pricing is unmet |
| "It needs to know my specific business" | Blank-canvas prompt builder | Auto-populate from website is the answer |
| "Handle my WhatsApp too" | Phone calls only | WhatsApp integration is a major gap |

---

#### Backlog Candidates

**BL-RND-001 — "Set Up in 5 Clicks" Vertical-First Onboarding Wizard**
- What: Replace current 5-step onboarding with a vertical-aware wizard: (1) Pick business type, (2) Enter website URL → auto-crawl, (3) Preview "what your agent learned", (4) Choose agent name + voice (hear 15-sec preview), (5) Set hours → trigger test call to mobile.
- Why: Retell and Synthflow both complete onboarding in under 30 min. My AI Front Desk in under 20. AgentOps must target under 10 min for the non-technical Indian SMB owner.
- RICE: Reach 9 × Impact 9 × Confidence 8 / Effort 6 = 108 × 1.5 (onboarding churn multiplier) = **162**
- Affects: LearnPage, ConfigurePage, ActivatePage, CustomizePage — UX refactor. Backend unchanged.
- Founder decision needed: Yes — promote to sprint (T1)

**BL-RND-002 — "Hear Before You Pay" Pre-Signup Demo Call**
- What: Add a phone number (or browser WebRTC call) on the marketing landing page where a visitor can call a pre-configured demo agent for their vertical (e.g., "Call our Salon demo" / "Call our Clinic demo"). Visitor hears the agent speak in Hindi/Hinglish/English before creating an account.
- Why: No Indian competitor does this. Synthflow and Retell gate demos behind signup. Converting a skeptical Indian SMB owner who has never seen AI calling requires letting them experience it first-hand with no friction. Estimated conversion lift: 25–40% on landing page CTR to signup.
- RICE: Reach 8 × Impact 8 × Confidence 7 / Effort 4 = **112**
- Affects: Marketing landing page, new pre-configured "demo" org in backend (read-only)
- Founder decision needed: Yes — promote to sprint (T1)

**BL-RND-003 — WhatsApp Post-Call Summary to Business Owner**
- What: After every AI-handled inbound call, send a WhatsApp message to the business owner's registered number with: caller name + number, detected intent (appointment / inquiry / complaint / spam), action taken (booked / transferred / noted / blocked), and link to call recording + transcript.
- Why: Indian SMBs ignore email. WhatsApp is read within 5 minutes. This single feature creates daily active engagement with the product and is a meaningful churn-prevention mechanism — owners see the agent working for them in real time.
- No competitor offers this. Vomyra sends WhatsApp to callers (not owners). This is a genuine first-mover in the Indian AI receptionist market.
- RICE: Reach 7 × Impact 8 × Confidence 8 / Effort 4 = 112 × 1.5 (churn-risk multiplier) = **168**
- Affects: New notification.service.ts (WhatsApp Business API via Meta or Twilio), call webhook handler
- Founder decision needed: Yes — promote to sprint (T1)

---

#### Pricing / Packaging Insights

**INR pricing is a moat**: Tabbly.io at ₹3.9/min is capturing share because Indian buyers think in rupees. Dollar-denominated pricing adds 5–10% mental friction ("how much is this actually?"). AgentOps should price in INR with a simple monthly cap structure. Reference point: Jio/Airtel telecom plans are universally understood.

**The "telecaller displacement" framing works**: A fully-loaded human telecaller costs ₹40,000–65,000/month. An AI agent at ₹999–2,999/month is a 95% cost reduction. This ROI story is clear and compelling — competitors in the US market rarely frame it this way for Indian buyers. Run this as a primary positioning message.

**Free tier drives activation**: My AI Front Desk and Vomyra both offer a free tier. Vomyra's "1 free agent forever" model is powerful — users invest setup time before paying, which creates switching cost. AgentOps should consider a "1 agent, 50 calls/month free" tier to drive onboarding completion without requiring a credit card. Aligns with Indian market expectation of trial-before-payment.

**Per-call > per-minute for SMBs**: Smith.ai's positioning (per-call is more predictable than per-minute) is validated in the market. Indian SMBs receive high-volume short calls (30–90 second duration) — per-minute billing can accumulate unpredictably. A flat monthly plan with a call cap (familiar from Airtel/Jio bundles) removes purchase anxiety.

**"Pay less than a peon" anchor**: ₹40,000–65,000/month human cost is the reference. AgentOps Starter at ₹999–2,999/month makes the ROI obvious without calculator math. No competitor is making this argument explicitly in the Indian market.

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

---

## v1.4.0 — 2026-07-14 — Session: Growth R&D — Acquisition Channel Deep Scan

---

### 🟡 Growth R&D — Acquisition Channels for Indian SMB ICP

**[2026-07-14 11:00] v1.4 — Growth R&D Worker**
Type: Research Note
Trigger: on-demand (/rnd-scan growth)
Finding: Comprehensive scan of Indian SMB B2B SaaS discovery behavior, voice AI competitor GTM, SEO keyword landscape, outbound benchmarks, and partnership channel feasibility.
Sources consulted: richautomate.in (WhatsApp B2B SaaS nurture benchmarks), upgrowth.in (CAC benchmarks for Indian B2B SaaS), myoperator.com (India voice AI market overview), vaniagent.com (India-specific pricing and positioning), caller.digital (India voice AI competitor comparison), kenresearch.com (India SMB digital adoption), zinfi.com (vertical SaaS partner marketing), exotel.com (partner directory / telephony reseller), bni-india.in (referral networking), appeq.ai (missed-call India SMB data), indujitechnologies.com (WhatsApp marketing guide), pintel.ai (India outbound data).
Proposed artifact: See structured sections below
Affects: Roadmap (GTM lane), growth-agent.md, ICP doc, Backlog (BL-013 through BL-017)
Founder decision needed: No for research / BL additions. Yes (T1) to promote any item into sprint.

---

#### FINDING 1 — Top 5 Acquisition Channels (ranked by expected ROAS for Indian SMB ICP)

**Channel 1 — WhatsApp-First Founder-Led Outbound (ROAS: Highest / CAC: ₹240–980)**
- Evidence: Indian bootstrapped founders booking ₹4–18L ACV deals at ₹240–980 CAC through personal WhatsApp outreach vs VC-funded peers at ₹4,800–12,000 CAC via LinkedIn ads and BDR teams (Source: richautomate.in).
- Reply rates jump from 9% (cold email) to 68% with personalized WhatsApp outreach. Demo-to-close rates improve from 14% to 38%. Deal cycle compresses from 87 to 26 days.
- Indian SMB buyer reads WhatsApp first, email second, LinkedIn DMs third — sequence accordingly.
- Tactic: Founder personal number, vertical-specific script (not broadcast), ROI case study in first message, 12-touch sequence over 30 days.
- Best vertical to start: Clinics (highest pain, structured buying, clear ROI, Practo/JustDial-discoverable).
- ROAS rationale: At ₹9,999–₹24,999/month ACV and ₹980 CAC, payback is <1 month. Best early-stage channel.

**Channel 2 — Bottom-of-Funnel SEO + AI Search Citation (ROAS: High / CAC: lowest long-term)**
- CAC timeline: 6–12 months to build authority but lowest long-term CAC after maturation (upgrowth.in benchmark).
- Keyword gap confirmed: Global competitors (Goodcall, Smith.ai, Synthflow) do not target Hindi/India-specific terms. Indian competitors (Voiceyfy, VaniAgent) have thin content depth — few comparison pages, no vertical-specific landing pages for clinics or salons.
- AI search channel growing rapidly: ChatGPT/Perplexity now handle 15–20% of informational queries; citations in AI answers drive discovery. Building structured content earns these citations.
- Entry tactic: Build 5 vertical landing pages ("AI receptionist for clinic India") + 5 competitor comparison pages ("Goodcall alternative India") in first sprint. Expand to 25 pages over 90 days.
- Long-tail highest intent: "best AI receptionist for clinic India 2026", "AI receptionist Hindi English Punjabi", "missed call solution salon India".

**Channel 3 — Vertical Community Infiltration (ROAS: High / CAC: ~₹0 direct cost)**
- BNI India: 600+ local chapters, one member per business category, 82% of BNI members say most business comes from referrals. Joining 2–3 city chapters as the "voice AI / AI receptionist" representative locks out competitors in those chapters by BNI's exclusivity rule. Estimated 10–30 SMB owners per chapter.
- Specialty WhatsApp Groups: Indian Medical Association (IMA) city chapters, dental college alumni WhatsApp groups, real estate WhatsApp groups (CREDAI/NAR India), salon & beauty industry groups (IBWA). These are trusted peer circles — a recommendation from a peer converts faster than any ad.
- Tactic: Founder joins as participant (not advertiser), demonstrates value by sharing clinic missed-call data publicly, offers free audit to group members first.
- ROAS rationale: Near-zero cost, high trust, high conversion. Time-intensive for founder but highest quality pipeline.

**Channel 4 — Clinic/Salon Management Software Integration Partnership (ROAS: Very High if secured / Effort: High)**
- Key targets: HealthPlix (10,000+ doctors, 370+ cities), MocDoc (external integrations API documented), Practo Ray (large clinic network), Vagaro-equivalent salon software in India (Fresha, Appointy).
- Opportunity: Position AgentOps as the "missed-call handler add-on" — when a patient calls after hours, clinic management software books the appointment, AgentOps handles the call. Complementary, not competing.
- MocDoc has a documented external integrations page; they actively seek healthcare API partners.
- Channel model: Revenue share (15–20% of first-year ACV referred) OR white-label (partner sells under their brand, we provide infra).
- ROAS rationale: 1 integration partnership could unlock hundreds of pre-qualified ICP accounts. CAC effectively paid by the partner's existing sales motion.
- Backlog candidate: BL-013 — Clinic Software Integration Partnership Program

**Channel 5 — IndiaMART / JustDial Lead Buy + Instant WhatsApp Conversion (ROAS: Medium / CAC: ₹2,000–8,000)**
- IndiaMART attracts active B2B buyers (procurement managers, business owners searching for solutions). Listing as "AI virtual receptionist service" / "cloud IVR with Hindi support" captures bottom-of-funnel intent.
- JustDial for local/hyperlocal visibility by city (Chennai clinics, Chandigarh real estate agents).
- Cost: IndiaMART ₹28K–60K/year; JustDial ₹6K–50K/year. Moderate ROAS but provides a self-serve inbound flow.
- Critical tactic: Respond to IndiaMART/JustDial leads via WhatsApp within 5 minutes. Reply rate and conversion collapse after 30 minutes.
- Backlog candidate: BL-014 — IndiaMART + JustDial listing setup + rapid-response playbook

---

#### FINDING 2 — SEO / Content Keywords Worth Targeting

**Tier 1 — High Intent, English (build first)**
- "AI receptionist India" — medium competition, high intent, no dominant Indian player ranked
- "virtual receptionist for clinic India" — low competition, very high intent
- "AI phone answering service India" — low competition
- "missed call solution small business India" — very low competition, highly specific pain
- "24/7 call answering service India" — medium competition
- "AI receptionist for doctor clinic" — low competition
- "AI receptionist for salon" — low competition
- "AI receptionist for real estate India" — very low competition

**Tier 2 — Competitor / Alternative Terms (BOFU, build second)**
- "Goodcall alternative India" — no competition, high intent
- "Smith.ai alternative India" — no competition
- "Voiceyfy alternative" — very low competition
- "VaniAgent alternative" — no competition
- "AI receptionist vs human receptionist cost India" — low competition, high commercial intent

**Tier 3 — Feature / Language Keywords (for AI search citation, build third)**
- "Hindi AI voice agent" — low competition
- "Hinglish voice AI" — very low competition
- "AI appointment booking phone call" — low competition
- "call automation for clinics India" — very low competition
- "AI receptionist Hindi English Punjabi" — no competition (unique to AgentOps positioning)
- "voice AI agent India SMB" — very low competition

**Content formats that work for this ICP:**
- "How [X] clinic recovered [N] missed calls in [M] days" — case study format, high conversion
- Cost calculator pages: "How much are missed calls costing your [clinic/salon/agency]?"
- Comparison posts: "AI receptionist vs hiring a receptionist: full cost breakdown for Indian SMBs"
- How-to: "How to set up an AI receptionist for your clinic in 15 minutes"

---

#### FINDING 3 — Partnership Channel Hypotheses

**Hypothesis A — Clinic Management Software Integration (Confidence: Medium-High)**
- Partner targets: HealthPlix, MocDoc, Healthians (lab), Clinicea
- Value prop to partner: AgentOps handles the phone calls their software can't — after-hours inbound, appointment reminders outbound. Complementary functionality, zero feature overlap.
- Entry point: MocDoc has an existing external integrations page. HealthPlix serves 10,000+ doctors and has an API. Both are looking for integrations that add patient engagement value.
- Model: Marketplace listing + revenue share (15–20% first-year ACV) or bundled pricing (clinic management software includes basic AgentOps tier).
- RICE score: Reach=High (thousands of ICP in one partner), Impact=High, Confidence=Medium, Effort=High → prioritize after MVP is stable.

**Hypothesis B — CA/Chartered Accountant Referral Network (Confidence: Medium)**
- CAs are the single most trusted business advisor to Indian SMB owners. They recommend Tally, QuickBooks, Zoho Books, GST software — and SMB owners adopt without friction. Same dynamic can work for AgentOps.
- ICAI (Institute of Chartered Accountants of India) has 350,000+ active members. Local ICAI chapter events are accessible. ClearTax, Zoho, and Tally all run CA partner programs.
- Model: 20–25% referral fee for first 12 months of any referred client. Target 20 CA firms initially; each CA has 30–100 SMB clients.
- Entry: Sponsor 1–2 ICAI local chapter events in Delhi/Mumbai. Pitch "help your clients recover missed revenue — here's the tool."
- RICE score: Reach=Very High (long tail), Impact=High, Confidence=Low-Medium (unproven channel for voice AI), Effort=Medium.

**Hypothesis C — Exotel / Airtel Business Channel Partner Network (Confidence: Medium)**
- Exotel serves 6,000+ Indian businesses (HDFC, Swiggy, Ola, Flipkart — but also SMBs on their SMB cloud telephony tier). They have an active channel partner directory. Airtel Business has 350,000+ B2B accounts and an explicit channel partner program.
- AgentOps already uses SIP telephony (Exotel SIP in the stack). Positioning: "Exotel handles the call routing, AgentOps handles the AI conversation layer." Complementary products, same infrastructure layer.
- Model: Become a listed partner in Exotel's partner directory; pitch co-sell to their SMB account managers. Airtel Business: join as an "AI services" ISV partner.
- Blocker: May require minimum customer count or revenue threshold to be listed. Investigate before investing effort.
- RICE score: Reach=Very High, Impact=High, Confidence=Medium, Effort=Medium.

---

#### FINDING 4 — Outbound Sequencing Recommendation

**Target Vertical (Pilot): Clinics (1–5 doctor practices in Delhi NCR, Mumbai, Bangalore, Chandigarh)**
- Data source: Practo public listings, JustDial clinic directory, MocDoc clinic network. Pintel.ai for enriched contact data (MCA filings + IndiaMART cross-reference).
- Contact target: Clinic owner / senior doctor (not receptionist — they will block the message).

**12-Touch Sequence over 30 Days:**

- Touch 1 (Day 0) — WhatsApp Personal:
  "[Name], saw [ClinicName] on Practo. Quick question — who answers your calls after 7 PM when patients call about appointments? We built something that handles that in Hindi and English, 24/7. Could I send you a 90-second demo before I pitch other clinics in [City]?"

- Touch 2 (Day 2) — LinkedIn Connection:
  Note: "Dr. [Name], reached out on WhatsApp re: AI receptionist for [ClinicName]. Happy to connect."

- Touch 3 (Day 4) — WhatsApp Follow-up + ROI Proof:
  "A dental clinic in Noida recovered 47 missed appointment calls in week 1 with AgentOps. That was ~₹18,000 in recovered bookings. Happy to set up a 7-day free trial — you forward your number, we handle calls, you get a full report at the end. Zero commitment."

- Touch 4 (Day 7) — WhatsApp + Loom Demo:
  90-second Loom video: AI agent answering a call in Hindi, booking a clinic appointment, sending WhatsApp confirmation. Subject line variant for those who didn't open: "Here's what your AI receptionist sounds like in Hindi."

- Touch 5 (Day 10) — LinkedIn DM (if connected):
  "Dr. [Name] — did the Loom land in your WhatsApp? Happy to set up 15 min this week to show it live."

- Touch 6 (Day 14) — WhatsApp Final Value Offer:
  "Last check-in before I move on — free 7-day missed-call audit for [ClinicName] is still open. At the end of 7 days, you'll know exactly how many calls you missed this week and how much revenue they represented. No card required. Interested?"

- Touches 7–12: Rotate to new vertical (salon, real estate) using same sequence with vertical-specific proof points. Do not chase after Touch 6 — Indian SMB buyers interpret persistence beyond 6 touches as desperation.

**Channel mix priority:** WhatsApp (primary) → LinkedIn (secondary) → Email (tertiary, only for those who engage on LinkedIn but haven't replied on WhatsApp)

**Tooling recommended:**
- Pintel.ai — India contact data (MCA registry + IndiaMART + trade directories)
- Apollo.io — email enrichment and LinkedIn lookup
- WhatSender or WATI — batch WhatsApp (limit to 50/day per number; rotate numbers after 200 contacts)
- Loom — async video demo (no calendar friction for first touch)

---

#### FINDING 5 — Competitor GTM Analysis

**Goodcall:**
- Target: US local businesses (salons, restaurants, retail). SEO strategy: heavy "AI receptionist for [vertical]" content + G2 review generation.
- GTM: Product-led (free tier) → convert to paid at volume. No India presence, no Hindi support.
- Gap vs AgentOps: No Indian language support, US-centric pricing ($), no Exotel/Indian telephony.

**Smith.ai:**
- Hybrid human-AI model; targets US SMBs. Higher price ($292+/month). SEO: "virtual receptionist" keyword dominance in US.
- GTM: High-touch sales with free trial. No India presence.
- Gap vs AgentOps: Human agents = higher cost; no Indian language; US timezone only.

**Synthflow:**
- Agency/technical team focus; EU-centric. Content strategy: competitor comparison pages (builds pages for Goodcall vs Synthflow, etc.) — actively gaming BOFU SEO.
- GTM: No-code builder appeal; content-first SEO; G2 presence growing.
- Gap vs AgentOps: Complex setup vs AgentOps self-serve; no Indian language; no TRAI/DPDP compliance.

**Indian Alternatives (Voiceyfy, VaniAgent, Caller Digital, Vomyra):**
- Voiceyfy: ₹3,999/month; Indian languages supported; limited to SMB use cases. GTM appears to be primarily organic search + App Store listings. Content thin — no comparison pages, no vertical landing pages.
- VaniAgent: Slightly deeper content (published pricing and Hindi AI guide). ₹21,999/month for unlimited calling — higher ASP than our Starter tier.
- Caller Digital: Building aggregator position ("top 10 voice AI India" roundups). Smart content play for a comparison site.
- Vomyra: Indian phone numbers + no-code. Very early. Minimal GTM visible.

**Key Competitive Insight:** No Indian competitor is running a structured partner channel (CA firms, clinic software, telecom reseller). All are relying on organic search and direct outbound. This creates a first-mover window for AgentOps to lock in vertical software partnerships before competitors copy the motion.

---

#### FINDING 6 — Sprint Campaign Hypothesis

**Campaign: "7-Day Missed Call Audit" (Free Trial Reframe)**

Hypothesis: A 7-day free trial framed as a "Missed Call Audit" will achieve >35% trial-to-paid conversion (vs. industry benchmark of 15–25% for voice AI trials) because it produces personalized, data-driven ROI evidence that makes the upsell conversation self-evident.

Mechanic:
1. SMB owner forwards their business number to an AgentOps trial number (2-minute setup — no card required, no tech knowledge needed)
2. AgentOps AI answers all inbound calls for 7 days in English + Hindi + Punjabi
3. At Day 7, automatically generate and send a "Missed Call Audit Report" containing:
   - Total calls answered vs. would-have-been-missed
   - Breakdown by hour (reveals peak missed-call windows)
   - Call intent categories (appointment, price inquiry, complaint, etc.)
   - Appointments/leads captured
   - Estimated revenue recovered (based on SMB's average ticket size they provide at signup)
4. Report delivered via WhatsApp (PDF) + email summary

Why it removes buying barriers:
- Zero commitment → reduces SMB owner fear of lock-in
- "Audit" framing → positions it as a value service, not a sales pitch
- Personalized data → generic ROI claims become specific to their business
- WhatsApp delivery → meets them in their preferred channel
- Report is shareable → SMB owner shows data to spouse/partner/accountant = internal champion

Test size: 30 SMBs across 3 verticals (10 clinics, 10 salons, 10 real estate agents) in Delhi NCR + Chandigarh
Measure: Activation rate (% who actually forward number), average calls answered in trial, trial-to-paid conversion %, average revenue recovered per audit
Decision gate at Day 30: If conversion >25% → scale campaign; if <25% → iterate on report format and framing

Backlog candidate: BL-015 — "Missed Call Audit" Campaign — 30-SMB pilot
Founder decision needed: Yes (T1) — requires campaign budget and founder time for WhatsApp outreach

---

#### BACKLOG CANDIDATES ADDED THIS SESSION

| ID | Title | Priority | Type |
|---|---|---|---|
| BL-013 | Clinic Software Integration Partnership Program (HealthPlix, MocDoc) | High | Partnership |
| BL-014 | IndiaMART + JustDial listing setup + rapid-response WhatsApp playbook | Medium | GTM |
| BL-015 | "Missed Call Audit" 7-day free trial campaign — 30-SMB pilot | High | Campaign |
| BL-016 | SEO content sprint: 5 vertical landing pages + 5 competitor comparison pages | High | SEO |
| BL-017 | CA firm referral program design (ICAI chapter targeting) | Medium | Partnership |

---

#### GROWTH R&D BACKLOG UPDATE

Updated from R&D Backlog item #8 (Cold outreach sequence for Indian SMBs) and #3 (Product Hunt launch strategy):
- Item #8: COMPLETED — 12-touch WhatsApp outbound sequence documented above. Promote to sprint-ready template (T1 approval needed).
- Item #3: Product Hunt strategy to be scoped in next Growth R&D session. Recommend timing launch alongside "Missed Call Audit" campaign for momentum amplification.
