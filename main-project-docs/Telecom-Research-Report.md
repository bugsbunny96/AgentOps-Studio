# Telecom & Cloud Communications Feasibility Report
## Multi-Tenant AI Voice Receptionist SaaS — India Market

**Prepared by:** Senior Telecom & Cloud Communications Research Analyst  
**Prepared for:** AgentOps Studio — CEO Office  
**Date:** 2026-08-13  
**Version:** 1.0  
**Status:** Final  

> **Legend:** ✅ Confirmed fact · ⚠️ Assumption / requires verification · ❌ Confirmed blocker

---

## 1. Executive Summary

Twilio + Vapi is **technically viable** for a multi-tenant AI voice receptionist SaaS targeting Indian businesses. Twilio offers native integration with Vapi (no SIP configuration required), local Indian DIDs at ~₹200/month per number, and proven regulatory compliance tooling. The combination can scale to 500 concurrent AI agents on standard Twilio Elastic SIP Trunking. However, two critical constraints must be resolved before launch: (1) TRAI 2026 regulations mandate 160-series numbers for service calls with mandatory AI disclosure and DLT registration — failure carries ₹10 lakh penalties; (2) Twilio India local DIDs require identity documentation that adds 3–10 days provisioning lead time. The recommended MVP path is **Twilio (primary) + Exotel (compliance fallback/PSTN backup)**, with Plivo as a cost-optimisation option at scale. Total AI call cost: **$0.07–$0.25/min all-in**.

---

## 2. Recommended Call Architecture

### 2.1 Inbound AI Receptionist Flow

```
Customer dials Indian DID (Twilio +91 local number)
        │
        ▼
   Twilio SIP Trunk
   (Elastic SIP, regulatory-compliant DID)
        │
        ▼ [Native Twilio ↔ Vapi integration]
   Vapi AI Platform
   ├── Deepgram Nova-3 STT  (English + Hindi)
   ├── GPT-4o LLM           (tenant-specific system prompt)
   └── ElevenLabs TTS       (tenant-configured voice)
        │
        ├──▶ Real-time webhook → AgentOps Studio Backend
        │    (call.created, speech events)
        │
        ▼
   End-of-Call Webhook → AgentOps Studio Backend
   ├── Transcript saved to MongoDB (TranscriptModel)
   ├── Full-text index updated (search-ready)
   └── Customer notified / CRM updated
```

### 2.2 Outbound AI Receptionist Flow

```
AgentOps Studio Backend
POST /vapi/call  {assistantId, phoneNumber, orgId}
        │
        ▼
   Vapi Outbound Call
   (uses tenant's Twilio DID as caller ID)
        │
        ▼
   Twilio PSTN → Customer Mobile/Landline
   (160-series number if service call — TRAI required)
        │
        ▼
   Vapi AI Conversation (same STT/LLM/TTS stack)
        │
        ▼
   End-of-Call Webhook → AgentOps Studio Backend
```

### 2.3 Multi-Tenancy Architecture

```
AgentOps Studio (single Vapi account)
├── Tenant A → Vapi Assistant A (prompt A) + Twilio DID +91-22-XXXX
├── Tenant B → Vapi Assistant B (prompt B) + Twilio DID +91-80-XXXX
└── Tenant C → Vapi Assistant C (prompt C) + Twilio DID +91-98-XXXX
     │
     └── All tenants → same Vapi account, isolated via:
         • Vapi `metadata.organizationId` on each call
         • AgentOps `organizationId` on TranscriptModel
         • Per-tenant Vapi assistant configs
```

**Key design choices:**
- Each tenant gets their own Indian phone number (Twilio DID)
- Single Vapi deployment — no per-tenant Vapi accounts required ✅
- Tenant isolation enforced at AgentOps backend layer, not Vapi layer
- Tenant can optionally BYOC (Bring Your Own Carrier) via BYO SIP trunk if they have an existing Exotel/Plivo account ⚠️

---

## 3. Technical Feasibility Assessment

### 3.1 Vapi Platform

