/**
 * One-time setup of the shared trial numbers (number automation, 2026-10-08).
 *
 * Trial accounts call out from 2–3 numbers you buy once in Vobiz. This script:
 *   1. reads VOBIZ_TRIAL_NUMBERS (E.164, comma-separated) from backend/.env
 *   2. checks each is owned in Vobiz, usable, and not assigned to any customer org
 *   3. links it to VOBIZ_INBOUND_TRUNK_GROUP_ID (if set and not linked yet)
 *   4. imports it into Vapi (byo-phone-number, shared inbound credential, no
 *      assistant → callbacks hit the assistant-request webhook) unless already there
 *   5. prints VAPI_TRIAL_PHONE_NUMBER_IDS to put on Render
 *
 * Dry run by default. Usage (from backend/):
 *   npx tsx scripts/setup-trial-numbers.ts           # check only
 *   npx tsx scripts/setup-trial-numbers.ts --apply   # link + import
 */
import * as dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const VAPI = 'https://api.vapi.ai';

function need(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`❌  ${name} must be set in backend/.env`); process.exit(1); }
  return v;
}

async function vobiz<T>(method: string, path: string, body?: unknown): Promise<T> {
  const id = need('VOBIZ_AUTH_ID');
  const resp = await fetch(`https://api.vobiz.ai/api/v1/account/${encodeURIComponent(id)}${path}`, {
    method,
    headers: { 'X-Auth-ID': id, 'X-Auth-Token': need('VOBIZ_AUTH_TOKEN'), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!resp.ok) throw new Error(`Vobiz ${resp.status} ${method} ${path}: ${(await resp.text()).slice(0, 200)}`);
  const text = await resp.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function vapi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${VAPI}${path}`, {
    method,
    headers: { Authorization: `Bearer ${need('VAPI_API_KEY')}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!resp.ok) throw new Error(`Vapi ${resp.status} ${method} ${path}: ${(await resp.text()).slice(0, 200)}`);
  return resp.json() as Promise<T>;
}

async function run() {
  const numbers = (process.env.VOBIZ_TRIAL_NUMBERS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (numbers.length === 0) {
    console.error('❌  Set VOBIZ_TRIAL_NUMBERS=+9180XXXXXXXX,+9180YYYYYYYY in backend/.env (numbers you bought in Vobiz)');
    process.exit(1);
  }
  const credentialId = process.env.VOBIZ_VAPI_INBOUND_CREDENTIAL_ID || need('VOBIZ_VAPI_CREDENTIAL_ID');
  const trunk = process.env.VOBIZ_INBOUND_TRUNK_GROUP_ID;
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${numbers.length} trial number(s)\n`);

  await mongoose.connect(need('MONGODB_URI'));
  const orgs = mongoose.connection.collection('organizations');
  const vapiNumbers = await vapi<Array<{ id: string; number?: string }>>('GET', '/phone-number?limit=1000');

  const ids: string[] = [];
  for (const e164 of numbers) {
    console.log(`• ${e164}`);
    const owned = (await vobiz<{ items?: Array<{ e164: string; status?: string; trunk_group_id?: string | null }> }>('GET', `/numbers?search=${encodeURIComponent(e164)}`))
      .items?.find((n) => n.e164 === e164);
    if (!owned) { console.log('  ❌ not in your Vobiz account — buy it first'); continue; }
    if (owned.status && owned.status !== 'active') { console.log(`  ❌ status is ${owned.status}`); continue; }

    const org = await orgs.findOne({ phoneNumber: e164 }, { projection: { name: 1 } });
    if (org) { console.log(`  ❌ assigned to customer org "${org.name}" — pick a different number`); continue; }

    if (trunk && owned.trunk_group_id !== trunk) {
      if (APPLY) { await vobiz('POST', `/numbers/${encodeURIComponent(e164)}/assign`, { trunk_group_id: trunk }); console.log('  ✓ linked to the inbound trunk'); }
      else console.log('  + would link to the inbound trunk');
    } else if (!trunk) {
      console.log('  ⚠️  VOBIZ_INBOUND_TRUNK_GROUP_ID not set — make sure the number is linked to the "Vobiz Inbound" trunk in Vobiz Console');
    }

    const existing = vapiNumbers.find((p) => p.number === e164);
    if (existing) { console.log(`  ✓ already in Vapi: ${existing.id}`); ids.push(existing.id); continue; }
    if (!APPLY) { console.log('  + would import into Vapi'); continue; }
    const created = await vapi<{ id: string }>('POST', '/phone-number', {
      provider: 'byo-phone-number', name: `Trial shared ${e164.slice(-4)}`, number: e164,
      numberE164CheckEnabled: true, credentialId,
    });
    console.log(`  ✓ imported into Vapi: ${created.id}`);
    ids.push(created.id);
  }

  await mongoose.disconnect();
  if (ids.length) {
    console.log(`\nSet these on Render (Environment) and in backend/.env:\nVOBIZ_TRIAL_NUMBERS=${numbers.join(',')}\nVAPI_TRIAL_PHONE_NUMBER_IDS=${ids.join(',')}`);
  }
  if (!APPLY) console.log('\nDry run only. Re-run with --apply.');
}

run().catch(async (err) => { console.error('❌ ', err instanceof Error ? err.message : err); await mongoose.disconnect().catch(() => undefined); process.exit(1); });
