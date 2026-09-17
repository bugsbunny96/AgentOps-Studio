# POC Integration Plan — Electrical Shop AI Receptionist → AgentOps Studio
**Analysed:** 2026-09-15  
**POC source:** `/poc-nestjs/` (NestJS scaffold, in-memory, no auth)  
**Target:** `/backend/` (Express · TypeScript · MongoDB · BullMQ · Multi-tenant SaaS)

---

## Executive Summary

The POC introduces 7 new capability domains that don't exist in the current backend:
**Catalog, Orders, Structured Call Output, Vobiz telephony, Sarvam TTS bridge, Vapi tool wiring, and Order Safety rules in prompts.**

The existing backend is kept as-is (auth, billing, org, KB, webhook skeleton, etc.). All POC logic is **additive** except for a handful of targeted modifications to the existing Vapi service, agent model, webhook handler, and system prompt builder.

---

## Change List

---

### 1. NEW MODULE — `backend/src/modules/catalog/`

**What POC has:** `CatalogService` with 32 seeded electrical items (EL-001 to EL-032), in-memory Map. CRUD + category filter.

**What to build:**
- `catalog.model.ts` — Mongoose schema (`CatalogItem`: `id`, `name`, `category`, `brand`, `price`, `unit`, `stock`, `organizationId`)
- `catalog.service.ts` — CRUD + `findByCategory()` + `seedForOrg(orgId)` (call on org creation)
- `catalog.controller.ts` + `catalog.routes.ts` — `GET /api/v1/catalog`, `GET /api/v1/catalog/:id`, `POST`, `PATCH /:id`, `DELETE /:id` (org-scoped, auth-guarded)

**Why `organizationId` on catalog items?**
Different orgs may customize their product list. The default seed (32 items from POC) loads on first org creation; org admins can add/edit from the dashboard.

**Additional change — inject catalog into system prompt:**
Modify `backend/src/modules/agents/prompt.utils.ts` to call `CatalogService.findAll(orgId)` and embed the catalog as a structured knowledge block in the agent's system prompt (replacing the static FAQ-only approach).

---

### 2. NEW MODULE — `backend/src/modules/orders/`

**What POC has:** `OrdersService` + `SubmitOrderDto` with these validation rules (must carry over exactly):
- `total_amount` MUST equal `quantity × unit_price` — prevents the ₹0 payment link bug
- Delivery orders require `delivery_address` with a **6-digit pincode** (`/^\d{6}$/`)
- Idempotent by `call_id` — same call retrying returns the existing order
- Order status starts as `pending_payment_arrangement`

**What to build:**
- `order.model.ts` — Mongoose schema (`Order`: `orderId`, `callId`, `organizationId`, `customerName`, `customerPhone`, `product`, `quantity`, `unitPrice`, `totalAmount`, `fulfillmentType`, `deliveryAddress`, `status`, `createdAt`)
- `order.service.ts` — `submitOrder(dto)` with all validation from POC
- `order.validation.ts` — Zod schema mirroring `SubmitOrderDto` (pincode regex, total check)
- `order.controller.ts` + `order.routes.ts`:
  - `POST /api/v1/orders/submit` — called by the Vapi `submit_order` tool (webhook secret validated via `x-webhook-secret` header, **not** the Vapi webhook secret)
  - `GET /api/v1/orders` — paginated list (org-scoped, auth-guarded)
  - `GET /api/v1/orders/:orderId` — order detail

**Note on `x-webhook-secret`:** The POC's `WebhookAuthGuard` uses the env var `N8N_WEBHOOK_SHARED_SECRET`. In the current project this becomes `VAPI_TOOL_WEBHOOK_SECRET` — a separate secret used only for tool-call endpoints (not to be confused with the existing `VAPI_WEBHOOK_SECRET` used for call lifecycle events).

---

### 3. NEW MODULE — `backend/src/modules/tts-bridge/`

**What POC has:** `TtsBridgeService` — bridges Vapi's `custom-voice` webhook protocol to Sarvam AI's Bulbul v3 TTS. Returns raw PCM16LE mono audio.

