# Session 3 — Vobiz + Vapi Setup & End-to-End Test Call

> **Estimated time**: 25–40 minutes  
> **Outcome**: A real phone call to +918065354620 reaches your AI agent (Ritu Electricals, assistant `100b3bd9-5038-4f11-b487-7ced98d8a3dd`), business-hours routing works, and the call record appears in the AgentOps Studio Calls page.

---

## Tools you need open

- [Vobiz Console](https://console.vobiz.ai/) — SIP Trunk → Outbound / Inbound
- [Vapi Dashboard](https://dashboard.vapi.ai/) — Phone Numbers, Integrations
- AgentOps Studio app
- A phone to make the test call (call +918065354620)

---

## Phase 0 — Pre-flight (2 min)

```bash
cd backend
npm run preflight --base-url https://agentops-studio-backend-o2jx.onrender.com
```

All 7 required env var checks should be green.

---

## Phase 1 — Webhook URL (already live on Render — no ngrok needed)

The backend is deployed on Render, so it's already publicly reachable. Your webhook URL is:

```
https://agentops-studio-backend-o2jx.onrender.com/api/v1/webhooks/vapi
```

Verify it's up:

```bash
curl https://agentops-studio-backend-o2jx.onrender.com/health
# Should return: {"status":"ok","mongo":"connected",...}
```

> **Local dev only**: If you're ever testing against a local backend (not Render), use ngrok:
> `ngrok http 3001` → copy the HTTPS URL and use that instead.

---

## Phase 2 — Vapi Outbound SIP Credential Setup (5 min)

The Vobiz outbound SIP trunk credentials are already in `backend/.env`:

```
VOBIZ_SIP_DOMAIN=df9ef9f9.sip.vobiz.ai
VOBIZ_AUTH_USERNAME=MA_R044I0LM
VOBIZ_AUTH_PASSWORD=<set in .env>
```

### 2.1 Create the Vapi outbound SIP credential

1. Open [Vapi Dashboard → Integrations → SIP Trunk Credentials](https://dashboard.vapi.ai/credentials)
2. Click **Add Credential**
3. Fill in:
   - **Provider**: `byo-sip-trunk`
   - **Name**: `Vobiz Outbound — +918065354620`
   - **Gateway**: `df9ef9f9.sip.vobiz.ai` (the `VOBIZ_SIP_DOMAIN` value)
   - **Username**: `MA_R044I0LM`
   - **Password**: `<VOBIZ_AUTH_PASSWORD from .env>`
   - **Outbound**: ✅ enabled, **Inbound**: ❌ disabled
4. Click **Save**
5. Copy the **credential UUID** returned by Vapi

### 2.2 Save the credential ID to .env

```bash
# In backend/.env:
VOBIZ_VAPI_CREDENTIAL_ID=<paste the UUID from step 2.1>
```

---

## Phase 3 — Vapi Inbound SIP Trunk Setup (one-time) (5 min)

This lets Vobiz route inbound calls (from +918065354620) to Vapi.

### 3.1 Create the Vapi inbound SIP trunk

1. Vapi Dashboard → **Integrations → SIP Trunk** → **Create New**
2. Name it: `Vobiz Inbound`
3. Add **10 gateways** — one per Vobiz signaling IP (port 5060, UDP, inbound only):
   ```
   13.203.7.132
   65.2.100.211
   13.126.98.234
   13.235.11.131
   13.233.44.61
   3.111.255.163
   3.111.128.110
   43.204.64.203
   15.207.232.91
   35.154.133.28
   ```
4. Set **Inbound**: ✅ enabled, **Outbound**: ❌ disabled
5. Save → note the **trunk ID** (UUID in the URL or response)

### 3.2 Create the Vobiz inbound trunk

1. [Vobiz Console](https://console.vobiz.ai) → **SIP Trunk → Inbound Trunks** → **Create New**
2. Fill in:
   - **Name**: `vapi-inbound`
   - **Primary URI**: `<VAPI_TRUNK_ID>.sip.vapi.ai`
     (replace `<VAPI_TRUNK_ID>` with the UUID from step 3.1)
3. Save

### 3.3 Link +918065354620 to the inbound trunk

1. Vobiz Console → **Numbers** → click **+918065354620**
2. Assign it to the `vapi-inbound` trunk you just created
3. Save

---

## Phase 4 — Vapi Phone Number & Webhook Config (5 min)

### 4.1 Confirm the phone number is imported in Vapi

+918065354620 was already imported into Vapi. Verify at:  
Vapi Dashboard → **Phone Numbers** → find `+918065354620`

If not present:
1. Click **Import** → **BYO SIP Trunk Number**
2. Enter `+918065354620`
3. Select the outbound credential from Phase 2
4. Click **Import**

### 4.2 Configure the Server URL (webhook)

1. Click on `+918065354620` in Vapi
2. In **Server URL**, paste:
   ```
   https://agentops-studio-backend-o2jx.onrender.com/api/v1/webhooks/vapi
   ```
   _(this is your Render deployment URL — no ngrok needed)_

3. In **Secret**, paste the value of `VAPI_WEBHOOK_SECRET` from `backend/.env`:
   ```
   <your VAPI_WEBHOOK_SECRET from backend/.env>
   ```

4. Set **Assistant mode**: **Server URL** (not fixed — enables assistant-request routing hook)

5. Click **Save**

### 4.3 Copy the Phone Number UUID

On the phone number detail page, copy the UUID (in the URL or ID field).

---

## Phase 5 — Link in AgentOps Studio & Update DB (2 min)

### 5.1 Link phone number via Settings

1. Open AgentOps Studio app → **Settings → Phone Number Setup**
2. Paste the UUID from Step 4.3
3. Click **Save** → status dot should turn green: "Phone number linked"

### 5.2 Ensure Ritu Electricals org has correct assistant ID (MongoDB)

In MongoDB Atlas, find the Ritu Electricals organization document and verify:

```json
{
  "vapiAssistantId": "100b3bd9-5038-4f11-b487-7ced98d8a3dd",
  "phoneNumber": "+918065354620",
  "telephonyProvider": "vobiz"
}
```

If missing, update via the Activate page in onboarding (click "Provision Agent") or patch directly in Atlas.

---

## Phase 6 — Webhook Simulation Test (2 min)

Before making a real call, verify the full webhook flow:

```bash
cd backend
npm run simulate
```

Expected output (if within business hours):
```
✓ PASS  GET /health          mongo=connected
✓ PASS  Phone ID             xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✓ PASS  Assistant ID         100b3bd9-5038-4f11-b487-7ced98d8a3dd
✓ PASS  Business hours: OPEN → returning assistantId: 100b3bd9...
✓ PASS  POST call-started    HTTP 200
✓ PASS  POST end-of-call-report  HTTP 200
✓ PASS  Call record created  status=completed  duration=47s
✓ PASS  Transcript record    5 turns
✓ PASS  Summary record       "The caller enquired about..."
```

If you see `Business hours: CLOSED → returning after-hours assistant`, either:
- The current IST time is outside your configured hours (check `org.businessHours`)
- The timezone is wrong — update in your onboarding config

---

## Phase 7 — End-to-End Real Call (5 min)

1. Ensure the Render deployment is live (or local backend if testing locally)
2. Call **+918065354620** from your mobile
3. You should hear the Ritu Electricals AI agent's greeting within 3–5 seconds

### What happens under the hood:

```
Your phone → +918065354620 (Vobiz) → Vobiz inbound trunk → sip.vapi.ai → Vapi
  → assistant-request webhook → backend → business hours check
  → { assistantId: "100b3bd9-5038-4f11-b487-7ced98d8a3dd" } returned → Vapi connects agent
  → call-started webhook → Call record created (status: active)
  → conversation
  → end-of-call-report webhook → Call updated + Transcript + Summary
```

### Verify in the dashboard:

1. Open **Calls** page in AgentOps Studio
2. You should see the call with your number, status, and duration
3. Click the call → verify Transcript and Summary appear

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Call rings but no AI voice | Vobiz inbound trunk not linked to Vapi | Check Vobiz Console → Inbound Trunks → Primary URI = `<trunk_id>.sip.vapi.ai` |
| AI answers but says "we're closed" | Outside business hours | Check `org.businessHours` in DB; call during configured hours |
| Vapi error: "No assistant found" | Phone number not in "server URL" mode | Vapi → Phone Number → Assistant mode → Server URL |
| Webhook 401 error in logs | Secret mismatch | Vapi Secret field must exactly match `VAPI_WEBHOOK_SECRET` |
| Call doesn't appear in Calls page | Org lookup failed | Ensure `vapiPhoneNumberId` is saved via Settings → Phone Number Setup |
| ngrok "tunnel not found" | ngrok session expired | Restart ngrok, update Vapi Server URL with new URL |
| All 10 Vobiz IPs not in Vapi | Incomplete inbound trunk setup | Vapi → Integrations → SIP Trunk → Vobiz Inbound → verify all 10 IPs |

---

## After a Successful Test Call

```bash
cd backend
npm run simulate   # confirm DB records exist
```

Then in the app:
- Calls page → your call visible ✓
- Call detail → transcript + summary ✓

**Session 3 complete. Week 1 done.**

Next: **Week 2 — Knowledge Base + Dashboard Analytics**
- `L2.F5.M1.AT1` — Knowledge Base schema (MongoDB collections)
- `L2.F5.M2.AT1` — Firecrawl integration for website crawling
- `L2.F5.M3.AT1` — BullMQ pipeline for KB ingestion
- Analytics Dashboard with call volume, duration, resolution rate charts
