/**
 * preflight.ts — Pre-call checklist
 *
 * Run this BEFORE making the first real test call.
 * Verifies every prerequisite: env vars, backend health, DB connectivity,
 * Vapi assistant provisioned, phone number linked.
 *
 * Usage:
 *   tsx scripts/preflight.ts
 *   tsx scripts/preflight.ts --base-url http://localhost:3001
 *
 * Exit 0 = all green, safe to make a real call.
 * Exit 1 = one or more checks failed, fix before calling.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// ─── Config ────────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const argVal    = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const BASE_URL  = argVal('--base-url') ?? 'http://localhost:3001';
const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/agentops_studio';

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', grey: '\x1b[90m', white: '\x1b[97m',
};

let failures = 0;

function check(label: string, ok: boolean, note?: string) {
  const icon = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  const n    = note ? `  ${C.grey}${note}${C.reset}` : '';
  console.log(`  ${icon}  ${label}${n}`);
  if (!ok) failures++;
}

function section(title: string) {
  console.log(`\n${C.bold}${C.white}${title}${C.reset}`);
  console.log(`${C.grey}${'─'.repeat(60)}${C.reset}`);
}

function hint(msg: string) {
  console.log(`     ${C.yellow}→${C.reset} ${C.grey}${msg}${C.reset}`);
}

// ─── 1. Environment variables ─────────────────────────────────────────────────

function checkEnvVars() {
  section('1. Environment Variables');

  const required: Array<[string, string]> = [
    ['MONGODB_URI',           'MongoDB connection string'],
    ['JWT_ACCESS_SECRET',     'JWT signing secret'],
    ['VAPI_API_KEY',          'Vapi private key (dashboard → API Keys)'],
    ['VAPI_PUBLIC_KEY',       'Vapi public key (dashboard → API Keys)'],
    ['VAPI_WEBHOOK_SECRET',   'Webhook secret (64-char hex)'],
    ['OPENAI_API_KEY',        'OpenAI API key'],
    ['DEEPGRAM_API_KEY',      'Deepgram API key'],
  ];

  const optional: Array<[string, string]> = [
    ['VOBIZ_SIP_DOMAIN',        'Vobiz SIP domain (e.g. df9ef9f9.sip.vobiz.ai) — needed for outbound calls'],
    ['VOBIZ_AUTH_USERNAME',     'Vobiz SIP trunk username — from Vobiz Console → Authentication & Linking'],
    ['VOBIZ_AUTH_PASSWORD',     'Vobiz SIP trunk password'],
    ['VOBIZ_VAPI_CREDENTIAL_ID','Vapi credential ID after POST /credential with byo-sip-trunk payload'],
    ['RESEND_API_KEY',          'Resend email API key'],
  ];

  for (const [key, desc] of required) {
    const val = process.env[key];
    const ok  = Boolean(val && val.trim().length > 0 && !val.includes('your_') && !val.includes('placeholder'));
    check(key, ok, ok ? `set (${val!.slice(0, 6)}…)` : `MISSING — ${desc}`);
    if (!ok) hint(`Add ${key}=<value> to backend/.env`);
  }

  console.log(`\n  Optional (not blocking):`);
  for (const [key, desc] of optional) {
    const val = process.env[key];
    const ok  = Boolean(val && val.trim().length > 0);
    const icon = ok ? `${C.green}✓${C.reset}` : `${C.yellow}○${C.reset}`;
    console.log(`  ${icon}  ${key}${C.grey}  ${ok ? `set` : `not set — ${desc}`}${C.reset}`);
  }
}

// ─── 2. Backend health ────────────────────────────────────────────────────────

async function checkBackendHealth(): Promise<boolean> {
  section('2. Backend Health');
  try {
    const res  = await fetch(`${BASE_URL}/health`);
    const data = await res.json() as { status?: string; mongo?: string; uptime?: number; environment?: string };
    const up   = res.ok && data.status === 'ok';
    check('Backend reachable',  up, up ? `uptime=${data.uptime}s  env=${data.environment}` : `HTTP ${res.status}`);
    if (up) {
      check('MongoDB connected via backend', data.mongo === 'connected', data.mongo ?? 'unknown');
      if (data.mongo !== 'connected') hint('Check MONGODB_URI and ensure MongoDB/Docker is running');
    } else {
      hint(`Start the backend: cd backend && npm run dev`);
    }
    return up;
  } catch {
    check('Backend reachable', false, `Cannot reach ${BASE_URL} — is the server running?`);
    hint('Start with: cd backend && npm run dev');
    return false;
  }
}

// ─── 3. Database checks ───────────────────────────────────────────────────────

interface OrgDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  vapiAssistantId?: string;
  vapiPhoneNumberId?: string;
  onboardingStatus?: string;
  businessHours?: { start: string; end: string };
  timezone?: string;
}

async function checkDatabase() {
  section('3. Database & Org State');
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });

    const OrgSchema = new mongoose.Schema({ name: String, vapiAssistantId: String, vapiPhoneNumberId: String, onboardingStatus: String, businessHours: { start: String, end: String }, timezone: String });
    const OrgModel  = (mongoose.models['Organization'] ?? mongoose.model<OrgDoc>('Organization', OrgSchema)) as mongoose.Model<OrgDoc>;

    const orgs = await OrgModel.find({}).lean();
    check('At least one org exists', orgs.length > 0, `${orgs.length} org(s) found`);
    if (!orgs.length) {
      hint('Complete onboarding to create an org');
      return;
    }

    for (const org of orgs) {
      const hasAssistant  = Boolean(org.vapiAssistantId);
      const hasPhoneId    = Boolean(org.vapiPhoneNumberId);
      const isCompleted   = org.onboardingStatus === 'COMPLETED';

      console.log(`\n  ${C.bold}Org: ${org.name}${C.reset}`);
      check('  Onboarding completed', isCompleted, org.onboardingStatus ?? 'unknown');
      if (!isCompleted) hint('Finish the onboarding wizard → Activate step');

      check('  Vapi assistant provisioned', hasAssistant, org.vapiAssistantId ?? 'NOT SET');
      if (!hasAssistant) hint('Go to Activate page — click "Provision Agent"');

      check('  Phone number linked', hasPhoneId, org.vapiPhoneNumberId ?? 'NOT SET');
      if (!hasPhoneId) hint('Settings → Phone Number Setup → paste Vapi phone number UUID');

      if (org.businessHours) {
        const tz  = org.timezone ?? 'Asia/Kolkata';
        const now = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true, weekday: 'short' }).format(new Date());
        const { start, end } = org.businessHours;
        console.log(`  ℹ  Business hours: ${start}–${end} ${tz} | Current local time: ${now}`);
      }
    }
  } catch (err) {
    check('MongoDB connection', false, `${String(err)}`);
    hint('Ensure MongoDB is running: docker ps | grep mongo');
  }
}

// ─── 4. Webhook reachability ──────────────────────────────────────────────────

async function checkWebhook() {
  section('4. Webhook Endpoint');

  const secret = process.env.VAPI_WEBHOOK_SECRET ?? '';

  // Fire a dummy event to verify the endpoint responds
  try {
    const res = await fetch(`${BASE_URL}/api/v1/webhooks/vapi`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-vapi-secret': secret },
      body:    JSON.stringify({ message: { type: 'ping' } }),
    });
    // Any 200 (even for unknown event type) means auth passed and endpoint is wired
    check('Webhook endpoint reachable', res.status === 200, `HTTP ${res.status}`);
    if (res.status === 401) hint('VAPI_WEBHOOK_SECRET mismatch — check backend/.env vs Vapi dashboard');
    if (res.status === 404) hint('Route not registered — check app.ts for vapiWebhookRouter');
  } catch {
    check('Webhook endpoint reachable', false, `Cannot reach ${BASE_URL}/api/v1/webhooks/vapi`);
  }

  // Check if a public URL is configured (ngrok)
  const clientUrl = process.env.CLIENT_URL ?? '';
  const isLocal   = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
  if (isLocal) {
    console.log(`\n  ${C.yellow}⚠${C.reset}  Backend is running locally — Vapi cannot reach it.`);
    hint('Preferred: deploy to Render — set Vapi Server URL to https://agentops-studio-backend-o2jx.onrender.com/api/v1/webhooks/vapi');
    hint('Local dev fallback: expose with ngrok → ngrok http 3001 → use the HTTPS URL instead');
    hint('Also update VAPI_WEBHOOK_SECRET in Vapi → Phone Number → Secret');
  } else {
    check('Backend URL is public', true, BASE_URL);
  }
}

// ─── 5. Vobiz + Vapi SIP checklist ───────────────────────────────────────────

function checkVobizChecklist() {
  section('5. Vobiz + Vapi Dashboard Checklist (manual)');
  const steps = [
    ['Vobiz account funded (≥ ₹20)',                'console.vobiz.ai → Billing → Add Funds (trial has ₹20.50)'],
    ['Vobiz outbound trunk credentials in .env',    '.env: VOBIZ_SIP_DOMAIN + VOBIZ_AUTH_USERNAME + VOBIZ_AUTH_PASSWORD'],
    ['Vapi outbound credential created',            'Vapi → Integrations → SIP Trunk Credentials → Add (use VOBIZ_SIP_DOMAIN as gateway URL)'],
    ['VOBIZ_VAPI_CREDENTIAL_ID set in .env',        'Paste the credential UUID returned by Vapi into backend/.env'],
    ['Phone number imported in Vapi (outbound)',    'Vapi → Phone Numbers → BYO SIP Trunk Number → enter +918065354620'],
    ['Vapi inbound SIP trunk created (10 IPs)',     'Vapi → Integrations → SIP Trunk → Create → add all 10 Vobiz signaling IPs (see telephony.service.ts)'],
    ['Vobiz inbound trunk created',                 'Vobiz Console → SIP Trunk → Inbound Trunks → Create → Primary URI: <VAPI_TRUNK_ID>.sip.vapi.ai'],
    ['Vobiz number linked to inbound trunk',        'Vobiz Console → Numbers → +918065354620 → assign to inbound trunk'],
    ['Vapi server URL set on phone number',         'Vapi → Phone Number → Server URL = https://<your-domain>/api/v1/webhooks/vapi'],
    ['Vapi webhook secret set on phone number',     'Vapi → Phone Number → Secret = VAPI_WEBHOOK_SECRET value'],
    ['vapiPhoneNumberId saved on org in DB',        'MongoDB → organizations → your org → vapiPhoneNumberId = UUID from Vapi'],
    ['vapiAssistantId saved on org in DB',          'MongoDB → organizations → your org → vapiAssistantId = 100b3bd9-5038-4f11-b487-7ced98d8a3dd'],
  ];

  steps.forEach(([step, hint], i) => {
    console.log(`  ${C.grey}${String(i + 1).padStart(2, ' ')}.${C.reset}  ◻ ${step}`);
    console.log(`       ${C.grey}${hint}${C.reset}`);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗`);
  console.log(`║     AgentOps Studio — Pre-Call Preflight Checker          ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`  Base URL: ${BASE_URL}\n`);

  checkEnvVars();
  const backendUp = await checkBackendHealth();
  if (backendUp) await checkDatabase();
  await checkWebhook();
  checkVobizChecklist();

  section('Result');
  if (failures === 0) {
    console.log(`  ${C.green}${C.bold}✓ All checks passed — you're ready to make a test call!${C.reset}`);
    console.log(`\n  Next steps:`);
    console.log(`  1. Run the webhook simulator: npm run simulate`);
    console.log(`  2. Make a real call to your Vobiz number +918065354620`);
    console.log(`  3. Check the Calls page in the dashboard\n`);
  } else {
    console.log(`  ${C.red}${C.bold}✗ ${failures} check(s) failed — fix these before making a real call.${C.reset}\n`);
  }

  await mongoose.disconnect();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n${C.red}Preflight crashed:${C.reset}`, err);
  process.exit(1);
});