**What to build:**
- `tts-bridge.service.ts` — port `synthesize()` from POC, wire up the real `sarvamai` SDK (`npm install sarvamai`)
- `tts-bridge.controller.ts` + routes — `POST /api/tts/synthesize`
  - Accepts `{ message: { text, sampleRate? } }`
  - Returns `application/octet-stream` (raw PCM16LE)
- `tts-bridge.service.ts` must also export `wavToRawPcm(buf)` (strip WAV header — direct port from POC)

**Env vars to add:** `SARVAM_API_KEY`, `SARVAM_BRIDGE_URL` (opt-in — if set, Vapi assistant uses `custom-voice` provider; if absent, falls back to Vapi native Naina V2)

**This is opt-in at the assistant level.** The `VapiService` reads `SARVAM_BRIDGE_URL` and decides the `voice` block accordingly (see Change 5 below).

---

### 4. MODIFY — `backend/src/modules/calls/call.model.ts`

**Current gap:** `ICall` captures duration, cost, recordingUrl — but not the **structured output** from Vapi's `electrical-shop-call-summary` schema (5367c2b7-...).

**Add to `CallSchema` / `ICall`:**
```typescript
// Structured output from Vapi artifactPlan (electrical-shop-call-summary schema)
languageUsed:              string[];           // ['hi', 'en', 'mixed']
intent:                    'product_inquiry' | 'order' | 'order_status_check' | 'complaint' | 'other';
productsDiscussed:         Array<{ category: string; item: string; qty: number | null; unitPriceQuoted: number | null }>;
orderRequested:            boolean;
fulfillmentType:           'pickup' | 'delivery' | 'not_applicable';
deliveryAddress:           { line1: string | null; city: string | null; pincode: string | null } | null;
preferredDeliveryWindow:   string | null;
totalAmount:               number | null;
customerConfirmedReadback: boolean;
followUpNeeded:            boolean;
followUpReason:            string | null;
callSummaryStructured:     string;            // one-liner for shop owner (from structured output)
```

**Migration:** All existing `Call` documents pre-integration have `undefined` for these fields — that's fine. Default `false`/`null`/`[]` per field.

---

### 5. MODIFY — `backend/src/modules/calls/webhook.service.ts`

**Current gap:** `VapiEndOfCallReportEvent` doesn't include `artifact.structuredDataOutput` — so structured output from Vapi is silently dropped.

**Changes:**
- Add `artifact?: { recordingUrl?: string; structuredDataOutput?: CallStructuredOutput }` to `VapiEndOfCallReportEvent` interface
- In `handleEndOfCallReport()`, after the call upsert, extract `event.artifact?.structuredDataOutput` and write all structured fields to the `Call` document (fields from Change 4)
- Use `event.artifact?.recordingUrl` **in addition to** (fallback from) `event.recordingUrl` — POC shows Vapi puts recordingUrl inside `artifact` in newer payloads
- Trigger a BullMQ job `follow-up-alert` when `followUpNeeded === true` (see Change 10)

---

### 6. MODIFY — `backend/src/modules/agents/vapi.service.ts`

**Current gaps in type definitions:**

**a) `VapiVoice.provider`** — add `'vapi'` and `'custom-voice'`:
```typescript
// Before:
provider: 'openai' | '11labs' | 'azure' | 'cartesia' | 'deepgram' | 'playht';

// After:
provider: 'openai' | '11labs' | 'azure' | 'cartesia' | 'deepgram' | 'playht' | 'vapi' | 'custom-voice';
voiceId?: string;          // for 'vapi' provider (e.g. 'Naina')
version?: string;           // for 'vapi' provider (e.g. '2')
language?: string;          // for 'vapi' provider (e.g. 'auto')
server?: { url: string; timeoutSeconds?: number };  // for 'custom-voice'
```

**b) Add `analysisPlan` to `VapiCreateAssistantPayload`:**
```typescript
analysisPlan?: {
  summaryPlan?: { enabled: boolean };
  successEvaluationPlan?: { enabled: boolean };
};
```

**c) Add `artifactPlan` to `VapiCreateAssistantPayload`:**
```typescript
artifactPlan?: {
  recordingEnabled?: boolean;
  structuredOutputIds?: string[];
};
```

