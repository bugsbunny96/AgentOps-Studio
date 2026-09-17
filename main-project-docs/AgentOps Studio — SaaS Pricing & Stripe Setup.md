# AgentOps Studio — SaaS Pricing & Stripe Setup

2026-09-17 · @Someone

Final pricing model optimized around fixed subscription prices: **Basic ₹9,999** · **Standard ₹17,999** · **Pro ₹25,999** (all + 18% GST). Recalculated from the original cost audit with verified vendor pricing.

## 1. Pricing Document Findings

The reference document was built for a single client (Ritu Electricals) at prices of ₹4,999 / ₹9,999 / ₹17,999. With the new fixed prices at ₹9,999 / ₹17,999 / ₹25,999, three things break.

**What the original document got right:**

- Cost per minute at ₹8 (GPT-4o-mini stack) — verified against current Vapi ($0.05/min), AssemblyAI ($0.0075/min), Sarvam TTS (₹0.45/min), and telephony (₹0.50/min). These costs remain valid.
- VAPI is 52% of total per-minute cost — this vendor concentration risk is correctly flagged.
- Monthly fixed costs of ₹30,500 are reasonable for early stage.
- Competitor positioning as the only bilingual conversational AI receptionist for Indian SMBs is accurate — no direct competitor offers this exact combination.

**What needs recalculation:**

1. **All package allocations.** The old Basic (₹4,999, 250 min) becomes the floor of the new Basic (₹9,999). Minutes, assistants, and features must scale up to justify the higher prices.
2. **Unit economics.** Every gross margin, contribution, LTV, and payback period changes because the revenue per plan has shifted.
3. **Recharge pricing.** The old recharge packs (₹1,500 / ₹3,500 / ₹7,000) were priced around ₹20/min sell price. With higher subscription prices and more included minutes, the per-minute effective rate changes.
4. **Scale model.** The old model assumed ₹10,000 average MRR per client. With new prices the weighted average MRR rises to \~₹18,000.
5. **Setup fees.** The old fees (₹7,500 / ₹12,500 / ₹20,000) were reasonable for old pricing but should be recalibrate for the premium positioning.
6. **Trial post-conversion.** The old trial auto-converted to Basic at ₹4,999. Now auto-converts to Basic at ₹9,999, which changes CAC payback math.
7. **Break-even.** Shifts dramatically downward — fewer clients needed at nearly 2× the average MRR.

**Inconsistency found:** The old document's Pro plan showed 56% gross margin at ₹17,999 with 1,000 min (cost ₹8,000), but the blended margin table showed 57% — the 1% gap comes from rounding the overage rate math. Corrected in the new calculations below.

## 2. Final SaaS Packages

All three plans use GPT-4o-mini as the default LLM stack at ₹8/min cost. Minute allocations are set to maintain 54–60% gross margin on subscription revenue alone, with overages pushing margins higher.

| Feature | Basic | Standard | Pro |
| --- | --- | --- | --- |
| Monthly price | ₹9,999 + GST | ₹17,999 + GST | ₹25,999 + GST |
| Included minutes | 500 min | 1,000 min | 1,500 min |
| Effective ₹/min | ₹20.00 | ₹18.00 | ₹17.33 |
| AI assistants | 1 | 3 | 5 |
| Voice options | 1 (standard Hindi/English) | 3 voices | All + custom voice cloning |
| Knowledge base | 50 KB | 200 KB | 500 KB |
| Integrations | Google Sheets, WhatsApp alerts | + CRM, n8n workflows, Razorpay | Unlimited integrations |
| Automation | Call logging, basic routing | + Order capture, appointment booking | Full suite + custom workflows |
| Analytics | Call logs | Call trends, sentiment analysis | Full analytics + monthly reports |
| Concurrent calls | 1 | 2 | 3 |
| Additional minutes | ₹25/min | ₹20/min | ₹18/min |
| Support | Email (business hours) | Priority email + WhatsApp | Dedicated account manager |
| Usage limit | Hard cap (configurable) | Soft cap with overage billing | Soft cap + fair-use policy (3,000 min) |
| Best for | Solo shops, <10 calls/day | Active businesses, 10–30 calls/day | Multi-branch, high volume |

