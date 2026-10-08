/**
 * Create the Stripe product + 2 monthly INR prices for the Premium Voices add-on
 * (pricing doc § 11, gap COST-07). Safe to re-run: it finds existing objects by
 * lookup_key / metadata instead of creating duplicates.
 *
 * Dry run by default — shows what it would create and changes nothing.
 *
 * Usage (from backend/), with the SAME Stripe key mode Render uses (sk_test_ or sk_live_):
 *   npx tsx scripts/create-premium-voice-prices.ts            # dry run
 *   npx tsx scripts/create-premium-voice-prices.ts --apply    # create
 *   STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/create-premium-voice-prices.ts --apply
 *
 * Then set the two printed IDs on Render:
 *   STRIPE_PREMIUM_VOICES_BASIC_PRICE_ID_INR, STRIPE_PREMIUM_VOICES_STANDARD_PRICE_ID_INR
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
dotenv.config();

const APPLY = process.argv.includes('--apply');
const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('❌  STRIPE_SECRET_KEY must be set (backend/.env or inline)');
  process.exit(1);
}
const stripe = new Stripe(KEY, { apiVersion: '2026-06-24.dahlia' });
const MODE = KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';

const PRODUCT_TAG = 'premium_voices';
const PRICES = [
  { env: 'STRIPE_PREMIUM_VOICES_BASIC_PRICE_ID_INR',    lookupKey: 'premium_voices_basic_inr_monthly',    plan: 'basic',    rupees: 2999 },
  { env: 'STRIPE_PREMIUM_VOICES_STANDARD_PRICE_ID_INR', lookupKey: 'premium_voices_standard_inr_monthly', plan: 'standard', rupees: 4999 },
] as const;

async function findOrCreateProduct(): Promise<string | null> {
  const found = await stripe.products.search({ query: `metadata['addon']:'${PRODUCT_TAG}' AND active:'true'` });
  if (found.data[0]) {
    console.log(`✓ Product exists: ${found.data[0].id} (${found.data[0].name})`);
    return found.data[0].id;
  }
  if (!APPLY) { console.log('+ Would create product "Premium Voices Add-on"'); return null; }
  const p = await stripe.products.create({
    name: 'Premium Voices Add-on',
    description: 'ElevenLabs, Azure, PlayHT and Cartesia voices for your AI receptionist. Included on Pro.',
    metadata: { addon: PRODUCT_TAG },
  });
  console.log(`+ Created product ${p.id}`);
  return p.id;
}

async function run() {
  console.log(`Stripe ${MODE} mode — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);
  const productId = await findOrCreateProduct();
  const out: string[] = [];

  for (const p of PRICES) {
    const existing = await stripe.prices.list({ lookup_keys: [p.lookupKey], active: true, limit: 1 });
    if (existing.data[0]) {
      const e = existing.data[0];
      const ok = e.unit_amount === p.rupees * 100 && e.currency === 'inr' && e.recurring?.interval === 'month';
      console.log(`✓ Price exists for ${p.plan}: ${e.id} ${ok ? '' : '⚠️  amount/currency/interval differ — check in Stripe'}`);
      out.push(`${p.env}=${e.id}`);
      continue;
    }
    if (!APPLY || !productId) { console.log(`+ Would create ₹${p.rupees}/month (${p.plan}, tax-exclusive)`); continue; }
    const price = await stripe.prices.create({
      product: productId,
      currency: 'inr',
      unit_amount: p.rupees * 100,
      recurring: { interval: 'month' },
      tax_behavior: 'exclusive',
      lookup_key: p.lookupKey,
      nickname: `Premium Voices — ${p.plan} (₹${p.rupees}/mo)`,
      metadata: { addon: PRODUCT_TAG, plan: p.plan },
    });
    console.log(`+ Created ₹${p.rupees}/month for ${p.plan}: ${price.id}`);
    out.push(`${p.env}=${price.id}`);
  }

  // Customer Portal: customers must be able to cancel the add-on themselves.
  const configs = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
  const cancel = configs.data[0]?.features.subscription_cancel?.enabled;
  console.log(
    configs.data[0]
      ? `\n${cancel ? '✓' : '⚠️ '} Customer Portal "cancel subscriptions" is ${cancel ? 'ON' : 'OFF — turn it on: Settings → Billing → Customer portal'}`
      : '\n⚠️  No Customer Portal configuration yet — activate it: Settings → Billing → Customer portal',
  );

  if (out.length) console.log(`\nSet these on Render (Environment), then redeploy:\n${out.join('\n')}`);
  if (!APPLY) console.log('\nDry run only. Re-run with --apply to create.');
}

run().catch((err) => { console.error('❌ ', err instanceof Error ? err.message : err); process.exit(1); });