**d) Add `silenceTimeoutSeconds` to `VapiCreateAssistantPayload`:**
```typescript
silenceTimeoutSeconds?: number;   // live assistant v11 uses 20s
```

**e) Add `toolIds` to `VapiModel`:**
```typescript
// VapiModel already has messages array; add:
toolIds?: string[];   // Vapi pre-attached server tools (end_call, submit_order)
```

**No logic changes to `vapiRequest` / `updateAssistant` functions** — only the TypeScript payload types need expanding.

---

### 7. MODIFY — `backend/src/modules/agents/agent.model.ts`

**Current gaps in `IVoiceAgent`:**

**Add fields:**
```typescript
// Voice (expand provider enum)
voiceProvider: 'openai' | 'elevenlabs' | 'deepgram' | 'cartesia' | 'playht' | 'azure' | 'vapi' | 'custom-voice';
voiceVersion?: string;          // e.g. '2' for Vapi Naina V2

// Transcriber config (currently hardcoded in vapi.service; org-level config needed)
transcriberProvider: 'deepgram' | 'assembly-ai';
transcriberModel:    string;    // e.g. 'nova-3'
transcriberLanguage: string;    // e.g. 'multi' (Deepgram) or 'en' (fallback)

// Vapi tool IDs attached to this assistant
vapiToolIds: string[];          // [VAPI_TOOL_ID_END_CALL, VAPI_TOOL_ID_SUBMIT_ORDER]

// Vapi structured output schema ID
vapiStructuredOutputId?: string; // '5367c2b7-...' (electrical-shop-call-summary)
```

**Default values in schema:**
- `transcriberProvider` → `'deepgram'`
- `transcriberModel` → `'nova-3'`
- `transcriberLanguage` → `'multi'`

---

### 8. MODIFY — `backend/src/modules/agents/prompt.utils.ts`

**Current:** Builds system prompt from org name, KB context, business hours.

**Add:**
1. **Catalog block injection** — `## Product Catalog\n` with all catalog items formatted as `| ID | Name | Category | Brand | Price | Unit | Stock |` table — so the assistant can answer "do you have X?" questions accurately
2. **Order Safety Rules block** — append verbatim from POC's `VapiService.getOrderSafetyRules()`:
   - Never confirm order without `submit_order` tool returning `success: true`
   - Confirm product+qty before collecting address
   - Copy unit price from catalog; verify total before speaking
   - Never suggest pincode/address — ask caller
   - Read pincode back digit-by-digit; reject non-6-digit
   - Max 2 product options per response

---

### 9. MODIFY — `backend/src/modules/agents/agent.service.ts` (updateAgentConfig)

**Current:** `updateAgentConfig` builds a PATCH payload for Vapi with `model.messages` only.