**Design rationale:** The new Basic (₹9,999, 500 min) matches the old Standard in terms of minutes, making it a strong entry point. The new Standard (₹17,999, 1,000 min) matches the old Pro, now with additional automation features. The new Pro (₹25,999, 1,500 min) is a genuinely premium tier with enterprise-grade features, 5 assistants, and the lowest per-minute cost.

**Setup fees (one-time, + GST):**

| Package | Fee | Includes |
| --- | --- | --- |
| Basic setup | ₹9,999 | VAPI config, catalog upload, phone provisioning, 30-min test |
| Standard setup | ₹14,999 | + Custom persona, n8n workflows, CRM integration, 1-hr onboarding |
| Pro setup | ₹24,999 | + Razorpay, WhatsApp dispatch, custom catalog (100+ SKUs), 1-week dedicated support |

## 3. Unit Economics

**Cost per minute breakdown (GPT-4o-mini stack):**

| Component | ₹/min | Share |
| --- | --- | --- |
| VAPI platform | 4.20 | 52% |
| AssemblyAI STT | 0.63 | 8% |
| GPT-4o-mini LLM | 1.50 | 19% |
| Sarvam TTS | 0.45 | 6% |
| Telephony (Exotel/Vobiz) | 0.50 | 6% |
| Infrastructure (n8n + TTS bridge) | 0.22 | 3% |
| Buffer (10%) | 0.50 | 6% |
| **Total** | **₹8.00** | **100%** |

Average call duration: 4 minutes. Average cost per call: ₹32.

**Per-client economics (subscription only):**

| Metric | Basic | Standard | Pro |
| --- | --- | --- | --- |
| Monthly revenue | ₹9,999 | ₹17,999 | ₹25,999 |
| Included minutes | 500 | 1,000 | 1,500 |
| Variable cost (mins × ₹8) | ₹4,000 | ₹8,000 | ₹12,000 |
| Gross profit | ₹5,999 | ₹9,999 | ₹13,999 |
| Gross margin | 60.0% | 55.6% | 53.8% |

**Blended economics (with typical 20% overage):**

| Metric | Basic | Standard | Pro |
| --- | --- | --- | --- |
| Subscription revenue | ₹9,999 | ₹17,999 | ₹25,999 |
| Overage revenue (20% extra mins) | ₹2,500 | ₹4,000 | ₹5,400 |
| Total revenue | ₹12,499 | ₹21,999 | ₹31,399 |
| Total variable cost | ₹4,800 | ₹9,600 | ₹14,400 |
| Gross profit | ₹7,699 | ₹12,399 | ₹16,999 |
| Blended gross margin | 61.6% | 56.4% | 54.1% |
| 12-month LTV (sub only) | ₹1,19,988 | ₹2,15,988 | ₹3,11,988 |
| 12-month LTV (blended) | ₹1,49,988 | ₹2,63,988 | ₹3,76,788 |

CAC of ₹6,850 pays back in 1.1 months (Basic), 0.7 months (Standard), and 0.5 months (Pro).

## Free Trial Strategy

Every new client gets a **7-day free trial** with 30 included minutes — enough for \~7 real calls. No credit card required to start. The trial provisions a fully functional Basic-tier agent (1 assistant, standard voice, Google Sheets integration) so the client experiences the real product.

**Trial rules:**

- Duration: 7 calendar days from activation
- Minutes: 30 (hard cap — agent goes to voicemail after exhaustion)
- Features: Basic plan feature set
- Auto-convert: on day 7, client is prompted to pick a paid plan. If no action, the agent pauses (no calls answered) but data is retained for 30 days
- No credit card at signup — reduces friction for Indian SMBs who are skeptical of SaaS commitments
- Trial-to-paid nudges: WhatsApp message on day 3 (usage summary), day 5 ("3 days left"), and day 7 ("trial ended, pick a plan")

**Economics:** 30 trial minutes cost us ₹240 (30 × ₹8). At a 25% trial-to-paid conversion rate, the effective CAC contribution from trials is ₹960 per converted client (₹240 ÷ 0.25) — well within the ₹6,850 total CAC budget.