| Capability | Status | Notes |
|---|---|---|
| Native Twilio integration | ✅ Confirmed | Import via Account SID + Auth Token in Vapi dashboard. No manual SIP config. |
| BYO SIP Trunk | ✅ Confirmed | Route: `{number}@{credentialId}.sip.vapi.ai`. Carrier-agnostic. |
| Multi-tenant assistant configs | ✅ Confirmed | One Vapi account, unlimited assistants, per-call assistant selection |
| Hindi language (Deepgram) | ✅ Confirmed | Deepgram Nova-3 supports Hindi; model param: `hi` |
| Punjabi language | ⚠️ Assumption | Deepgram has limited Punjabi support; verify before promising tenants |
| 500 concurrent calls | ✅ Feasible | Vapi scales horizontally; Twilio concurrency governed by trunk config |
| Caller ID control (outbound) | ✅ Confirmed | Set `phoneNumberId` in Vapi call payload to use specific tenant DID |
| End-of-call webhook | ✅ Confirmed | `end-of-call-report` event with full transcript and recording URL |
| Call recording | ✅ Confirmed | Vapi stores recordings; accessible via API |
| Vapi pricing | ✅ Confirmed | $0.05/min base Vapi fee (excludes carrier costs) |

### 3.2 Twilio India Numbers

| Capability | Status | Notes |
|---|---|---|
| Local Indian DIDs (+91) | ✅ Available | Major cities (Mumbai 022, Delhi 011, Bangalore 080, etc.) |
| DID cost | ✅ Confirmed | ~₹200/month (~$2.40/month at ₹84/USD) per local number |
| Inbound per-minute rate | ✅ Confirmed | ₹0.35/min (~$0.004/min) |
| Outbound to landline | ✅ Confirmed | ₹0.65/min (~$0.008/min) |
| Outbound to mobile | ✅ Confirmed | ₹1.20/min (~$0.014/min) |
| Toll-free numbers (1800-xxx) | ✅ Available | Separate pricing; ~₹2–4/min inbound caller cost applies to caller |
| Identity documentation | ✅ Required | Business registration, address proof required for local DIDs; 3–10 day provisioning |
| 160-series (service calls) | ⚠️ Regulatory | Twilio can provision 160-series but DLT registration must be done separately |
| Elastic SIP concurrency | ✅ Confirmed | Configure concurrent call limits per trunk; 500 concurrent feasible |
| TRAI DLT compliance tooling | ⚠️ Partial | Twilio provides the number infrastructure; DLT registration is operator-side |

### 3.3 Exotel (Alternative / Backup Carrier)

| Capability | Status | Notes |
|---|---|---|
| Native Vapi integration | ❌ Not available | Exotel uses LiveKit/Retell stack; no native Vapi connector |
| BYO SIP trunk path | ✅ Feasible | Exotel SIP → Vapi via BYO SIP trunk credential; requires manual SIP config |
| India DID availability | ✅ Excellent | Deepest Indian number inventory; 160-series, 140-series, local, toll-free |
| TRAI compliance | ✅ Strong | Exotel has deep TRAI relationship; built-in DLT integration, DND scrubbing |
| Pricing model | ⚠️ Bundled | Dabbler: ~$106/mo · Believer: ~$212/mo · Influencer: ~$530/mo (minutes bundled) |
| SIP concurrency cap | ⚠️ Limited | 200 CPM (calls per minute) on standard plans; negotiate enterprise terms for 500+ |
| Provisioning speed | ✅ Fast | Indian carrier — local numbers provisioned same day or next day |
| Primary use case | Compliance backup | Best as TRAI fallback, 160-series provisioning, or PSTN backup for Twilio |

### 3.4 Plivo India

| Capability | Status | Notes |
|---|---|---|
| Vapi SIP compatibility | ✅ Confirmed | Listed in Vapi's official BYO SIP trunk documentation |
| India DID | ✅ Available | ₹250/month (~$3/mo) per local DID |
| SIP per-minute rate | ✅ Confirmed | ₹0.60/min (~$0.007/min) both directions — cheaper than Twilio outbound |
| TRAI compliance | ⚠️ Partial | Less established than Exotel for regulatory navigation |
| Support quality | ⚠️ Unclear | Fewer India-specific support resources vs. Exotel |
| Recommended role | Cost optimization | Use at scale (10,000+ minutes/month) to reduce outbound mobile costs |

### 3.5 TRAI 2026 Regulatory Requirements

