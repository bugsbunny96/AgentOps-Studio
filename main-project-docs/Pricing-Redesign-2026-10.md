# AgentOps Studio — Pricing Redesign (Unit Economics, Competitors, Recommendation)

> **Version history**
> - [2026-10-08 11:45] v1.1 — CEO Agent — **Adopted by the founder** and implemented on branch `feat/pricing-v2` (gaps.md § 15, TASK-BOARD Wave 7). Not built from § 5: a second phone number on Pro (PRC-08) and auto top-up.
> - [2026-10-08 11:30] v1.0 — CEO Agent — Audit of current plans against verified Oct 2026 vendor prices; redesigned plan set; profit projections. Proposal only. Changing prices is a **T0 founder decision**.

All prices are **ex-GST** unless marked. GST (18%) is collected on top and paid to the government, so it is **not revenue**. FX: **$1 = ₹96.77** (7 Oct 2026). Labels: **[V]** verified price, **[E]** estimate, **[A]** assumption.

---

## 0. Decision summary

| | Current | Recommended |
|---|---|---|
| Plans | Basic ₹9,999 · Standard ₹17,999 · Pro ₹25,999 | **Starter ₹4,999 (new)** · Basic ₹9,999 · Standard ₹17,999 · **Pro ₹29,999** |
| Extra minutes | Advertised but cannot be billed; Pro is hard-capped at 3,000 min | **Prepaid top-up packs** (₹20/min, or ₹18/min in a 500-min pack). Pro allowance set to 1,500 min + packs |
| Margin at 100% of allowance | Basic 48% · Standard 47% · **Pro −2% (−36% with premium voices)** | Starter 50% · Basic 48% · Standard 47% · Pro 37% (premium voice on every minute) / 51% (standard voice) |
| Expected margin (60% use) | 63% blended | **63.5% blended**, and no plan can lose money |
| Setup fee | ₹9,999 / ₹14,999 / ₹24,999 (cannot be billed yet) | ₹0 / ₹4,999 / ₹4,999 / ₹14,999, **waived on annual** |
| Annual | none | Pay 10 months, get 12 |

**Main finding:** Basic and Standard are priced correctly. Pro can lose money: 3,000 min plus free premium voices at ₹25,999 loses up to **₹9,303 per customer per month**. The fix is to price Pro correctly, sell extra minutes as prepaid packs, and add a ₹4,999 entry plan to widen the funnel.

---

## 1. Cost drivers in the product (from the codebase)

| Component | Where | Cost type |
|---|---|---|
| Vapi orchestration (per connected minute) | `agents/vapi.service.ts` | Variable |
| Deepgram STT (nova-3 multi), billed through Vapi | assistant config | Variable |
| LLM (`LLM_MODEL`, default gpt-4o-mini) | `config/llm.ts` | Variable |
| TTS (OpenAI `nova` default; Vapi Naina; ElevenLabs premium) | `agents/voice-pricing.ts` | Variable |
| Vapi end-of-call analysis + structured output (LLM calls per call) | `webhook.service.ts` | Variable (in buffer) |
| Vobiz SIP minutes + DID rental | `telephony/*` | Variable + per-customer fixed |
| Vapi concurrency lines (**account-wide: 4 free, shared by all tenants**) | Vapi account | Step-fixed |
| Stripe (2% + 0.7% Billing) | `billing.service.ts` | % of revenue |
| Render, Vercel, Atlas, Redis, Sentry, Resend, n8n | infra | Fixed |
| Trial minutes (30 min × each trial) | `TRIAL_CALL_MINUTES` | Acquisition cost |

Per-call guard already in place: `maxDurationSeconds: 900` (15 min). There is **no per-org concurrency limit**: with only 4 Vapi lines for the whole account, a 5th simultaneous call from any tenant fails.

---

## 2. Cost breakdown

### 2.1 Variable cost per call-minute (default stack)