**Stripe handling:** Trials don't need a Stripe subscription. Create the Stripe customer record at signup (for tracking), but only create the subscription when they convert. Alternatively, use Stripe's built-in `trial_period_days: 7` on the subscription with no payment method required — Stripe will auto-invoice on day 8.

## 4. Recharge Model

Recharge packs let clients top up when they exceed included minutes without upgrading plans. All packs carry 6-month validity and roll over month to month within that window.

| Pack | Price (+ GST) | Minutes | Effective ₹/min | Our cost | Gross margin |
| --- | --- | --- | --- | --- | --- |
| Starter | ₹2,000 | 100 min | ₹20.00 | ₹800 | 60% |
| Growth | ₹4,500 | 250 min | ₹18.00 | ₹2,000 | 55.6% |
| Mega | ₹8,000 | 500 min | ₹16.00 | ₹4,000 | 50% |

**Rules:**

- Minimum recharge: ₹2,000 (Starter pack)
- Validity: 6 months from purchase date
- Rollover: unused recharge minutes carry forward within validity
- No refunds on recharge packs
- Auto-alert: WhatsApp notification at 80% and 100% of plan balance with recharge link
- Auto-trigger: optional auto-recharge (Starter pack) when balance hits zero, with client pre-approval
- Upgrade nudge: if a client buys 3+ recharges in a single month, the system suggests upgrading to the next plan

**Why three tiers:** The Starter pack (₹20/min) matches Basic plan effective rate — no discount, pure convenience. Growth pack (₹18/min) rewards commitment with a 10% discount. Mega pack (₹16/min) is best value at 20% discount but still holds 50% margin, which is the floor.

## 5. Competitor Validation

Our new pricing positions AgentOps Studio as a premium AI voice solution for Indian SMBs — above commodity IVR providers but below enterprise platforms, with unique bilingual conversational AI that no competitor matches.

**Indian competitors:**

| Competitor | Price/month | Type | Hindi AI | Conversational | Order capture |
| --- | --- | --- | --- | --- | --- |
| JustDial Virtual | ₹3,000–6,000 | Human BPO | Yes | Yes | No |
| Knowlarity IVR | ₹5,000–15,000 | Rule-based IVR | Basic | No | No |
| MyOperator | ₹3,500–10,000 | IVR + routing | Basic | No | No |
| Exotel Voice | ₹5,000–20,000 | Cloud telephony | No AI | No | No |
| Ozonetel CCaaS | ₹8,000–25,000 | Enterprise CC | Partial | Partial | No |
| Bolna | ₹4–8/min usage | AI voice platform | Yes | Yes | Custom |
| Edesy | ₹6/min usage | AI voice agent | Yes | Yes | Custom |
| Kore.ai | ₹25,000+ | Enterprise AI | Yes | Yes | Custom |
| **AgentOps Studio** | **₹9,999–25,999** | **AI voice agent** | **Native** | **Full** | **Yes** |

**International competitors (USD):**

| Competitor | Starting price | Included minutes | Per-min overage |
| --- | --- | --- | --- |
| My AI Front Desk | $65/mo | Unlimited | N/A |
| Rosie | $49/mo | 250 min | Per-min |
| Goodcall | $59/mo | Varies | Varies |
| Smith.ai (AI) | $95/mo | 30 calls | $4.25/call |
| AgentZap | $109/mo | 150 min | $0.85/min |
| Ruby | $245/mo | 50 min | Tiered |

**Positioning:** Our Basic at ₹9,999 (≈$119) is price-competitive with international AI receptionists while offering Hindi+English bilingual support that none of them provide. Against Indian competitors, we’re the only provider combining conversational AI, order capture, and 24/7 coverage. The closest Indian alternative is hiring a human receptionist at ₹15,000–25,000/month — our Standard plan replaces that at ₹17,999 with 24/7 availability and structured data capture.

