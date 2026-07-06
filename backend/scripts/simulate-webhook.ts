/**
 * simulate-webhook.ts
 *
 * Fires all three Vapi webhook event types at the local backend server.
 * Use this to verify business-hours routing BEFORE making a real phone call.
 *
 * Usage:
 *   tsx scripts/simulate-webhook.ts
 *   tsx scripts/simulate-webhook.ts --base-url http://localhost:3001
 *   tsx scripts/simulate-webhook.ts --phone-id <vapiPhoneNumberId>
 *   tsx scripts/simulate-webhook.ts --assistant-id <vapiAssistantId>
 *
 * The script reads VAPI_WEBHOOK_SECRET and MONGODB_URI from backend/.env automatically.
 *
 * What it tests:
 *   1. assistant-request  → business hours routing (should return assistantId or after-hours config)
 *   2. call-started       → creates a Call record in MongoDB
 *   3. end-of-call-report → updates Call + creates Transcript + Summary
 *   4. DB verify          → confirms all three records exist after the simulation
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────────────

const args  = process.argv.slice(2);
const arg   = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const BASE_URL     = arg('--base-url')     ?? 'http://localhost:3001';
const CLI_PHONE_ID = arg('--phone-id');
const CLI_ASST_ID  = arg('--assistant-id');
const SECRET       = process.env.VAPI_WEBHOOK_SECRET ?? '';
const MONGO_URI    = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/agentops_studio';

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
  white:  '\x1b[97m',
};

const pass  = `${C.green}✓ PASS${C.reset}`;
const fail  = `${C.red}✗ FAIL${C.reset}`;
const info  = `${C.cyan}ℹ${C.reset}`;
const warn  = `${C.yellow}⚠${C.reset}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function post(path: string, body: object): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-vapi-secret':  SECRET,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function hr() {
  console.log(`${C.grey}${'─'.repeat(64)}${C.reset}`);
}

function header(title: string) {
  console.log(`\n${C.bold}${C.white}${title}${C.reset}`);
  hr();
}

function result(label: string, ok: boolean, detail?: string) {
  const icon = ok ? pass : fail;
  const d    = detail ? `  ${C.grey}${detail}${C.reset}` : '';
  console.log(`  ${icon}  ${label}${d}`);
}

// ─── Step 0: Backend connectivity ────────────────────────────────────────────

async function checkHealth(): Promise<boolean> {
  header('Step 0 — Backend connectivity');
  try {
    const res  = await fetch(`${BASE_URL}/health`);
    const data = await res.json() as { status?: string; mongo?: string; uptime?: number };
    const ok   = res.ok && data.status === 'ok';
    result('GET /health', ok, `mongo=${data.mongo ?? '?'}  uptime=${data.uptime ?? '?'}s`);
    if (!ok) {
      console.log(`\n  ${fail}  Backend is not running. Start it with: npm run dev\n`);
    }
    return ok;
  } catch (err) {
    result('GET /health', false, `Could not reach ${BASE_URL} — is the backend running?`);
    return false;
  }
}

// ─── Resolve IDs from MongoDB ─────────────────────────────────────────────────

interface OrgRecord {
  _id:               mongoose.Types.ObjectId;
  name:              string;
  vapiPhoneNumberId?: string;
  vapiAssistantId?:  string;
  businessHours?:    { start: string; end: string };
  timezone?:         string;
}

async function resolveIds(): Promise<{ phoneId: string | null; assistantId: string | null; org: OrgRecord | null }> {
  header('Step 0b — Resolving IDs from MongoDB');

  // Use CLI args if provided
  if (CLI_PHONE_ID && CLI_ASST_ID) {
    result('Phone ID',    true, CLI_PHONE_ID);
    result('Assistant ID', true, CLI_ASST_ID);
    return { phoneId: CLI_PHONE_ID, assistantId: CLI_ASST_ID, org: null };
  }

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OrgModel = mongoose.models['Organization'] ??
      mongoose.model<OrgRecord>('Organization', new mongoose.Schema({
        name:              String,
        vapiPhoneNumberId: String,
        vapiAssistantId:   String,
        businessHours:     { start: String, end: String },
        timezone:          String,
      }));

    const org = await (OrgModel as mongoose.Model<OrgRecord>)
      .findOne({ vapiAssistantId: { $exists: true, $ne: null } })
      .lean();

    if (!org) {
      console.log(`  ${warn}  No provisioned org found. Run through the onboarding flow first.`);
      return { phoneId: null, assistantId: null, org: null };
    }

    const phoneId    = CLI_PHONE_ID    ?? org.vapiPhoneNumberId ?? null;
    const assistantId = CLI_ASST_ID   ?? org.vapiAssistantId   ?? null;

    result('Org found',    true,  org.name);
    result('Phone ID',     Boolean(phoneId),     phoneId    ?? 'NOT LINKED — run Settings → Phone Number Setup first');
    result('Assistant ID', Boolean(assistantId), assistantId ?? 'NOT PROVISIONED — run onboarding → Activate');
    if (org.businessHours) {
      const { start, end } = org.businessHours;
      const tz  = org.timezone ?? 'Asia/Kolkata';
      const now = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
      console.log(`  ${info}  Business hours: ${start}–${end} (${tz}) | Local time now: ${now}`);
    }

    return { phoneId, assistantId, org };
  } catch (err) {
    console.log(`  ${warn}  Could not connect to MongoDB: ${String(err)}`);
    console.log(`  ${info}  Pass --phone-id and --assistant-id as CLI args to skip DB lookup.`);
    return { phoneId: null, assistantId: null, org: null };
  }
}

// ─── Step 1: assistant-request ────────────────────────────────────────────────

async function testAssistantRequest(phoneId: string | null) {
  header('Step 1 — assistant-request (business hours routing)');

  if (!phoneId) {
    console.log(`  ${warn}  Skipped — no phone number ID available.`);
    console.log(`  ${info}  Set up via Settings → Phone Number Setup, then re-run with --phone-id <uuid>`);
    return;
  }

  const fakeCallId = randomUUID();
  const payload = {
    message: {
      type: 'assistant-request',
      call: {
        id:            fakeCallId,
        type:          'inboundPhoneCall',
        phoneNumberId: phoneId,
        customer:      { number: '+919876543210' },
      },
    },
  };

  const { status, data } = await post('/api/v1/webhooks/vapi', payload);
  const d = data as Record<string, unknown>;
  const ok = status === 200;

  result('POST /api/v1/webhooks/vapi (assistant-request)', ok, `HTTP ${status}`);

  if (ok && d) {
    if ('assistantId' in d) {
      console.log(`  ${pass}  Business hours: OPEN → returning assistantId: ${C.cyan}${d.assistantId as string}${C.reset}`);
    } else if ('assistant' in d) {
      const asst = d.assistant as Record<string, unknown>;
      const name = asst.name as string ?? 'After-hours bot';
      console.log(`  ${warn}  Business hours: CLOSED → returning after-hours assistant: "${name}"`);
      console.log(`  ${info}  To test during open hours, adjust your org's businessHours in the DB.`);
    } else if ('message' in d) {
      console.log(`  ${warn}  Response: ${d.message as string}`);
    } else {
      console.log(`  ${info}  Response: ${JSON.stringify(d, null, 2)}`);
    }
  }
}

// ─── Step 2: call-started ─────────────────────────────────────────────────────

async function testCallStarted(assistantId: string | null): Promise<string | null> {
  header('Step 2 — call-started (creates Call record)');

  if (!assistantId) {
    console.log(`  ${warn}  Skipped — no assistant ID available.`);
    return null;
  }

  const fakeCallId = `sim_${Date.now()}`;
  const payload = {
    message: {
      type: 'call-started',
      call: {
        id:          fakeCallId,
        assistantId: assistantId,
        type:        'inboundPhoneCall',
        customer:    { number: '+919876543210' },
      },
    },
  };

  const { status } = await post('/api/v1/webhooks/vapi', payload);
  result('POST /api/v1/webhooks/vapi (call-started)', status === 200, `HTTP ${status}`);
  console.log(`  ${info}  Simulated call ID: ${C.cyan}${fakeCallId}${C.reset}`);

  return fakeCallId;
}

// ─── Step 3: end-of-call-report ───────────────────────────────────────────────

async function testEndOfCallReport(assistantId: string | null, callId: string | null) {
  header('Step 3 — end-of-call-report (updates Call + creates Transcript + Summary)');

  if (!assistantId || !callId) {
    console.log(`  ${warn}  Skipped — no assistant ID or call ID.`);
    return;
  }

  const payload = {
    message: {
      type: 'end-of-call-report',
      call: {
        id:            callId,
        assistantId:   assistantId,
        type:          'inboundPhoneCall',
        customer:      { number: '+919876543210' },
        endedReason:   'customer-ended-call',
      },
      durationSeconds: 47,
      cost:            0.0312,
      summary:         'The caller enquired about business hours and service availability. The agent confirmed opening times and offered a callback. Resolved successfully.',
      messages: [
        { role: 'assistant', content: 'Thank you for calling. How can I help you today?' },
        { role: 'user',      content: 'What are your business hours?' },
        { role: 'assistant', content: 'We are open Monday to Saturday from 9 AM to 6 PM IST.' },
        { role: 'user',      content: 'Great, thank you!' },
        { role: 'assistant', content: 'You are welcome. Have a wonderful day!' },
      ],
    },
  };

  const { status } = await post('/api/v1/webhooks/vapi', payload);
  result('POST /api/v1/webhooks/vapi (end-of-call-report)', status === 200, `HTTP ${status}`);
}

// ─── Step 4: DB verification ──────────────────────────────────────────────────

async function verifyDatabase(callId: string | null) {
  header('Step 4 — Database verification');

  if (!callId) {
    console.log(`  ${warn}  Skipped — no call ID from Step 2.`);
    return;
  }

  // Wait a moment for async fire-and-forget processing to complete
  console.log(`  ${info}  Waiting 2 s for async webhook processing…`);
  await new Promise((r) => setTimeout(r, 2000));

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error('DB not connected');

    const call       = await db.collection('calls').findOne({ vapiCallId: callId });
    const transcript = call ? await db.collection('transcripts').findOne({ callId: call._id }) : null;
    const summary    = call ? await db.collection('summaries').findOne({ callId: call._id }) : null;

    result('Call record created',       Boolean(call),       call ? `status=${call.status as string}  duration=${call.duration as number}s  cost=$${call.cost as number}` : 'NOT FOUND');
    result('Transcript record created', Boolean(transcript), transcript ? `${(transcript.turns as unknown[]).length} turns` : 'NOT FOUND');
    result('Summary record created',    Boolean(summary),    summary ? `"${(summary.summaryText as string).slice(0, 60)}…"` : 'NOT FOUND');
  } catch (err) {
    console.log(`  ${warn}  DB verify skipped: ${String(err)}`);
    console.log(`  ${info}  Check the Calls page in the dashboard instead.`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗`);
  console.log(`║       AgentOps Studio — Vapi Webhook Simulator            ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`  ${info}  Base URL: ${BASE_URL}`);
  console.log(`  ${info}  Secret:   ${SECRET ? `${SECRET.slice(0, 8)}…${SECRET.slice(-4)}` : `${C.red}NOT SET${C.reset} (set VAPI_WEBHOOK_SECRET)`}`);

  // Step 0: health
  const healthy = await checkHealth();
  if (!healthy) process.exit(1);

  // Resolve IDs
  const { phoneId, assistantId } = await resolveIds();

  // Steps 1-4
  await testAssistantRequest(phoneId);
  const callId = await testCallStarted(assistantId);

  // Give the fire-and-forget handler a moment
  await new Promise((r) => setTimeout(r, 500));
  await testEndOfCallReport(assistantId, callId);
  await verifyDatabase(callId);

  // Summary
  header('Simulation Complete');
  if (!phoneId && !assistantId) {
    console.log(`  ${warn}  Most tests were skipped — complete onboarding + phone number setup first.\n`);
  } else {
    console.log(`  ${pass}  Webhook simulation finished. Check the Calls page to confirm.\n`);
    console.log(`  ${info}  Next: Make a real call to your Exotel DID number.\n`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n${C.red}Simulation crashed:${C.reset}`, err);
  process.exit(1);
});