| Component | Basis | $/min | ₹/min | Label |
|---|---|---|---|---|
| Vapi platform | $0.05 per connected minute | 0.0500 | 4.84 | [V] |
| Deepgram Nova-3 multilingual streaming | $0.0092 regular PAYG ($0.0058 promo) | 0.0092 | 0.89 | [V] |
| GPT-4o-mini | $0.15 in / $0.60 out per 1M tokens; ~20k input + ~400 output tokens per min | ~0.0040 | 0.39 | price [V], tokens [E] |
| OpenAI TTS `nova` | ~500 chars/min spoken (`voice-pricing.ts`) | ~0.0075 | 0.73 | [E] |
| Vobiz inbound minutes | ₹0.45/min, per-second billing | — | 0.45 | [V, third-party Aug 2026, confirm in Vobiz console] |
| **Subtotal** | | | **7.29** | |
| Buffer +15% | FX movement, analysis/summary LLM calls, longer prompts, retries | | 1.09 | [A] |
| **Planning cost per minute (C)** | | | **₹8.40** | |

**Variants (₹/min, planning):**
- Premium voice (ElevenLabs): **+₹2.90** (+$0.03) [E]
- Vapi native Naina: about +₹0.7 [E]
- GPT-4o (live Ritu assistant until COST-06): **₹12.90/min** [E]. Running COST-06 cuts the minute cost by about 35%.

> Replace C with the measured figure once `scripts/backfill-call-costs.ts` has run. The margin page now reads Vapi's real `costBreakdown`.

### 2.2 Per-customer monthly fixed costs

| Item | ₹/month | Label |
|---|---|---|
| Vobiz DID (one number per customer) | 600 | [V, third-party: "₹600+/month"] |
| Vapi concurrency allowance (4 lines free; $10/line ≈ ₹968; about 1 extra line per 10 customers) | 100 | price [V], ratio [A] |
| **Per-customer fixed (F)** | **700** | |
| Stripe | 2.7% of price (2% domestic card + 0.7% Billing) | [V] |

### 2.3 Platform fixed costs (launch-safe stack, monthly)

| Item | USD | ₹ | Label |
|---|---|---|---|
| Render web service, 1 CPU / 2 GB (the free plan sleeps) | 25 | 2,419 | [V] |
| Render Key Value 256 MB / 200 connections (replaces the 30-connection Redis free tier) | 10 | 968 | [V] |
| MongoDB Atlas Flex (upper bound) | 30 | 2,903 | [V] |
| Vercel Pro (Hobby is non-commercial) | 20 | 1,935 | [E] |
| Sentry Team | 26 | 2,516 | [E] |
| Resend Pro | 20 | 1,935 | [E] |
| n8n Community, self-hosted on Render 1 CPU | 25 | 2,419 | [V] |
| OpenAI direct (crawler, KB, reports) | 10 | 968 | [E] |
| Domain, workspace, misc tools | — | 3,000 | [A] |
| **Total** | | **≈ ₹19,000** | |

Today you run mostly on free tiers (about ₹0–3k/month), and that setup is not safe for launch. Founder salary is **excluded** from every table.

Step-ups [A]: 50 customers ₹60k (Atlas M10 at $56.94, plus 1 onboarding/support hire at ₹35k); 100 → ₹1.1L; 250 → ₹3.55L (5 support + 1 engineer); 500 → ₹7L.

---

## 3. Current plans — audit

**Formulas**
- `Cost = minutes × C + F + 2.7% × Price` (premium voice: C + ₹2.90)
- `Gross margin = (Price − Cost) / Price`
- `Break-even minutes = (Price × 0.973 − F) / C`

| Plan | Price | Allowance | Cost @100% | GP @100% | Margin @100% | Margin @60% | Break-even min |
|---|---|---|---|---|---|---|---|
| Basic | ₹9,999 | 500 | ₹5,170 | ₹4,829 | 48.3% | 65.1% | 1,075 |
| Standard | ₹17,999 | 1,000 | ₹9,586 | ₹8,413 | 46.7% | 65.4% | 2,002 |
| Pro (UI says 1,500) | ₹25,999 | 1,500 | ₹14,002 | ₹11,997 | 46.1% | 65.5% | 2,928 |
| **Pro (backend cap 3,000)** | ₹25,999 | 3,000 | ₹26,602 | **−₹603** | **−2.3%** | 36.5% | 2,928 |
| **Pro, 3,000 min premium voice** | ₹25,999 | 3,000 | ₹35,302 | **−₹9,303** | **−35.8%** | 16.4% | 2,177 |

