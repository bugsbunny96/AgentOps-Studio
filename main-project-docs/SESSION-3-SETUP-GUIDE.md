# Session 3 — Exotel + Vapi Setup & End-to-End Test Call

> **Estimated time**: 25–40 minutes  
> **Outcome**: A real phone call reaches your AI agent, business-hours routing works, and the call record appears in the AgentOps Studio Calls page.

---

## Tools you need open

- Terminal (backend running: `npm run dev`)
- [Exotel Dashboard](https://exotel.com/) — logged in as `agentops1`
- [Vapi Dashboard](https://dashboard.vapi.ai/)
- AgentOps Studio app (frontend running: `npm run dev`)
- A phone to make the test call

---

## Phase 0 — Pre-flight (2 min)

With the backend running, in a separate terminal:

```bash
cd backend
npm run preflight
```

All 7 required env var checks should be green. The only acceptable failures at this point are "Backend reachable" (fix: start backend) and the ngrok warning (fix: Step 2 below).

---

## Phase 1 — Expose Backend via ngrok (3 min)

Vapi must be able to reach your webhook. During local development, use ngrok.

### 1.1 Install ngrok (if not already installed)

```bash
brew install ngrok/ngrok/ngrok
# or: https://ngrok.com/download
```

### 1.2 Authenticate ngrok (first time only)

```bash
ngrok config add-authtoken <your-authtoken>
# Get authtoken free at: https://dashboard.ngrok.com/get-started/your-authtoken
```

### 1.3 Expose your backend

```bash
ngrok http 3001
```

You will see a line like:

```
Forwarding   https://a1b2-34-56-78-90.ngrok-free.app -> http://localhost:3001
```

**Copy that HTTPS URL** — you'll use it in the next steps.  
Keep this terminal window open for the entire session.

### 1.4 Verify ngrok is working

```bash
curl https://<your-ngrok-url>/health
# Should return: {"status":"ok","mongo":"connected",...}
```

---

## Phase 2 — Exotel SIP Setup (10–15 min)

Your Exotel account (`agentops1`) already has API credentials in `.env`. Now configure the SIP trunk.

### 2.1 Create a SIP Endpoint pointing to Vapi

1. Log in to [Exotel Dashboard](https://my.exotel.com)
2. Navigate to **Developer → SIP Endpoint**
3. Click **Create New Endpoint**
4. Fill in:
   - **Name**: `vapi-sip`
   - **URI**: `sip.vapi.ai` (no port needed)
   - **Transport**: UDP
5. Click **Save**

> **Why this works**: Exotel forwards the SIP call to Vapi's SIP gateway, which then handles the AI session.

### 2.2 Buy a DID number (if not already purchased)

1. Navigate to **Numbers → Buy Number**
2. Select **India** → search for a local number in your city
3. Complete the purchase (~₹100–300/month)
4. Note the number (e.g. `+91-80-XXXX-XXXX`)

### 2.3 Connect your DID to the Vapi SIP endpoint

1. Navigate to **Numbers → your DID** → click **Settings**
2. Under **Calls**, set:
   - **Call type**: SIP
   - **SIP Endpoint**: select `vapi-sip` (the one you created)
3. Click **Save**

### 2.4 Quick test (optional)

Call your DID from your phone. You should hear a Vapi error ("no assistant configured") — this confirms Exotel is routing to Vapi correctly. The assistant config comes in Phase 3.

---

## Phase 3 — Vapi Phone Number Import & Configuration (5 min)

### 3.1 Import the Exotel DID into Vapi

1. Open [Vapi Dashboard → Phone Numbers](https://dashboard.vapi.ai/phone-numbers)
2. Click **Import**
3. Select provider: **Custom SIP / Exotel**
4. Enter the DID number exactly as Exotel shows it (E.164 format: `+91XXXXXXXXXX`)
5. Click **Import**

### 3.2 Configure the Server URL (webhook)

1. Click on the newly imported phone number
2. In **Server URL**, paste:
   ```
   https://<your-ngrok-url>/api/v1/webhooks/vapi
   ```
   _(replace with your actual ngrok URL from Phase 1)_

3. In **Secret**, paste the value of `VAPI_WEBHOOK_SECRET` from `backend/.env`:
   ```
   9abea93b3e8d6712464be43a17f48e169e8a0f3710e371c4ffb179d55506f0f1
   ```

4. Set **Assistant mode**: **Server URL** (not a fixed assistant — this enables the assistant-request routing hook)

5. Click **Save**

### 3.3 Copy the Phone Number UUID

On the phone number detail page, the URL will contain the UUID:
```
https://dashboard.vapi.ai/phone-numbers/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Or look for the **ID** field on the page. Copy this UUID.

---

## Phase 4 — Link Phone Number in AgentOps Studio (1 min)

1. Open the AgentOps Studio app
2. Navigate to **Settings → Phone Number Setup**
3. Paste the UUID from Step 3.3
4. Click **Save**

You should see the status dot turn green: "Phone number linked".

---

## Phase 5 — Webhook Simulation Test (2 min)

Before making a real call, verify the full webhook flow:

```bash
cd backend
npm run simulate
```

Expected output (if within business hours):
```
✓ PASS  GET /health          mongo=connected
✓ PASS  Phone ID             xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✓ PASS  Assistant ID         xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✓ PASS  Business hours: OPEN → returning assistantId: xxxxx
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

## Phase 6 — End-to-End Real Call (5 min)

1. Ensure the backend is running with ngrok active
2. Call your Exotel DID number from your mobile
3. You should hear your AI agent's greeting within 3–5 seconds

### What happens under the hood:

```
Your phone → Exotel DID → SIP → sip.vapi.ai → Vapi
  → assistant-request webhook → backend → business hours check
  → { assistantId: "<id>" } returned → Vapi connects the agent
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
| Exotel DID rings but no AI voice | SIP endpoint not connected | Check Exotel → Numbers → DID → SIP endpoint selected |
| AI answers but says "we're closed" | Outside business hours | Check org.businessHours in DB; call during configured hours |
| Vapi error: "No assistant found" | Phone number not in "server URL" mode | Vapi → Phone Number → Assistant mode → Server URL |
| Webhook 401 error in logs | Secret mismatch | Vapi Secret field must exactly match VAPI_WEBHOOK_SECRET |
| Call doesn't appear in Calls page | Org lookup failed | Ensure vapiPhoneNumberId is saved via Settings → Phone Number Setup |
| ngrok "tunnel not found" | ngrok session expired | Restart ngrok, update Vapi Server URL with new URL |

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
