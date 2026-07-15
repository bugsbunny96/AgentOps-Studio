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
    ['EXOTEL_API_KEY',    'Exotel API key — needed for Exotel SIP setup'],
    ['EXOTEL_API_TOKEN',  'Exotel API token'],
    ['EXOTEL_SID',        'Exotel SID (account sub-domain)'],
    ['RESEND_API_KEY',    'Resend email API key'],
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
    hint('Expose your backend with ngrok: ngrok http 3001');
    hint('Then update Vapi dashboard → Phone Number → Server URL to: https://<ngrok-url>/api/v1/webhooks/vapi');
    hint('Also update VAPI_WEBHOOK_SECRET in Vapi → Phone Number → Secret');
  } else {
    check('Backend URL is public', true, BASE_URL);
  }
}

// ─── 5. Exotel SIP checklist ─────────────────────────────────────────────────

function checkExotelChecklist() {
  section('5. Exotel & Vapi Dashboard Checklist (manual)');
  const steps = [
    ['Exotel account created',                      'exotel.com → Sign up → verify KYC'],
    ['DID number purchased in Exotel',              'Exotel → Numbers → Buy Number (Indian DID)'],
    ['SIP endpoint created → sip.vapi.ai',          'Exotel → Developer → SIP Endpoint → URI: sip.vapi.ai'],
    ['DID connected to SIP endpoint',               'Exotel → Numbers → your DID → Connect to SIP endpoint'],
    ['Vapi phone number imported',                  'Vapi → Phone Numbers → Import → Exotel SIP'],
    ['Vapi server URL set',                         'Vapi → Phone Number → Server URL = https://<ngrok>/api/v1/webhooks/vapi'],
    ['Vapi webhook secret set',                     'Vapi → Phone Number → Secret = VAPI_WEBHOOK_SECRET value'],
    ['Phone number UUID pasted in Settings page',   'App → Settings → Phone Number Setup → Save'],
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
  checkExotelChecklist();

  section('Result');
  if (failures === 0) {
    console.log(`  ${C.green}${C.bold}✓ All checks passed — you're ready to make a test call!${C.reset}`);
    console.log(`\n  Next steps:`);
    console.log(`  1. Run the webhook simulator: npm run simulate`);
    console.log(`  2. Make a real call to your Exotel DID`);
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