**Issues**
1. **Pro can lose money.** The 3,000-minute backend cap (BIZ-04) plus free premium voices (COST-07) puts the worst case below cost.
2. **Overage, recharge and setup fees cannot be billed** (BIZ-05). Heavy users are blocked instead of paying, which loses revenue and leaves a dead phone line.
3. **The pricing doc of 2026-09-17 overstates margins** (60% / 56% / 54%). It left out the per-customer DID, Stripe fees and the current FX rate.
4. **The entry price is ₹11,799 with GST.** Indian AI-voice vendors start at ₹800–3,000/month, so a first-time SMB has no low-risk step in.
5. **The live Ritu assistant is still on GPT-4o** (₹12.9/min). At full use, Basic margin would fall to about 26%. Run COST-06.
6. **Collections risk [V for rule, confirm with Stripe]:** RBI e-mandate rules require extra authentication for recurring card debits above ₹15,000. Standard (₹21,239 with GST) and Pro renewals will need the customer to approve each month. Push annual plans, UPI AutoPay or NACH for these plans.

---

## 4. Competitor benchmarks

FX ₹96.77/$. Effective ₹/min = price ÷ included minutes.

| Competitor | Plan | ₹/month | Included | Effective ₹/min | Notes |
|---|---|---|---|---|---|
| Rosie (US) | Professional / Scale / Growth | 4,742 / 14,419 / 28,934 | 250 / 1,000 / 2,000 min | 19.0 / 14.4 / 14.5 | English, US numbers |
| Reception.ai (US) | Plus / Premium | 7,645 / 19,257 | 275 / 1,000 min | 27.8 / 19.3 | |
| Dialzara (US) | Pro / Elite | 9,580 / 33,773 | 220 / 1,000 min | 43.5 / 33.8 | Overage $0.35–0.48/min |
| My AI Front Desk (US) | Business | 9,580 | 200 min | 47.9 | |
| Goodcall (US) | Starter / Growth | 7,645 / 12,483 | 100 / 250 callers | per caller | Unlimited minutes |
| Smith.ai AI (US) | Base | 9,193 | 50 calls | ₹184/call | |
| Agni / Ravan (IN) | Platform | 2,999 + usage | — | from ₹2 (vendor claim) | Self-build |
| ConnectAI (IN, clinics) | Receptionist | 800 + usage | — | ₹4 | Single niche |
| Bolti (IN) | PAYG | — | — | ₹6 | Platform |
| HuskyVoice (IN) | Starter | ≈3,333 (₹39,990/yr) | n/a | — | |
| India market range | | Platform fee ₹15k–2L (enterprise) | | ₹2–12 (₹3–6 typical) | Mostly DIY platforms |
| Human tele-caller (IN) | | 18,000–35,000 | 1 shift | — | Not 24/7 |

**What this means**
- Indian per-minute platforms (₹2–6/min) sell **below our cost** (₹7.3/min). They are DIY tools, so don't compete on ₹/min.
- Done-for-you receptionists globally charge **₹14–48 per included minute**. Our ₹18–25 is in the middle of that range, with Hindi and Punjabi, Indian numbers, order capture and setup included. Competitors don't offer that combination.
- Customers expect: a low self-serve entry (₹4–8k), about 1,000 min near ₹15–20k, and a top tier with integrations and priority support.

---

## 5. Recommended pricing

### 5.1 Plans

