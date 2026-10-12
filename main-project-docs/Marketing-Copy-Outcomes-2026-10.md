# AgentOps Studio — Outcome Copy Draft (MKT-01, MKT-02)

> **Version history**
> - [2026-10-12 17:05] v1.0 — CEO Agent — Draft copy for MKT-01 (outcome-first landing features and plan taglines) and MKT-02 (annual saving in ₹ on plan cards). Source: review of 15 marketing/pricing posts on 2026-10-11 (`gaps.md` § 17). **Draft — not applied to code.**

**Rules for this copy**
- Say what the business owner gets (calls answered, orders taken, time back), not how it works.
- Every claim must be true today. No "indistinguishable from a human", no ₹-value claims until ROI-01 measures them, no invented customer counts (FE-19).
- Call counts come from the catalog: `includedMinutes ÷ AVG_CALL_MINUTES (4)` ÷ 30 days, rounded down.
- The hero (FE-21 / H5.11) is out of scope here; it waits for D2 (niche).

---

## 1. Landing → Capabilities section (`landing/sections/FeaturesSection.tsx`) — MKT-01

### Section header

| Element | Current | Draft |
|---|---|---|
| Eyebrow | Capabilities | What you get |
| H2 | Everything your AI needs to *handle every call* | Every call answered — *even when you can't pick up* |
| Subline (new) | — | Your AI receptionist answers in Hindi, English or Punjabi, takes the order or the message, and sends you a summary. |

### Feature cards

| Card | Current title / body | Draft title | Draft body | Pills (replace tech pills) |
|---|---|---|---|---|
| Large card | **Natural Voice AI** — "Powered by state-of-the-art AI. Your agent sounds indistinguishable from a human — warm, fluent, contextually aware." | Callers get answers, not a ringing phone | A warm, natural voice that answers from your own website and price list, takes orders and notes who needs a call back. | Answers questions · Takes orders · Flags call-backs |
| Analytics | **Real-time Analytics** — "Track call volume, completion rate, and language splits live." | Know what every call was about | Who called, what they wanted, and which calls need you — with a transcript and summary for each. | — |
| Languages | **Auto Language Detection** — "Caller speaks Hindi? Agent switches instantly. No menu, no friction." | Talk to customers in their language | Hindi, English or Punjabi — the agent switches as soon as the caller does. No "press 1 for Hindi". | keep EN / हिन्दी / ਪੰਜਾਬੀ |
| Knowledge base | **Smart Knowledge Base** — "Crawls your website. Add FAQs and services manually." | Answers like someone who knows your shop | Learns your products, prices and FAQs from your website. Add anything it missed in a minute. | — |

### Stat tiles

| Stat | Current label | Draft label |
|---|---|---|
| 24/7 | Answers every call, day or night | No missed call after closing time |
| 3 | Languages, detected automatically (EN · HI · PA) | Languages your customers already speak |
| ~30 min | Typical setup, no code needed | From sign-up to your first answered call ⚠️ verify against real onboarding times once H5.2 analytics is live; drop the tile if not true |

---

## 2. Plan taglines (`frontend/src/lib/pricing.ts` → `tagline`) — MKT-01

Shown on the Pricing page cards and the landing pricing section.

| Plan | Current | Draft |
|---|---|---|
| Starter | Try an AI receptionist on one line | Stop losing customers to an unanswered phone |
| Basic | Small shops, a few calls a day | About 4 calls a day answered, every day |
| Standard ⭐ | Busy businesses, 10+ calls a day | About 8 calls a day, 3 at the same time |
| Pro | High call volume, premium voices | 12+ calls a day, 5 at once, premium voices, setup done for you |

Maths (4 min/call, 30 days): Starter 200 → 50 calls (~1.7/day, so no daily number shown); Basic 500 → 125 (4.2/day); Standard 1,000 → 250 (8.3/day); Pro 1,500 → 375 (12.5/day).

Optional card line under the price (all plans, from the catalog): **"≈ {approxCalls} calls answered a month"**.

---

## 3. Annual saving in ₹ on plan cards (`PricingPage.tsx`, `landing/sections/PricingSection.tsx`) — MKT-02

Compute, don't hard-code: `annualSaving = monthlyInr × 12 − annualInr`; `setupWaived = setupFeeInr` (0 on Starter).

### Copy

| Place | Draft |
|---|---|
| Toggle label (annual) | Annual — 2 months free |
| Hint under the toggle (monthly selected) | Pay yearly and save up to ₹74,997 in the first year |
| Card line, annual selected, setup fee > 0 | **Save ₹{annualSaving} a year** + ₹{setupWaived} setup waived |
| Card line, annual selected, Starter | **Save ₹9,998 a year** |
| Card line, monthly selected | or ₹{annualInr ÷ 12}/month billed yearly — save ₹{annualSaving} |

All amounts ex-GST, matching the rest of the page ("+ GST" footnote stays).

### Resulting values

| Plan | 12 × monthly | Annual price | Saving | Setup waived | First-year saving |
|---|---|---|---|---|---|
| Starter | ₹59,988 | ₹49,990 | ₹9,998 | — | ₹9,998 |
| Basic | ₹1,19,988 | ₹99,990 | ₹19,998 | ₹4,999 | ₹24,997 |
| Standard | ₹2,15,988 | ₹1,79,990 | ₹35,998 | ₹4,999 | ₹40,997 |
| Pro | ₹3,59,988 | ₹2,99,990 | ₹59,998 | ₹14,999 | ₹74,997 |

Effective monthly on annual: Starter ₹4,166 · Basic ₹8,333 · Standard ₹14,999 · Pro ₹24,999.
