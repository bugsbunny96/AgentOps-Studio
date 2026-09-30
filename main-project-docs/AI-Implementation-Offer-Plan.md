# AgentOps Studio — AI Implementation Offer Plan

> **Version history**
> - [2026-09-30 10:40] v1.0 — CEO Agent — Created from (a) a review of the "AI Implementation business" post (@kekoamac, Instagram, 2026-09-30) and (b) the 2026-09-29 codebase audit (`gaps.md` v2.0). Defines the offer model, the gap between the post and the product, the new gap IDs (§ 5) and the sprint sequence after S-HARDEN (§ 6). Items marked **PROPOSED** need a founder decision.

**Status**: PROPOSED — awaiting founder sign-off on the decisions in § 8.
**Related docs**: `gaps.md` (gap IDs), `TASK-BOARD.md` (sprints), `AgentOps Studio — SaaS Pricing & Stripe Setup.md` (plans and setup fees).

---

## 1. Summary

The post describes a business model, not a feature: pick **one niche**, find **one expensive bottleneck**, and sell the **problem handled**, with Claude for planning, **n8n** to connect the client's CRM, calendar and follow-up tools, and a contractor for the build. Then turn delivery into an SOP and repeat it for similar businesses.

AgentOps Studio already solves the post's first example, **missed calls**. It does not yet cover **follow-up, appointment booking, CRM/calendar connection or proof of results**, and it is marketed to four sectors while only one (electrical retail) works end to end.

**Recommendation**: keep AgentOps Studio as the product. Add a **managed "AI implementation" offer** on top of it (setup fee + monthly plan), aimed at **one beachhead niche**, and build the integration layer that lets each client's own tools plug in through n8n.

---

## 2. What the post prescribes (source: caption + 7 slides)

| # | Step | Post's wording (paraphrased) |
|---|---|---|
| 1 | Find the niche | Rank 10 local-business niches by urgency, ability to pay, simplicity of implementation and how fast you can understand the business. Pick one. |
| 2 | Find the expensive problem | Map how a lead becomes a customer: where calls are missed, leads sit untouched, appointments fall through, staff repeat manual work. Pick the simplest workflow to turn into a repeatable offer. "The business problem comes before the AI tool." |
| 3 | Build the offer | Current workflow → improved workflow → what gets implemented → business outcome → what ongoing management includes → what a contractor builds. "You are not selling another tool. You are selling a better process." |
| 4 | Get the first client (30 days) | Targeted prospect list, the problem to look for, a short outreach message, a simple demo, discovery-call questions. "Reach the right owner with the right problem." |
| 5 | Make delivery repeatable | Claude plans; pre-built AI tools; **n8n connects the client's CRM, calendar and follow-up systems**; contractor owns the build; founder is the client-facing operator. Turn it into an SOP. |

Business principle: *"The client pays to have the business problem handled, not to access another AI platform."*

---

## 3. Coverage: post vs. current product

| Post element | Current state (2026-09-30) | Evidence | Gap ID |
|---|---|---|---|
| Missed calls answered | ✅ Core product (Vapi agent, Vobiz numbers, 24/7, EN/HI/PA) — but blocked by P0s | `modules/calls`, `modules/agents`, `modules/telephony` | CORE-01…05, BIZ-01 |
| Slow follow-up fixed | 🟡 `followUpAlert` worker emails the owner when `followUpNeeded` is true, but the worker is **disabled** and the call data it needs is **dropped** | `jobs/followUpAlert.worker.ts`; `backend/src/index.ts` | CORE-01, CORE-02, **INT-04** |
| Appointments booked | ❌ No booking tool; flow is retail orders only | `modules/orders` | IND-02, **INT-03** |
| CRM / calendar / follow-up tools connected (n8n) | ❌ No outgoing webhooks, no event layer, no integration settings. Advertised on Pricing/Billing | `PricingPage.tsx`, `BillingPage.tsx` | BIZ-07, **INT-01, INT-02** |
| One niche | ⚠️ Marketed to logistics, real estate, healthcare; only electrical retail works | `IndustriesPage.tsx`; `prompt.utils.ts`; `scripts/vapi-evals` | IND-01…05, **GTM-01** |
| Measurable outcome | 🟡 Analytics shows volume + resolution rate only; no "captured / booked / ₹ value" view or report | `modules/analytics` | **ROI-01** |
| Paid, managed offer (setup + ongoing) | 🟡 Setup fees defined in the pricing doc but not billable; enterprise magic links exist (pre-filled, custom trial) | Pricing doc; `modules/enterprise-link` | BIZ-05, **OFR-01** |
| Repeatable delivery SOP | ❌ `agents/SOP.md` is the internal AI-agent operating SOP, not a client delivery SOP | `agents/SOP.md` | **OFR-02** |
| Simple demo | ❌ No niche demo agent or public demo number (evals and prompt are electrical-only) | `scripts/vapi-evals` | **GTM-02** |
| 30-day first-client plan | 🟡 Growth agent has an ICP and generic outbound sequences; nothing niche-specific | `agents/growth-agent.md` | **GTM-03** |