| | **Starter (new)** | **Basic** | **Standard** ⭐ | **Pro** |
|---|---|---|---|---|
| Price (ex-GST) | **₹4,999** | **₹9,999** | **₹17,999** | **₹29,999** (was ₹25,999) |
| + 18% GST | ₹900 | ₹1,800 | ₹3,240 | ₹5,400 |
| Customer pays | ₹5,899 | ₹11,799 | ₹21,239 | ₹35,399 |
| Annual (pay 10 months) | ₹49,990 | ₹99,990 | ₹1,79,990 | ₹2,99,990 |
| Included minutes | 200 | 500 | 1,000 | 1,500 (3,000 hard cap removed) |
| ≈ calls (at 4 min, the project's average) | 50 | 125 | 250 | 375 |
| Effective ₹/min | 25.0 | 20.0 | 18.0 | 20.0 (premium voice included) |
| Simultaneous calls | 1 | 2 | 3 | 5 |
| Phone numbers | 1 | 1 | 1 | 2 (not built — PRC-08; sold as 1 for now) |
| Premium voices | Add-on ₹1,499 | Add-on ₹2,999 | Add-on ₹4,999 | Included |
| Setup | Self-serve ₹0 | ₹4,999 (waived annual) | ₹4,999 (waived annual) | ₹14,999 managed (waived annual) |
| Features | Only what is built today (BIZ-07: no "coming soon" items listed as included) | | | |

### 5.2 Extra minutes (all plans): prepaid top-up packs

| Pack | Price | ₹/min | Our cost | Margin |
|---|---|---|---|---|
| 100 min | ₹2,000 | 20 | ₹840 + 2.7% | 55.3% |
| 500 min | ₹9,000 | 18 | ₹4,200 + 2.7% | 50.6% |

Rules: valid 90 days; used after the plan allowance. Alerts at 80% and 100%. Auto top-up of a 100-min pack is opt-in. If nothing is left, the agent takes a message or forwards the call to the owner's mobile instead of going dead. Packs are **one-time payments**, so they avoid the RBI variable-mandate problem and need no metered Stripe billing.

### 5.3 Plan-wise profit and margin

Same formulas as § 3. Pro is shown at worst case: every minute on a premium voice, plus a 2nd DID (+₹600).

| Plan | Price | Cost @100% | GP @100% | Margin @100% | Margin @60% | Margin @30% | Break-even min | ≥50% margin up to |
|---|---|---|---|---|---|---|---|---|
| Starter | ₹4,999 | ₹2,515 | ₹2,484 | 49.7% | 63.1% | 73.2% | 496 | 198 min |
| Basic | ₹9,999 | ₹5,170 | ₹4,829 | 48.3% | 65.1% | 77.7% | 1,075 | 480 min |
| Standard | ₹17,999 | ₹9,586 | ₹8,413 | 46.7% | 65.4% | 79.4% | 2,002 | 930 min |
| Pro (premium voice) | ₹29,999 | ₹19,060 | ₹10,939 | 36.5% | 59.1% | 76.0% | 2,468 | 1,141 min |
| Pro (standard voice) | ₹29,999 | ₹14,710 | ₹15,289 | 51.0% | 67.8% | 80.4% | 3,320 | 1,534 min |
| Annual, Basic (60% use) | ₹8,332/mo | — | — | 58.7% | | | | |

The allowance is a hard ceiling: any minute beyond it is a paid pack minute at 50–55% margin. **So no customer can push a plan below 36% margin.**

### 5.4 Abuse protection
- Plan allowance plus packs are enforced at `assistant-request` (already built; reset fixed in BIZ-01).
- 15-minute per-call cap (already set). Per-org concurrency limit = plan's simultaneous calls (new).
- Outbound calls gated by plan, minutes and Owner role (BIZ-06).
- Premium voice only on paid plans or the add-on (already built).
- Trial: 7 days / 30 min, costing about ₹252 per trial plus a shared-pool number.

---

## 6. Monthly profit projection

Mix [A]: Starter 30% · Basic 35% · Standard 25% · Pro 10%. Average use 60% of allowance. **No pack revenue** (conservative).
Average revenue per customer **₹12,499**; average GP **₹7,940 (63.5%)**.

| Customers | MRR | Gross profit | Fixed costs [A] | Operating profit | Op. margin |
|---|---|---|---|---|---|
| 10 | ₹1,24,990 | ₹79,401 | ₹19,000 | **₹60,401** | 48.3% |
| 25 | ₹3,12,475 | ₹1,98,502 | ₹22,000 | **₹1,76,502** | 56.5% |
| 50 | ₹6,24,950 | ₹3,97,005 | ₹60,000 | **₹3,37,005** | 53.9% |
| 100 | ₹12,49,900 | ₹7,94,010 | ₹1,10,000 | **₹6,84,010** | 54.7% |
| 250 | ₹31,24,750 | ₹19,85,025 | ₹3,55,000 | **₹16,30,025** | 52.2% |
| 500 | ₹62,49,500 | ₹39,70,050 | ₹7,00,000 | **₹32,70,050** | 52.3% |

- **Break-even on platform costs:** ₹19,000 ÷ ₹7,940 = **3 customers**. Covering an illustrative ₹1.5L/month founder salary as well needs (19,000 + 1,50,000) ÷ 7,940 = **22 customers**.
- **Stress case (90% use, no packs):** average GP falls to ₹6,209 (49.7%). At 100 customers, operating profit is ₹5.11L.
- **Scale lever (not in the base case):** above about 20–30k min/month (about 66 customers at 381 avg min), an own Vobiz → Pipecat/LiveKit stack removes most of Vapi's ₹4.84/min (RD-LOG). That lifts margins about 15–25 points without changing prices.
- GST: + 18% on every invoice and passed to the government. GST on imported Vapi/OpenAI/Render services (reverse charge) and on Stripe fees is claimable as input credit once you are GST-registered. Profits above are **before income tax**.

---

## 7. Customer value vs price

| Plan | Customer pays (incl. GST) | ≈ calls/month | ₹ per call (ex-GST) | Compared with |
|---|---|---|---|---|
| Starter | ₹5,899 | 50 | ₹100 | Smith.ai AI ₹184/call |
| Basic | ₹11,799 | 125 | ₹80 | Part-time human: one shift, not 24/7 |
| Standard | ₹21,239 | 250 | ₹72 | Tele-caller ₹18–35k fully loaded, one shift |
| Pro | ₹35,399 | 375 + 2 numbers | ₹80 | Two-person front desk |

**Payback formula to show prospects:**
`Monthly value = recovered calls × conversion % × average gross profit per order`.
Example: Basic pays for itself if the agent recovers **10 orders at ₹1,000 gross profit each**. Use the customer's own numbers and the ROI-01 monthly report to prove it.

---

## 8. Final recommendation

1. **Adopt the 4-plan table in § 5.1.** Starter ₹4,999 (new), Basic and Standard unchanged, **Pro ₹29,999 with 1,500 min** (removes the 3,000 cap). Expected blended margin **≈63%**, floor **≈37%**.
2. **Sell extra minutes as prepaid packs** (₹2,000 / 100 min, ₹9,000 / 500 min) instead of post-paid overage. This is simpler to build (one-time Stripe Checkout), safe under RBI rules, and never loses money.
3. **Cut setup fees to ₹0 / ₹4,999 / ₹4,999 / ₹14,999 and waive them on annual.** Push annual plans (2 months free) for cash flow and to avoid the monthly e-mandate approval on plans above ₹15,000.
4. **Before charging anyone:** run COST-06 (GPT-4o → mini), move off free-tier infra (≈₹19k/month), buy Vapi concurrency lines as customers grow, and run the call-cost backfill to replace the ₹8.40 estimate with measured cost.

**Key assumptions to check:** ₹8.40 per minute; 60% average use; 4-min average call; plan mix 30/35/25/10; Vobiz rates (third-party source); staffing step-ups.

**Build items this implies** (H-tasks, after founder approval): Starter plan and Stripe price; Pro price and `PLAN_LIMITS` 3,000 → 1,500 + pack balance (BIZ-04/05); pack checkout + balance + 80/100% alerts; per-org concurrency limit; graceful fallback at zero balance; setup-fee line item (OFR-01).

---

## Sources
- Vapi: [Trillet, Vapi pricing per minute (Sep 2026)](https://trillet.ai/blogs/vapi-pricing-per-minute) · [CloudTalk Vapi pricing](https://cloudtalk.io/blog/vapi-ai-pricing)
- Vobiz / Plivo India: [AutoInterviewAI comparison (Aug 2026)](https://www.autointerviewai.com/blog/plivo-vs-vobiz-sip-provider-india-ai-calling-2026) · [Vobiz pricing](https://www.vobiz.ai/pricing/)
- Deepgram: [diyai.io Deepgram pricing 2026](https://diyai.io/ai-tools/speech-to-text/deepgram-pricing-2026/)
- OpenAI LLM prices: `backend/src/config/llm.ts` (checked 2026-10-02) · [OpenAI pricing](https://openai.com/api/pricing/)
- Stripe India: [stripe.com/in/pricing](https://stripe.com/in/pricing)
- Render: [render.com/pricing](https://render.com/pricing) · MongoDB: [mongodb.com/pricing](https://www.mongodb.com/pricing) · n8n: [n8n.io/pricing](https://n8n.io/pricing/)
- FX: [dollarrupee.in (7 Oct 2026)](https://dollarrupee.in/)
- Competitors: [Dupple, best AI receptionists 2026](https://dupple.com/learn/best-ai-receptionists) · [MyOperator, voice AI pricing India 2026](https://myoperator.com/blog/voice-ai-agent-pricing-india-2026) · [Caller Digital, voice AI pricing India](https://caller.digital/voice-ai-pricing-india) · [Ravan.ai, voice AI cost India](https://www.ravan.ai/blog/voice-ai-agent-cost-india-2026) · [ConnectAI, AI receptionist for clinics](https://www.connectai.care/learn/best-ai-receptionist-for-clinics-india)