**Add to PATCH payload:**
- `transcriber` block (from agent's `transcriberProvider` / `transcriberModel` / `transcriberLanguage`)
- `voice` block — Vapi native Naina V2 or custom-voice depending on `SARVAM_BRIDGE_URL`
- `analysisPlan: { summaryPlan: { enabled: false }, successEvaluationPlan: { enabled: false } }` — disable Vapi's built-in summary (we use structured output instead)
- `artifactPlan: { recordingEnabled: true, structuredOutputIds: [agent.vapiStructuredOutputId] }`
- `silenceTimeoutSeconds: 20`
- `model.toolIds: agent.vapiToolIds`

---

### 10. NEW ENV VARS — `backend/src/config/env.ts` + `backend/.env.example`

| Var | Purpose |
|---|---|
| `VAPI_TOOL_ID_END_CALL` | ID of the Vapi `end_receptionist_call` tool |
| `VAPI_TOOL_ID_SUBMIT_ORDER` | ID of the Vapi `submit_order` tool (create in Vapi dashboard first) |
| `VAPI_STRUCTURED_OUTPUT_ID` | ID of the `electrical-shop-call-summary` schema in Vapi |
| `VAPI_TOOL_WEBHOOK_SECRET` | Secret sent by Vapi tool calls to `/api/v1/orders/submit` (`x-webhook-secret` header) |
| `SARVAM_API_KEY` | Sarvam AI API key (opt-in TTS) |
| `SARVAM_BRIDGE_URL` | Public URL of the TTS bridge (opt-in; if set → custom-voice, else Vapi Naina V2) |
| `TTS_MODEL` | Sarvam TTS model (default: `bulbul:v3`) |
| `TTS_LANGUAGE_CODE` | TTS language code (default: `hi-IN`) |
| `TTS_SPEAKER` | Sarvam speaker name (default: `shubh`) |
| `VOBIZ_SIP_DOMAIN` | Vobiz SIP domain (e.g. `*.sip.vobiz.ai`) |
| `VOBIZ_AUTH_USERNAME` | Vobiz SIP auth username |
| `VOBIZ_AUTH_PASSWORD` | Vobiz SIP auth password |
| `VOBIZ_GATEWAY_IP` | Vobiz gateway IP (from Vobiz console) |
| `VOBIZ_PHONE_NUMBER` | E.164 phone number from Vobiz |
| `VOBIZ_SIP_DOMAIN` | Vobiz account SID (fallback telephony) |
| `VOBIZ_AUTH_PASSWORD` | Vobiz auth token |
| `VOBIZ_SIP_DOMAIN` | URL of deployed Vobiz-Vapi-Connector bridge |

---

### 11. NEW UTILITY — `backend/src/modules/telephony/telephony.service.ts`

**What POC has:** Full `TelephonyService` with `buildVobizConfig()`, `buildVobizConfig()`, `buildVapiCredentialPayload()`, `buildVapiPhoneNumberPayload()`.

**What to build:** Port the POC service as-is, replacing NestJS decorators with plain TypeScript class. Wire into onboarding step where the org's phone number is linked to their Vapi assistant.

**Integration point:** In `onboarding.service.ts`, after `vapiAssistantId` is provisioned, call:
1. `telephonyService.buildVapiCredentialPayload()` → `POST https://api.vapi.ai/credential`
2. `telephonyService.buildVapiPhoneNumberPayload()` → `POST https://api.vapi.ai/phone-number`
3. Store returned `credentialId` and `phoneNumberId` on the `Organization` document

---

### 12. MODIFY — `backend/src/modules/organization/organization.model.ts`

**Add fields:**
```typescript
telephonyProvider?:   'vobiz' | 'vobiz';
vapiCredentialId?:    string;   // from POST /credential
vapiPhoneNumberId?:   string;   // already exists — keep, now also set by telephony service
vapiStructuredOutputId?: string; // per-org override of the structured output schema ID
```

---

### 13. NEW BULLMQ JOB — `backend/src/jobs/followUpAlert.queue.ts` + `followUpAlert.worker.ts`

**Trigger:** When `handleEndOfCallReport` sets `followUpNeeded: true`.

**Worker logic:**
1. Load the `Call` document
2. Load the `Organization` to get owner email
3. Send a "Follow-up needed" email via existing `email.ts` util with: caller number, intent, follow-up reason, call summary, products discussed
4. (Phase 2) WhatsApp notification to org owner via Twilio/WhatsApp

---

### 14. NEW VAPI TOOL — `submit_order` (Create via Vapi Dashboard)

This is not a code change but a required **Vapi configuration step** before the order flow works.

**Tool definition (create in Vapi dashboard → Tools):**
```json
{
  "type": "function",
  "function": {
    "name": "submit_order",
    "description": "Submit a confirmed order after the customer has verbally confirmed all details. Only call this after reading back: product name, quantity, unit price, total amount, fulfillment type, and delivery address (if applicable).",
    "parameters": {
      "type": "object",
      "properties": {
        "call_id":           { "type": "string" },
        "customer_name":     { "type": "string" },
        "customer_phone":    { "type": "string" },
        "product":           { "type": "string", "description": "Exact product name from catalog" },
        "quantity":          { "type": "integer", "minimum": 1 },
        "unit_price":        { "type": "number" },
        "total_amount":      { "type": "number" },
        "fulfillment_type":  { "type": "string", "enum": ["pickup", "delivery"] },
        "delivery_address":  {
          "type": "object",
          "properties": {
            "line1":   { "type": "string" },
            "city":    { "type": "string" },
            "pincode": { "type": "string", "pattern": "^\\d{6}$" }
          }
        }
      },
      "required": ["call_id", "customer_name", "customer_phone", "product", "quantity", "unit_price", "total_amount", "fulfillment_type"]
    }
  },
  "server": {
    "url": "https://your-backend.com/api/v1/orders/submit",
    "secret": "<VAPI_TOOL_WEBHOOK_SECRET>"
  }
}
```

After creating this tool, copy the tool ID into `VAPI_TOOL_ID_SUBMIT_ORDER` env var.

---

### 15. MODIFY — `backend/src/modules/analytics/analytics.service.ts`

**Add new analytics dimensions from structured output:**

- **Intent distribution** — `GROUP BY intent` on `CallModel` for org calls
- **Language usage** — `GROUP BY languageUsed` array element
- **Products discussed** — aggregate top-N products mentioned
- **Order conversion rate** — `orderRequested: true` / total completed calls
- **Follow-up rate** — `followUpNeeded: true` / total calls
- **Fulfillment split** — pickup vs delivery breakdown

These feed into the existing `/api/v1/analytics` endpoints (add new response fields; don't break existing consumers).

---

## Integration Sequence (Recommended Order)

```
Phase 1 — Foundation (no external deps, self-contained)
  1. Change 4  → Expand call.model.ts with structured output fields
  2. Change 5  → Update webhook.service.ts to parse + persist structured output
  3. Change 6  → Expand vapi.service.ts type definitions
  4. Change 7  → Expand agent.model.ts with new fields
  5. Change 10 → Add env vars to env.ts + .env.example

Phase 2 — New Modules (additive, no breaking changes)
  6. Change 1  → Catalog module (model + service + routes)
  7. Change 2  → Orders module (model + service + routes + validation)
  8. Change 8  → Inject catalog + order safety rules into prompt.utils.ts
  9. Change 9  → Add transcriber/voice/analysisPlan/artifactPlan to agent.service.ts PATCH

Phase 3 — Infrastructure
  10. Change 3  → TTS bridge (Sarvam) module
  11. Change 11 → Telephony service (Vobiz / Vobiz)
  12. Change 12 → Expand Organization model
  13. Change 13 → followUpAlert BullMQ job

Phase 4 — Vapi Config + Analytics
  14. Change 14 → Create submit_order tool in Vapi dashboard; populate env var
  15. Change 15 → Add new analytics dimensions
```

---

## Files NOT Carried Over from POC

| POC file | Reason |
|---|---|
| `employees/` (entire module) | The current project has `team/` for org-member management. `Employee` in the POC was a placeholder example entity — not a real domain object for this project. Discard. |
| `common/guards/webhook-auth.guard.ts` | NestJS guard. We replicate the same `x-webhook-secret` validation logic in Express middleware for the orders route. |
| `app.module.ts`, `main.ts` | NestJS bootstrap — irrelevant to Express backend. |
| All NestJS decorators (`@Controller`, `@Injectable`, `@Module`) | Replaced with Express-native patterns used throughout the current backend. |

---

## Risk Notes

- **POC uses in-memory Maps** — all data is lost on restart. Every POC store (catalog, orders, call-logs) must become MongoDB collections in the real project.
- **POC assistant ID (`100b3bd9-...`) and tool IDs are from the electrical-shop standalone project** — they will conflict with org-provisioned assistants in the multi-tenant backend. Never hardcode them; always read from org/agent documents or env vars.
- **`analysisPlan` disabled in POC** (summaryPlan + successEvaluationPlan both `false`). This means Vapi will NOT auto-generate call summaries. The `SummaryModel` in the current backend relies on `event.summary` in the end-of-call-report — which will be empty once we apply this config. **Solution:** Use the `callSummaryStructured` field (from structured output, Change 4) as the primary summary for the dashboard, and deprecate `SummaryModel` over time.
- **Vobiz compliance** — the POC notes that Vobiz's PSTN carrier disclosure is incomplete. Do not go live with Vobiz for regulated numbers (140/160 series) until the compliance verification email (in `telephony/vobiz-compliance-findings.md`) is answered. For dev/testing, Vobiz is fine.