---

## 4. Target offer model (PROPOSED)

**One-line offer (template)**: *"We make sure every call to your [niche business] is answered, the lead is captured in your system, and follow-up or booking happens automatically — in [N] days, with a monthly results report."*

| Component | What the client gets | Who delivers | Priced as |
|---|---|---|---|
| Setup (one-time) | Discovery, knowledge base, number, industry template, n8n connection to their CRM/Sheets/calendar, test calls, go-live | Founder (operator) + contractor for n8n | Existing setup fees (₹9,999 / ₹14,999 / ₹24,999 + GST — pricing doc) |
| Platform (monthly) | AgentOps Studio plan (Basic / Standard / Pro) | Product | Existing plan prices |
| Managed service (monthly, optional) | Prompt/KB tuning, eval runs, monthly ROI report review | Founder | Included in Pro, or add-on — **founder decision** |

Rules: sell the outcome, not the platform; do not promise integrations that are not yet built (fix BIZ-07 first).

---

## 5. New gaps (added to `gaps.md` § 11)

| ID | Pri | Gap | Fix (summary — full spec in § 7) |
|---|---|---|---|
| GTM-01 | P1 | No single beachhead niche; marketing covers 4 sectors, product supports 1 | Score candidates (§ 7.1), pick one, align Industries/landing copy to it |
| INT-01 | P1 | No outgoing event webhooks — clients' tools cannot receive call outcomes | Signed, retried per-org webhooks (§ 7.2) |
| INT-02 | P1 | No n8n templates to connect CRM / Google Sheets / calendar | 3 importable n8n workflows + setup guide (§ 7.3) |
| INT-03 | P1 | No appointment-booking tool (overlaps IND-02) | `book_appointment` Vapi tool → n8n/calendar (§ 7.4) |
| INT-04 | P1 | Follow-up reaches only the owner's email; no lead-facing follow-up | Re-enable worker; add WhatsApp/SMS via provider or via n8n event (§ 7.5) |
| ROI-01 | P1 | No outcome metrics or monthly report | ROI dashboard card + monthly email (§ 7.6) |
| OFR-01 | P2 | Managed offer not productised (setup fee not billable; no service tier) | Stripe setup-fee line item (BIZ-05); define managed tier |
| OFR-02 | P2 | No client delivery SOP | `Client-Delivery-SOP.md` (§ 7.7) |
| GTM-02 | P2 | No niche demo agent / number | Demo org on the chosen industry template with a public number |
| GTM-03 | P2 | No niche 30-day acquisition plan | Prospect list, outreach script, discovery questions (§ 7.8) |

---

## 6. Sequence (after S-HARDEN)

| Sprint | Goal | Contents | Exit criteria |
|---|---|---|---|
| **S-HARDEN** (active) | Close every P0 | Waves 1–2 of `TASK-BOARD.md` (+ H4.2 claim cleanup pulled forward) | 0 open P0s; prod login verified; follow-up worker running |
| **S-NICHE** | Pick and prepare one niche | GTM-01 decision → H3.1 template contract → template for the chosen niche (prompt block, tools, schema, nav, ≥10 evals) | Niche template passes its eval set; Industries/landing aligned |
| **S-IMPLEMENT** | Integration layer | INT-01 → INT-02 → INT-03 (if the niche books appointments) → INT-04 | A test org pushes call events into Google Sheets + a CRM + a calendar through n8n |
| **S-PROOF** | Sell and prove | ROI-01, OFR-01, OFR-02, GTM-02, GTM-03 | 3 paying clients in the niche with a monthly ROI report |

Do **not** start before S-HARDEN closes: native CRM connectors, a second niche, new super-admin features.

---

## 7. Implementation specs

### 7.1 Niche scoring (GTM-01)
Score each candidate 1–5 on: urgency of the phone problem, ability to pay ≥ Basic + setup fee, simplicity (orders vs bookings vs complex intake), speed of understanding, existing proof (reference customer, eval set). Candidates to score: **electrical/hardware retail** (live reference customer, order flow built), **clinics** (appointment-heavy), **real estate** (lead-qualification heavy). Output: one niche + disqualified list, recorded in the Decision Log.

