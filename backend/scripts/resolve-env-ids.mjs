#!/usr/bin/env node
/**
 * Resolves missing integration IDs in backend/.env and verifies Vobiz credentials.
 *
 *   node scripts/resolve-env-ids.mjs                    # dry run — prints findings only
 *   node scripts/resolve-env-ids.mjs --write            # also writes unambiguous IDs into .env
 *   node scripts/resolve-env-ids.mjs --vobiz            # only re-check Vobiz credentials
 *   node scripts/resolve-env-ids.mjs --create-pro-price # creates Pro ₹25,999/mo INR price if missing (implies --write)
 *
 * Fills: STRIPE_PRO_PRICE_ID_INR, VOBIZ_VAPI_INBOUND_CREDENTIAL_ID, VAPI_STRUCTURED_OUTPUT_ID
 * Checks: VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN against the Vobiz REST API.
 * Secrets are never printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
const args = new Set(process.argv.slice(2));
const CREATE_PRO = args.has('--create-pro-price');
const WRITE = args.has('--write') || CREATE_PRO;
const VOBIZ_ONLY = args.has('--vobiz');

const raw = fs.readFileSync(ENV_PATH, 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '');
}

const updates = {};
const ok = (s) => console.log(`  ✅ ${s}`);
const warn = (s) => console.log(`  ⚠️  ${s}`);
const info = (s) => console.log(`     ${s}`);

async function call(url, opts = {}) {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  } catch (e) {
    const cause = e.cause ? ` (${e.cause.code ?? ''} ${e.cause.message ?? e.cause})` : '';
    return { status: 0, body: `${e.message ?? e}${cause}` };
  }
}

// ── 1. Stripe: Pro plan INR price ────────────────────────────────────────────
async function stripe() {
  console.log('\nStripe — STRIPE_PRO_PRICE_ID_INR');
  if (!env.STRIPE_SECRET_KEY) return warn('STRIPE_SECRET_KEY not set');
  const mode = env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'TEST';
  info(`key mode: ${mode}`);
  const auth = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  const r = await call('https://api.stripe.com/v1/prices?active=true&limit=100&expand[]=data.product', { headers: auth });
  if (r.status !== 200) return warn(`Stripe API ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`);

  const known = { [env.STRIPE_STARTER_PRICE_ID_INR]: 'Starter INR (in .env)', [env.STRIPE_GROWTH_PRICE_ID_INR]: 'Growth INR (in .env)' };
  info('active prices:');
  for (const p of r.body.data) {
    const amt = p.unit_amount != null ? (p.unit_amount / 100).toLocaleString('en-IN') : '?';
    info(`  ${p.id}  ${p.currency.toUpperCase()} ${amt}/${p.recurring?.interval ?? 'one-time'}  "${p.product?.name ?? ''}"  ${known[p.id] ?? ''}`);
  }
  const pro = r.body.data.filter((p) => p.currency === 'inr' && p.unit_amount === 2599900 && p.recurring?.interval === 'month');
  if (pro.length === 1) { ok(`found Pro INR price ${pro[0].id}`); updates.STRIPE_PRO_PRICE_ID_INR = pro[0].id; return; }
  if (pro.length > 1) return warn(`multiple ₹25,999/mo prices found — pick one manually: ${pro.map((p) => p.id).join(', ')}`);

  warn('no active ₹25,999/month INR price exists');
  if (!CREATE_PRO) return info('re-run with --create-pro-price to create it');
  const form = (o) => new URLSearchParams(o).toString();
  const h = { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' };
  const prod = await call('https://api.stripe.com/v1/products', { method: 'POST', headers: h, body: form({ name: 'AgentOps Studio — Pro', 'metadata[plan]': 'enterprise' }) });
  if (prod.status !== 200) return warn(`product create failed ${prod.status}`);
  const price = await call('https://api.stripe.com/v1/prices', { method: 'POST', headers: h,
    body: form({ product: prod.body.id, currency: 'inr', unit_amount: '2599900', 'recurring[interval]': 'month', nickname: 'Pro (INR monthly)' }) });
  if (price.status !== 200) return warn(`price create failed ${price.status}: ${JSON.stringify(price.body).slice(0, 160)}`);
  ok(`created ${mode} price ${price.body.id} (product ${prod.body.id})`);
  updates.STRIPE_PRO_PRICE_ID_INR = price.body.id;
}

// ── 2. Vapi: inbound credential + structured output ─────────────────────────
async function vapi() {
  console.log('\nVapi — VOBIZ_VAPI_INBOUND_CREDENTIAL_ID, VAPI_STRUCTURED_OUTPUT_ID');
  if (!env.VAPI_API_KEY) return warn('VAPI_API_KEY not set');
  const auth = { Authorization: `Bearer ${env.VAPI_API_KEY}` };

  const c = await call('https://api.vapi.ai/credential', { headers: auth });
  if (c.status !== 200) warn(`credential list ${c.status}`);
  else {
    const sip = (Array.isArray(c.body) ? c.body : c.body.results ?? []).filter((x) => x.provider === 'byo-sip-trunk');
    info('SIP trunk credentials:');
    for (const x of sip) {
      const ips = (x.gateways ?? []).map((g) => g.ip).join(', ');
      const tag = x.id === env.VOBIZ_VAPI_CREDENTIAL_ID ? '← current VOBIZ_VAPI_CREDENTIAL_ID (outbound)' : '';
      info(`  ${x.id}  "${x.name ?? ''}"  gateways=${(x.gateways ?? []).length} [${ips}] ${tag}`);
    }
    const others = sip.filter((x) => x.id !== env.VOBIZ_VAPI_CREDENTIAL_ID);
    const named = others.filter((x) => /inbound/i.test(x.name ?? ''));
    const multiGw = others.filter((x) => (x.gateways ?? []).length >= 5);
    const pick = named.length === 1 ? named[0] : (named.length === 0 && multiGw.length === 1 ? multiGw[0] : null);
    if (pick) { ok(`inbound credential: ${pick.id} ("${pick.name ?? ''}")`); updates.VOBIZ_VAPI_INBOUND_CREDENTIAL_ID = pick.id; }
    else if (!others.length) warn('no separate inbound credential exists — create one in Vapi with the 10 Vobiz signaling IPs as gateways');
    else warn('several candidates — set VOBIZ_VAPI_INBOUND_CREDENTIAL_ID manually from the list above');
  }

  const s = await call('https://api.vapi.ai/structured-output?limit=100', { headers: auth });
  if (s.status !== 200) return warn(`structured-output list ${s.status}`);
  const items = Array.isArray(s.body) ? s.body : s.body.results ?? [];
  info('structured outputs:');
  for (const x of items) info(`  ${x.id}  "${x.name ?? ''}"`);
  const summary = items.filter((x) => /summary/i.test(x.name ?? ''));
  const pick = summary.length === 1 ? summary[0] : items.length === 1 ? items[0] : null;
  if (pick) { ok(`structured output: ${pick.id} ("${pick.name}")`); updates.VAPI_STRUCTURED_OUTPUT_ID = pick.id; }
  else if (!items.length) warn('none exist — create the call-summary structured output in Vapi first');
  else warn('several candidates — set VAPI_STRUCTURED_OUTPUT_ID manually from the list above');
}

// ── 3. Vobiz: REST credential check ─────────────────────────────────────────
async function vobiz() {
  console.log('\nVobiz — VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN vs SIP username/password');
  const same = env.VOBIZ_AUTH_ID === env.VOBIZ_AUTH_USERNAME && env.VOBIZ_AUTH_TOKEN === env.VOBIZ_AUTH_PASSWORD;
  if (same) warn('REST Auth ID/Token are identical to the SIP trunk username/password');
  if (!env.VOBIZ_AUTH_ID || !env.VOBIZ_AUTH_TOKEN) return warn('VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN not set');
  const r = await call(`https://api.vobiz.ai/api/v1/account/${encodeURIComponent(env.VOBIZ_AUTH_ID)}/numbers?limit=1`, {
    headers: { 'X-Auth-ID': env.VOBIZ_AUTH_ID, 'X-Auth-Token': env.VOBIZ_AUTH_TOKEN },
  });
  if (r.status === 200) {
    ok('REST Auth ID/Token are valid (number picker will work)');
    if (same) info('→ so the SIP pair is the one to re-check: Vobiz Console → SIP Trunk → Outbound Trunks → your trunk → Authentication & Linking. Update VOBIZ_AUTH_USERNAME / VOBIZ_AUTH_PASSWORD if they differ.');
  } else if (r.status === 401 || r.status === 403) {
    warn(`REST credentials rejected (${r.status}) — copy Auth ID + Auth Token from the Vobiz Console dashboard into VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN`);
    if (same) info('→ the values currently there are your SIP trunk login; keep those in VOBIZ_AUTH_USERNAME / VOBIZ_AUTH_PASSWORD.');
  } else warn(`Vobiz API returned ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`);
}

if (!VOBIZ_ONLY) { await stripe(); await vapi(); }
await vobiz();

// ── Write ────────────────────────────────────────────────────────────────────
console.log('\nSummary');
if (!Object.keys(updates).length) { info('nothing to write'); process.exit(0); }
for (const [k, v] of Object.entries(updates)) info(`${k}=${v}`);
if (!WRITE) { info('dry run — re-run with --write to save these to .env'); process.exit(0); }
fs.copyFileSync(ENV_PATH, `${ENV_PATH}.bak`);
let out = raw;
for (const [k, v] of Object.entries(updates)) {
  const re = new RegExp(`^\\s*${k}\\s*=.*$`, 'm');
  out = re.test(out) ? out.replace(re, `${k}=${v}`) : `${out.replace(/\n?$/, '\n')}${k}=${v}\n`;
}
fs.writeFileSync(ENV_PATH, out);
ok(`.env updated (backup at .env.bak)`);