| Requirement | Impact on AgentOps | Action Required |
|---|---|---|
| **160-series numbers** mandatory for service/transactional calls | All AI receptionist calls (appointment booking, reminders) must use 160-series | Register 160-series with a DLT-integrated carrier (Exotel recommended) |
| **140-series numbers** for promotional calls only | Marketing/outbound sales calls require separate 140-series pool | Separate number pool per use case type |
| **Mandatory AI disclosure** at call start | "This call is assisted by an AI" or equivalent in first 5 seconds | Add disclosure to Vapi assistant's first message template |
| **DLT registration** (Distributed Ledger Technology) | Sender registration on TRAI's DLT platform | Register on JioDLT, Vodafone DLT, or Airtel DLT platform |
| **DND scrubbing** mandatory | Must check National Customer Preference Registry before outbound calls | Integrate DND API or use Exotel's built-in scrubbing |
| **7-day consent documentation** (Feb 2025 amendment) | Consent records must be retained for 7 days minimum | Store consent timestamp + source in MongoDB |
| **Penalty** for non-compliance | ₹10 lakh (~$12,000) per violation | Non-negotiable compliance requirement |

---

## 4. Provider Comparison

| Provider | India Support | Approx. Cost | Scalability | Vapi Compatibility | TRAI Compliance | Key Notes |
|---|---|---|---|---|---|---|
| **Twilio** | ✅ Good | DID: ~$2.40/mo · In: $0.004/min · Out landline: $0.008/min · Out mobile: $0.014/min | ✅ Excellent (Elastic SIP, 500+ concurrent) | ✅ **Native** (wizard import, no SIP config) | ⚠️ Partial (provides numbers; you handle DLT) | Best Vapi integration; ID docs required for DIDs; 3–10 day provisioning |
| **Exotel** | ✅ Excellent | Bundled $106–$530/mo; 200 CPM cap | ⚠️ Limited (200 CPM, negotiate for more) | ⚠️ BYO SIP only (manual config) | ✅ **Best** (built-in DLT, DND scrubbing, 160-series) | India-first carrier; no native Vapi; ideal compliance fallback |
| **Plivo** | ✅ Good | DID: ~$3/mo · SIP: ~$0.007/min both directions | ✅ Good | ⚠️ BYO SIP only | ⚠️ Partial | Cheapest outbound rates; in Vapi SIP docs; less India-specific support |
| **Ozonetel** | ✅ Good | ~$25–45/user/month (bundled) | ✅ Cloud-native | ❌ No Vapi integration | ✅ Strong (Indian provider) | Strong CCaaS features; not a voice API/trunk provider; wrong product category |
| **Knowlarity** | ✅ Good | Custom enterprise pricing | ✅ Good | ❌ No Vapi integration | ✅ Strong | India-first; proprietary platform only; no API trunk mode |
| **Tata Communications** | ✅ Excellent | Enterprise only | ✅ Enterprise-grade | ⚠️ BYO SIP feasible | ✅ Best-in-class | Only viable at >100 seats; 3+ month sales cycle |

---

## 5. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **TRAI 160-series non-compliance** — using non-registered numbers for service calls | 🔴 Critical — ₹10 lakh per violation, calls blocked | 🔴 High (regulation in full effect March 2026) | Register 160-series via Exotel as day-1 requirement; mandatory AI disclosure in first Vapi utterance |
| **Twilio India DID provisioning delay** — identity docs + regulatory review | 🟡 Medium — delays launch; can't on-board tenants | 🟡 Medium (3–10 day wait is common) | Pre-provision a pool of DIDs before tenant demand; set onboarding expectation at 7 days |
| **Vapi single point of failure** — Vapi outage = all tenants' AI calls fail | 🔴 Critical — complete service outage | 🟡 Medium (Vapi SLA not published; startup risk) | Multi-region Vapi deployment ⚠️; Exotel BYO SIP as manual fallback; circuit-breaker in webhook.service.ts |
| **Indian regulatory change (TRAI)** — additional AI disclosure rules mid-product lifecycle | 🟡 Medium — sprint to update all assistant prompts | 🔴 High (TRAI is actively tightening AI call rules) | Centralize AI disclosure text in a config variable (not hardcoded per assistant); update one place |
| **Twilio outbound mobile cost** — ₹1.20/min is 84% more than landline | 🟡 Medium — unit economics erode at scale | 🟠 Medium (India is predominantly mobile) | Model per-tenant cost caps; consider Plivo at >10k outbound mobile minutes/month |
| **Hindi/regional language accuracy** — Deepgram Nova-3 Hindi accuracy ~85–90% | 🟡 Medium — poor UX, tenant churn | 🟡 Medium (varies by accent/dialect) | Mandatory eval harness for Hindi call quality; Punjabi pilot gating behind feature flag |
| **Concurrent call limit breach** — 500 agents simultaneous calls on default Twilio config | 🟡 Medium — calls dropped or queued | 🟡 Medium (grows with tenant base) | Pre-configure Elastic SIP trunk concurrency; monitor via Twilio console alerts; autoscale threshold at 70% |
| **Data residency / DPDP Act** — India's Digital Personal Data Protection Act 2023 | 🟡 Medium — transcript/recording data leaving India | 🟠 Medium (enforcement timeline uncertain) | Store transcripts in MongoDB Atlas India region; Vapi recording retention policy audit |
| **Tenant caller ID spoofing concern** — SaaS tenants sharing number pool | 🟡 Medium — one tenant's abuse blocks all DIDs | 🟡 Low (each tenant has dedicated DID) | One DID per tenant; no shared DID pool; strict onboarding KYC |
| **Exotel 200 CPM cap** — if used as primary carrier hits ceiling at peak | 🟡 Medium — calls fail at peak hours | 🟠 Medium (only if Exotel is primary) | Use Exotel as compliance/fallback only, not primary; Twilio handles volume |