### 7.2 Outgoing events (INT-01)
- **Events**: `call.completed`, `lead.captured`, `followup.required`, `order.created`, `appointment.requested` (`appointment.booked` after INT-03).
- **Payload** (JSON): `event`, `eventId` (uuid, for idempotency), `occurredAt`, `organizationId`, `call` { `id`, `callerNumber`, `direction`, `duration`, `languageUsed`, `intent`, `summary`, `recordingUrl` }, plus event-specific data (`followUpReason`, order lines, requested slot).
- **Source**: emitted from the call-report worker after CORE-01 is fixed (structured output available).
- **Delivery**: new `integrations` module; per-org endpoints `{ url, events[], secret, active }` (Owner-only, SSRF-safe URL validation — reuse SEC-07 fix); BullMQ `webhook-delivery` queue on the **consolidated worker** (CORE-02); header `X-AOS-Signature: sha256=HMAC(secret, rawBody)`; retries with backoff (5 attempts); delivery log (last 100) shown in Settings → Integrations; "Send test event" button.
- **Plan gating**: via `getEffectivePlan` (H4.1) — tier to be decided.

### 7.3 n8n templates (INT-02)
Three importable workflows stored in `integrations/n8n/`: (1) Webhook → verify HMAC → Google Sheets row per call/lead; (2) Webhook → CRM create/update contact + note (Zoho CRM and HubSpot variants — choose by niche); (3) `appointment.requested` → Google Calendar event → confirmation message. Include a setup guide (credentials, where to paste the AgentOps webhook secret).

### 7.4 Appointment booking (INT-03, overlaps IND-02)
Vapi tool `book_appointment` { `name`, `phone`, `service`, `preferredDate`, `preferredTime`, `notes` } → backend tool route (same secret hardening as SEC-01) → emits `appointment.requested`; if the org has a calendar connection (n8n or native), return confirmed slot to the caller, else "request logged, team will confirm". Enabled only by industry templates that declare it.

### 7.5 Follow-up (INT-04)
1. Re-enable `followUpAlert` (depends on CORE-02) and fix payload (CORE-01).
2. Escape email content (SEC-09).
3. Emit `followup.required` (INT-01) so clients route follow-up to their own WhatsApp/CRM via n8n.
4. Optional native WhatsApp/SMS via an Indian BSP — only after a client asks; keep "coming soon" until then (BIZ-07).

### 7.6 ROI report (ROI-01)
Metrics per org per month: calls answered, after-hours calls answered (vs org business hours), leads captured (calls with intent ≠ other and a callback number), orders/bookings requested, follow-ups raised vs closed, average answer time, estimated value (client-entered average order/booking value × conversions). Show as a Dashboard card and send a monthly email (re-uses trial-email worker infra).

### 7.7 Client delivery SOP (OFR-02) — outline for `Client-Delivery-SOP.md`
Discovery call (bottleneck map, current workflow) → proposal (before/after, outcome target) → enterprise link with pre-filled plan → onboarding + KB → template + evals → n8n connection → test calls with client → go-live checklist → week-1 review → monthly ROI review. Define what the founder owns (client relationship, outcome) vs contractor (n8n build) vs product (agent).

### 7.8 30-day first-client plan (GTM-03)
Week 1: prospect list (50 businesses in the niche, one city) + problem hypothesis. Week 2: problem-first outreach (call-back test: call them after hours, note missed calls) + demo number (GTM-02). Week 3: discovery calls with the question set from § 7.7. Week 4: first paid setup; record baseline metrics for ROI-01.

---

## 8. Founder decisions required

| # | Decision | Default if not decided |
|---|---|---|
| D1 | Adopt "platform + managed implementation offer" as the go-to-market model | — (required) |
| D2 | Beachhead niche (§ 7.1) | Electrical/hardware retail (only vertical with a live customer and working flow) |
| D3 | Managed service: included in Pro, or paid add-on | Included in Pro |
| D4 | Which plan tiers get outgoing webhooks / n8n templates | Standard and Pro |
| D5 | CRM for the first n8n template | Google Sheets first; CRM chosen from first client |

## 9. Risks

- **Scope creep**: integrations before P0s are closed would ship on a broken base — keep the sprint order.
- **Over-promising**: pricing still lists unbuilt features (BIZ-07) — fix in S-HARDEN.
- **Redis limits**: every new queue (webhook delivery, reports) needs the worker consolidation (CORE-02) first.
- **Security**: client webhook URLs are user-supplied — SSRF-safe validation is mandatory (SEC-07 pattern).