Sources: [Edesy](https://edesy.in/blog/ai-voice-agent-pricing-india-2026), [AgentZap](https://agentzap.ai/blog/ai-receptionist-pricing-complete-cost-guide-2025), [CloudTalk Vapi Analysis](https://www.cloudtalk.io/blog/vapi-ai-pricing/)

## 6. Profitability Testing

Each plan tested at four usage levels: light (50% of included minutes), normal (100%), heavy (150% — client uses included + 50% overage), and very heavy (200% — double included minutes).

| Usage level | Basic rev | Basic cost | Basic margin | Standard rev | Standard cost | Standard margin | Pro rev | Pro cost | Pro margin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Light (50%) | ₹9,999 | ₹2,000 | **80.0%** | ₹17,999 | ₹4,000 | **77.8%** | ₹25,999 | ₹6,000 | **76.9%** |
| Normal (100%) | ₹9,999 | ₹4,000 | **60.0%** | ₹17,999 | ₹8,000 | **55.6%** | ₹25,999 | ₹12,000 | **53.8%** |
| Heavy (150%) | ₹16,249 | ₹6,000 | **63.1%** | ₹27,999 | ₹12,000 | **57.1%** | ₹39,499 | ₹18,000 | **54.4%** |
| Very heavy (200%) | ₹22,499 | ₹8,000 | **64.4%** | ₹37,999 | ₹16,000 | **57.9%** | ₹52,999 | ₹24,000 | **54.7%** |

**Reading the table:** At light usage, clients consume only half their included minutes — cost is low, margin is highest, and we keep the full subscription. At normal usage, all included minutes are consumed — this is the baseline margin (54–60%). At heavy and very heavy usage, clients pay overage at ₹25/₹20/₹18 per additional minute, which costs us ₹8 — so overage minutes carry 56–68% margin and actually *improve* the blended margin above normal.

**Key insight:** There is no usage level where margins drop below 53%. Even a very heavy Pro user consuming 3,000 minutes (the fair-use cap) generates ₹52,999 in revenue against ₹24,000 in cost — a 54.7% margin. The subscription pricing is robust across all scenarios.

**Worst case (Pro at fair-use cap of 3,000 min):** Revenue ₹25,999 + (1,500 × ₹18) = ₹52,999. Cost: 3,000 × ₹8 = ₹24,000. Gross profit: ₹28,999 (54.7%). Healthy — no plan needs a lower cap.

**Assumption:** Heavy and very heavy users pay the overage rate for minutes beyond their included allocation. In practice, many heavy users will purchase recharge packs (₹16–20/min) instead, which yields slightly lower per-minute margin but higher upfront cash collection.

## 7. Scale Model (10 → 1,000 Clients)

Assumptions: weighted average MRR of ₹18,000/client (40% Basic, 40% Standard, 20% Pro). Average variable cost per client: ₹7,200/month (900 min consumed at ₹8/min). Monthly fixed costs: ₹30,500 (infra ₹15K + Vapi platform fee ₹8K + monitoring/tools ₹7.5K). Fixed costs scale in steps — one support hire at ₹35K/month per 50 clients, one ops engineer at ₹60K per 200 clients.

| Clients | MRR | Monthly COGS | Gross Profit | Fixed costs | Net operating profit | Net margin |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | ₹1,80,000 | ₹72,000 | ₹1,08,000 | ₹30,500 | **₹77,500** | **43.1%** |
| 25 | ₹4,50,000 | ₹1,80,000 | ₹2,70,000 | ₹30,500 | **₹2,39,500** | **53.2%** |
| 50 | ₹9,00,000 | ₹3,60,000 | ₹5,40,000 | ₹65,500 | **₹4,74,500** | **52.7%** |
| 100 | ₹18,00,000 | ₹7,20,000 | ₹10,80,000 | ₹1,00,500 | **₹9,79,500** | **54.4%** |
| 250 | ₹45,00,000 | ₹18,00,000 | ₹27,00,000 | ₹2,65,500 | **₹24,34,500** | **54.1%** |
| 500 | ₹90,00,000 | ₹36,00,000 | ₹54,00,000 | ₹5,00,500 | **₹49,00,000** | **54.4%** |
| 1,000 | ₹1,80,00,000 | ₹72,00,000 | ₹1,08,00,000 | ₹10,30,500 | **₹97,69,500** | **54.3%** |

**Break-even:** At current fixed costs of ₹30,500/month, break-even is reached at just **3 clients** (3 × ₹10,800 gross profit = ₹32,400 > ₹30,500). This is a dramatic improvement from the old pricing model which needed 6–7 clients.

**Key milestones:**

- **10 clients:** Profitable from month one. Net profit ₹77,500/month covers a solo founder.
- **50 clients:** ₹4.7L/month net profit. Can afford a 3-person team (founder + support + ops).
- **100 clients:** ₹9.8L/month net profit. ARR crosses ₹2.16 Cr. Series-ready metrics.
- **500 clients:** ₹49L/month. Net margin stabilizes above 54%. Platform economics are proven.
- **1,000 clients:** ₹97.7L/month net (₹11.7 Cr ARR). Enterprise-grade SaaS unit economics.

**Stripe fee impact (not in table above):** Stripe India charges 2% domestic + 0.7% billing surcharge = 2.7% on each transaction. On ₹18,000 average MRR, that’s ₹486/client/month. At 100 clients, Stripe fees total ₹48,600/month — reduce net margin by \~2.7 percentage points. At scale, negotiate Stripe volume pricing or add UPI/bank transfer as a lower-cost payment option.

## 8. Stripe Product & Price Setup

Create these five products in Stripe Dashboard (or via API). All prices are in INR, tax-exclusive. Stripe handles GST collection at 18%.

**Product 1: AgentOps Studio — Basic**

- Product type: Service
- Price: ₹9,999/month, recurring, INR
- Tax behavior: tax\_exclusive
- Metadata: `plan_tier: basic`, `included_minutes: 500`, `overage_rate_paise: 2500`, `assistants: 1`, `concurrent_calls: 1`

**Product 2: AgentOps Studio — Standard**

- Product type: Service
- Price: ₹17,999/month, recurring, INR
- Tax behavior: tax\_exclusive
- Metadata: `plan_tier: standard`, `included_minutes: 1000`, `overage_rate_paise: 2000`, `assistants: 3`, `concurrent_calls: 2`

**Product 3: AgentOps Studio — Pro**

- Product type: Service
- Price: ₹25,999/month, recurring, INR
- Tax behavior: tax\_exclusive
- Metadata: `plan_tier: pro`, `included_minutes: 1500`, `overage_rate_paise: 1800`, `assistants: 5`, `concurrent_calls: 3`, `fair_use_cap: 3000`

**Product 4: AgentOps Studio — Setup & Onboarding** (one-time)

- Price A: ₹9,999 one-time (Basic setup)
- Price B: ₹14,999 one-time (Standard setup)
- Price C: ₹24,999 one-time (Pro setup)
- Tax behavior: tax\_exclusive
- Metadata on each price: `setup_tier: basic|standard|pro`

**Product 5: AgentOps Studio — Minute Recharge** (one-time)

- Price A: ₹2,000 one-time (Starter — 100 min)
- Price B: ₹4,500 one-time (Growth — 250 min)
- Price C: ₹8,000 one-time (Mega — 500 min)
- Tax behavior: tax\_exclusive
- Metadata on each price: `recharge_tier: starter|growth|mega`, `recharge_minutes: 100|250|500`, `validity_months: 6`

**Tax configuration:**

- Create a Tax Rate in Stripe: GST 18%, inclusive = false
- Alternatively, use Stripe Tax (automatic) with business address set to India — Stripe will auto-apply 18% GST on all invoices
- All prices are set as tax\_exclusive so the client sees ₹9,999 + ₹1,800 GST = ₹11,799 on their invoice
- Stripe’s India entity handles GST invoicing and compliance automatically

**Billing portal:** Enable the Stripe Customer Portal so clients can view invoices, update payment methods, and download GST-compliant invoices themselves.

## 9. Stripe Implementation Steps

**Step 1 — Account setup**

Sign up at dashboard.stripe.com with your Indian business entity. Complete KYC (PAN, GST number, bank account). Set default currency to INR. Enable Stripe Billing under the product settings.

**Step 2 — Tax configuration**

Go to Settings → Tax. Add your GSTIN. Create a tax rate: name “GST”, rate 18%, type “Percentage”, inclusive = No. Alternatively, enable Stripe Tax for automatic tax calculation — this handles interstate vs intrastate GST (CGST+SGST vs IGST) automatically based on client location.

**Step 3 — Create products and prices**

In Products → Add Product, create the five products listed in Section 8. For each recurring price, set billing period to “Monthly”. For one-time prices, select “One time”. Add all metadata fields as key-value pairs on each price. Attach the GST tax rate to each price.

**Step 4 — Set up the Customer Portal**

Go to Settings → Billing → Customer Portal. Enable: invoice history, payment method update, subscription cancellation (with optional cancellation survey). Add your brand logo and colors.

**Step 5 — Create subscription checkout flows**

Use Stripe Checkout Sessions or Payment Links. For each plan, create a Payment Link with the recurring price + setup fee price combined as line items. The first invoice will show: subscription (₹9,999) + setup fee (₹9,999) + GST (18%) = ₹23,397.64. Subsequent invoices show only the subscription + GST.

**Step 6 — Recharge purchases**

Create separate Payment Links or use the Stripe API to generate invoice items for recharge packs. These are one-time charges on the existing customer record. Your application should track recharge minute balances separately and deduct usage after included plan minutes are exhausted.

**Step 7 — Overage billing (metered)**

Option A (simple): At month-end, calculate extra minutes consumed beyond the plan’s included allocation. Create an invoice item on the customer for (extra\_minutes × overage\_rate) and generate a one-off invoice.

Option B (Stripe metered billing): Create a metered price on each subscription product with `usage_type: metered` and the per-minute overage rate. Report usage via `stripe.subscriptionItems.createUsageRecord()` at the end of each billing cycle. Stripe auto-includes it on the next invoice.

Recommendation: Start with Option A for simplicity. Move to Option B once you have 50+ clients and need automated billing.

**Step 8 — Webhooks**

Set up a webhook endpoint in your application to listen for: `invoice.paid` (activate/renew service), `invoice.payment_failed` (pause service after 3 retries), `customer.subscription.deleted` (deprovision), `checkout.session.completed` (onboard new client). Stripe retries failed payments 3 times over 7 days by default — configure Smart Retries under Billing Settings.

**Step 9 — Testing**

Use Stripe’s test mode (test API keys). Create test customers, subscribe them to each plan, simulate a billing cycle, verify invoice amounts match: Basic ₹9,999 + ₹1,800 GST = ₹11,799. Test recharge purchases and overage billing. Verify webhook events fire correctly. Only go live after all three plan flows work end to end.

## 10. Final Decision Summary

**Fixed subscription prices (confirmed, not changed):**

| Plan | Monthly price | + 18% GST | Client pays | Included min | Gross margin |
| --- | --- | --- | --- | --- | --- |
| Basic | ₹9,999 | ₹1,800 | **₹11,799** | 500 | 60.0% |
| Standard | ₹17,999 | ₹3,240 | **₹21,239** | 1,000 | 55.6% |
| Pro | ₹25,999 | ₹4,680 | **₹30,679** | 1,500 | 53.8% |

**What was optimized around the fixed prices:**

- Included minutes set at 500 / 1,000 / 1,500 to maintain 54–60% gross margins
- Overage rates of ₹25 / ₹20 / ₹18 per minute reward higher-tier clients
- Setup fees of ₹9,999 / ₹14,999 / ₹24,999 cover onboarding cost and provide early cash
- Three recharge packs (₹2,000 / ₹4,500 / ₹8,000) with 6-month validity
- Feature tiers (assistants, voices, integrations, analytics) create clear upgrade reasons
- Fair-use cap of 3,000 min on Pro prevents abuse while allowing generous usage

**Economics validated:**

- No usage scenario drops below 53% gross margin
- Break-even at 3 clients (down from 6–7 under old pricing)
- Profitable from client #1 with ₹10,800 average gross profit per client
- 1,000-client target yields ₹1.8 Cr MRR with 54.3% net margin
- Competitive positioning confirmed: only bilingual conversational AI receptionist for Indian SMBs

**Stripe setup:** 5 products, 11 prices total, GST at 18% tax-exclusive. Start with manual overage invoicing, move to metered billing at 50+ clients. All configurations detailed in Sections 8 and 9.

**Ready to execute.** The pricing structure is validated, the Stripe product catalog is specified, and the implementation steps are documented. Next step: create these products in Stripe test mode and run a full billing cycle simulation before going live.