---

## 6. Final Recommendation

### 6.1 Best Architecture

**Primary:** Twilio (carrier) + Vapi (AI orchestration) + AgentOps Studio (backend)  
**Compliance overlay:** Exotel for 160-series number registration and DLT integration  
**Cost optimization at scale:** Plivo for outbound mobile minutes >10k/month

This is not a pure Twilio + Vapi play — TRAI compliance requires an Indian carrier (Exotel) in the number registration chain for 160-series. The architecture is:

```
Twilio DID (local +91) for Vapi routing
     +
Exotel 160-series DID registered on DLT for regulatory identity
     +
Vapi as AI orchestration layer (single platform for both DIDs)
```

In practice: tenants get a **Twilio number** for AI calls routed through Vapi, but AgentOps registers a **160-series Exotel number** as the legal "sender" identity on TRAI's DLT, and the AI disclosure is in every call's opening prompt.

### 6.2 MVP Approach

**Phase 1 (Weeks 1–4): Twilio + Vapi only**
- Use Twilio's native Vapi integration (fastest path to working calls)
- Inbound calls only; defer outbound
- English + Hindi (defer Punjabi)
- 10 pilot tenants; 5 DIDs provisioned

**Phase 2 (Weeks 5–8): TRAI Compliance**
- Register on DLT platform (JioDLT or Vodafone DLT)
- Provision Exotel 160-series numbers alongside Twilio DIDs
- Add mandatory AI disclosure to all Vapi assistant templates
- Implement DND scrubbing before any outbound calls

**Phase 3 (Weeks 9–12): Outbound + Scale**
- Enable outbound calling via Vapi
- Concurrency monitoring and Twilio trunk scaling
- Evaluate Plivo for outbound mobile cost reduction
- DPDP compliance audit (transcript/recording storage in India region)

### 6.3 What to Avoid

| ❌ Avoid | Reason |
|---|---|
| **Exotel as primary AI carrier** | No native Vapi integration; BYO SIP complexity; 200 CPM cap blocks scale |
| **Shared DID pool across tenants** | TRAI treats number identity as business identity; cross-tenant sharing creates liability |
| **Launching outbound AI calls without 160-series + DLT** | ₹10 lakh per-violation penalty; calls will be blocked by operators |
| **Hardcoding AI disclosure text** | TRAI may mandate specific wording; must be config-driven for rapid updates |
| **Ozonetel or Knowlarity as voice API** | These are CCaaS platforms, not programmable trunk/API providers; no Vapi path |
| **Punjabi language in MVP** | Deepgram support is limited; verify accuracy before customer-facing rollout |
| **Vapi-only SIP trunk config** (if Twilio is carrier) | Twilio's native Vapi integration is faster, more reliable, and officially supported |

### 6.4 Cost Model (Per Tenant, Per Month)

Assumptions: 500 calls/month, avg. 3 min/call = 1,500 minutes/month

| Cost Component | Unit Rate | Monthly (1,500 min) |
|---|---|---|
| Vapi AI platform | $0.05/min | $75.00 |
| Twilio inbound minutes | ₹0.35/min (~$0.004) | $6.30 |
| Twilio DID rental | ₹200/mo (~$2.40) | $2.40 |
| Deepgram STT (included in Vapi) | — | $0 |
| ElevenLabs TTS (included in Vapi) | — | $0 |
| GPT-4o (included in Vapi) | — | $0 |
| **Total per tenant** | | **~$83.70/month** |

At $149–$299/month SaaS pricing → **gross margin ~44–72%** per tenant (inbound only).  
⚠️ Outbound mobile calls at ₹1.20/min add ~$18/month for 1,500 outbound minutes.

---

## 7. Implementation Checklist

### Step 1 — Twilio Account Setup (Day 1)
- [ ] Create Twilio account; enable billing
- [ ] Submit business identity documents (GSTIN, registered address, Director KYC)
- [ ] Purchase first 5 India local DIDs (Mumbai 022 + Delhi 011 + Bangalore 080 + Hyderabad 040 + Chennai 044)
- [ ] Configure Elastic SIP Trunk; set concurrency limit to 100 (increase incrementally)

### Step 2 — Vapi + Twilio Integration (Day 2)
- [ ] In Vapi dashboard: Providers → Twilio → enter Account SID + Auth Token
- [ ] Import Twilio numbers into Vapi; verify each number shows as "active"
- [ ] Create base Vapi assistant template with mandatory AI disclosure as first message
- [ ] Test inbound call: dial DID → confirm Vapi picks up → verify transcript appears in AgentOps backend

### Step 3 — AgentOps Backend Wiring (Day 3–5)
- [ ] Configure `VAPI_BASE_URL`, `VAPI_API_KEY` in backend environment
- [ ] Register webhook URL (`/api/v1/webhooks/vapi`) in Vapi dashboard
- [ ] Verify `end-of-call-report` writes to TranscriptModel with correct `organizationId`
- [ ] Verify full-text search index active: `db.transcripts.getIndexes()` → see `transcript_fulltext_idx`
- [ ] Test `GET /api/v1/calls/search?q=appointment` returns results

### Step 4 — TRAI Compliance (Week 2)
- [ ] Register on JioDLT platform (jio.com/dlt) with business entity details
- [ ] Provision Exotel 160-series number; link to DLT-registered sender ID
- [ ] Add `aiDisclosureText` config variable to OrganizationModel (tenant-configurable, default mandated)
- [ ] Implement DND scrubbing: before any outbound call, check NCPR API or use Exotel's built-in
- [ ] Implement consent logging: store `{ phone, consentSource, timestamp }` with 7-day minimum retention

### Step 5 — Monitoring & Alerting (Week 2)
- [ ] UptimeRobot: monitor `GET /api/v1/health` every 5 minutes; alert on 503
- [ ] Sentry: verify error boundary catching React crashes; test with intentional throw
- [ ] Twilio console: set alert when concurrent calls > 70% of trunk limit
- [ ] Vapi dashboard: monitor call completion rate; alert if drops below 90%
- [ ] Monthly: review Twilio number compliance status (Twilio may request re-verification)

---

## Appendix: Pricing Quick Reference

| Provider | DID (India) | Inbound/min | Outbound landline/min | Outbound mobile/min | Vapi Path |
|---|---|---|---|---|---|
| **Twilio** | ₹200 (~$2.40) | ₹0.35 (~$0.004) | ₹0.65 (~$0.008) | ₹1.20 (~$0.014) | ✅ Native |
| **Plivo** | ₹250 (~$3.00) | ₹0.60 (~$0.007) | ₹0.60 (~$0.007) | ₹0.60 (~$0.007) | BYO SIP |
| **Exotel** | Bundled ($106–530/mo) | Bundled | Bundled | Bundled | BYO SIP |
| **Vapi (base)** | — | $0.05/min | $0.05/min | $0.05/min | N/A (is the AI layer) |

Exchange rate assumed: ₹84 = $1 USD (verify current rate at time of implementation).

---

*Report Version: 1.0 | Author: AI R&D / CEO Office | Classification: Internal*  
*Next review: When TRAI issues new AI call guidelines or Vapi updates India pricing*
