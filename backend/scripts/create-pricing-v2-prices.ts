/**
 * Create the Stripe products + INR prices for pricing v2 (2026-10-08).
 * Source: src/modules/billing/plan-catalog.ts · main-project-docs/Pricing-Redesign-2026-10.md
 *
 * Creates (all INR, tax-exclusive — GST is added on top):
 *   Plans, monthly + annual: Starter ₹4,999 / ₹49,990 · Basic ₹9,999 / ₹99,990 ·
 *                            Standard ₹17,999 / ₹1,79,990 · Pro ₹29,999 / ₹2,99,990
 *   Setup fees (one-time):   Guided ₹4,999 (Basic, Standard) · Managed ₹14,999 (Pro)
 *   Top-up packs (one-time): 100 min ₹2,000 · 500 min ₹9,000
 *   Premium Voices add-on on Starter: ₹1,499 / month
 *     (Basic ₹2,999 and Standard ₹4,999 come from scripts/create-premium-voice-prices.ts)
 *
 * Safe to re-run: finds existing prices by lookup_key and products by metadata.
 * Existing monthly Basic/Standard prices (₹9,999 / ₹17,999) are reused if their
 * IDs are already in STRIPE_STARTER_PRICE_ID_INR / STRIPE_GROWTH_PRICE_ID_INR and
 * the amount matches. Pro moves from ₹25,999 to ₹29,999, so it always gets a
 * new price — set the printed STRIPE_PRO_PRICE_ID_INR on Render.
 *
 * Dry run by default — shows what it would create and changes nothing.
 *
 * Usage (from backend/), with the SAME Stripe key mode Render uses (sk_test_ or sk_live_):
 *   npx tsx scripts/create-pricing-v2-prices.ts            # dry run
 *   npx tsx scripts/create-pricing-v2-prices.ts --apply    # create
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
dotenv.config();

import { PLAN_CATALOG, TOPUP_PACKS, type PaidPlan } from '../src/modules/billing/plan-catalog';

const APPLY = process.argv.includes('--apply');
const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('❌  STRIPE_SECRET_KEY must be set (backend/.env or inline)');
  process.exit(1);
}
const stripe = new Stripe(KEY, { apiVersion: '2026-06-24.dahlia' });
const MODE = KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';

type Interval = 'month' | 'year' | null;
interface PriceSpec {
  env:        string;
  lookupKey:  string;
  product:    string;            // product tag (metadata.pricing_v2)
  rupees:     number;
  interval:   Interval;          // null = one-time
  nickname:   string;
  /** Existing price ID to reuse if its amount matches */
  reuseEnv?:  string;
}

const PRODUCTS: Record<string, { name: string; description: string }> = {
  plan_lite:       { name: 'AgentOps Studio — Starter',  description: '200 call minutes / month, 1 simultaneous call' },
  plan_starter:    { name: 'AgentOps Studio — Basic',    description: '500 call minutes / month, 2 simultaneous calls' },
  plan_growth:     { name: 'AgentOps Studio — Standard', description: '1,000 call minutes / month, 3 simultaneous calls' },
  plan_enterprise: { name: 'AgentOps Studio — Pro',      description: '1,500 call minutes / month, 5 simultaneous calls, premium voices' },
  setup:           { name: 'AgentOps Studio — Setup & Onboarding', description: 'One-time setup fee (monthly billing only)' },
  topup:           { name: 'AgentOps Studio — Top-up minutes',     description: 'Prepaid call minutes, valid 90 days' },
  premium_lite:    { name: 'Premium Voices Add-on (Starter)',      description: 'ElevenLabs, Azure, PlayHT voices on the Starter plan' },
};

const ENV_PREFIX: Record<PaidPlan, string> = { lite: 'LITE', starter: 'STARTER', growth: 'GROWTH', enterprise: 'PRO' };

const SPECS: PriceSpec[] = [
  ...(Object.keys(PLAN_CATALOG) as PaidPlan[]).flatMap((plan): PriceSpec[] => {
    const def = PLAN_CATALOG[plan];
    return [
      {
        env: `STRIPE_${ENV_PREFIX[plan]}_PRICE_ID_INR`, lookupKey: `plan_${plan}_inr_monthly_v2`, product: `plan_${plan}`,
        rupees: def.monthlyInr, interval: 'month', nickname: `${def.name} — ₹${def.monthlyInr}/mo`,
        reuseEnv: plan === 'starter' || plan === 'growth' ? `STRIPE_${ENV_PREFIX[plan]}_PRICE_ID_INR` : undefined,
      },
      {
        env: `STRIPE_${ENV_PREFIX[plan]}_ANNUAL_PRICE_ID_INR`, lookupKey: `plan_${plan}_inr_yearly_v2`, product: `plan_${plan}`,
        rupees: def.annualInr, interval: 'year', nickname: `${def.name} — ₹${def.annualInr}/yr`,
      },
    ];
  }),
  { env: 'STRIPE_SETUP_GUIDED_PRICE_ID_INR',  lookupKey: 'setup_guided_inr_v2',  product: 'setup', rupees: PLAN_CATALOG.starter.setupFeeInr,    interval: null, nickname: 'Guided setup (Basic, Standard)' },
  { env: 'STRIPE_SETUP_MANAGED_PRICE_ID_INR', lookupKey: 'setup_managed_inr_v2', product: 'setup', rupees: PLAN_CATALOG.enterprise.setupFeeInr, interval: null, nickname: 'Managed setup (Pro)' },
  { env: 'STRIPE_TOPUP_100_PRICE_ID_INR', lookupKey: 'topup_100_inr_v2', product: 'topup', rupees: TOPUP_PACKS.topup_100.priceInr, interval: null, nickname: '100 top-up minutes' },
  { env: 'STRIPE_TOPUP_500_PRICE_ID_INR', lookupKey: 'topup_500_inr_v2', product: 'topup', rupees: TOPUP_PACKS.topup_500.priceInr, interval: null, nickname: '500 top-up minutes' },
  { env: 'STRIPE_PREMIUM_VOICES_LITE_PRICE_ID_INR', lookupKey: 'premium_voices_lite_inr_monthly', product: 'premium_lite',
    rupees: PLAN_CATALOG.lite.premiumVoiceAddonInr ?? 0, interval: 'month', nickname: 'Premium Voices — Starter' },
];

const productIds = new Map<string, string>();

async function findOrCreateProduct(tag: string): Promise<string | null> {
  if (productIds.has(tag)) return APPLY ? productIds.get(tag)! : null;
  const found = await stripe.products.search({ query: `metadata['pricing_v2']:'${tag}' AND active:'true'` });
  if (found.data[0]) { productIds.set(tag, found.data[0].id); return found.data[0].id; }
  if (!APPLY) {
    console.log(`+ Would create product "${PRODUCTS[tag].name}"`);
    productIds.set(tag, `(new ${tag})`); // print each product once in a dry run
    return null;
  }
  const meta: Record<string, string> = { pricing_v2: tag };
  if (tag === 'premium_lite') meta.addon = 'premium_voices';
  const p = await stripe.products.create({ name: PRODUCTS[tag].name, description: PRODUCTS[tag].description, metadata: meta });
  console.log(`+ Created product ${p.id} (${p.name})`);
  productIds.set(tag, p.id);
  return p.id;
}

function matches(price: Stripe.Price, spec: PriceSpec): boolean {
  return price.unit_amount === spec.rupees * 100
    && price.currency === 'inr'
    && (spec.interval ? price.recurring?.interval === spec.interval : !price.recurring);
}

async function run() {
  console.log(`Stripe ${MODE} mode — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);
  const out: string[] = [];

  for (const spec of SPECS) {
    // 1. Reuse an existing configured price (Basic / Standard monthly) when the amount matches
    const reuseId = spec.reuseEnv ? process.env[spec.reuseEnv] : undefined;
    if (reuseId) {
      try {
        const existing = await stripe.prices.retrieve(reuseId);
        if (existing.active && matches(existing, spec)) {
          console.log(`✓ Reusing ${spec.env}: ${existing.id} (₹${spec.rupees})`);
          out.push(`${spec.env}=${existing.id}`);
          continue;
        }
      } catch { /* not found in this mode — create below */ }
    }

    // 2. Find by lookup key
    const byKey = await stripe.prices.list({ lookup_keys: [spec.lookupKey], active: true, limit: 1 });
    if (byKey.data[0]) {
      const e = byKey.data[0];
      console.log(`✓ Price exists ${spec.lookupKey}: ${e.id} ${matches(e, spec) ? '' : '⚠️  amount/interval differ — check in Stripe'}`);
      out.push(`${spec.env}=${e.id}`);
      continue;
    }

    // 3. Create
    const productId = await findOrCreateProduct(spec.product);
    if (!APPLY || !productId) {
      console.log(`+ Would create ${spec.nickname}: ₹${spec.rupees}${spec.interval ? `/${spec.interval}` : ' one-time'}`);
      continue;
    }
    const price = await stripe.prices.create({
      product:      productId,
      currency:     'inr',
      unit_amount:  spec.rupees * 100,
      ...(spec.interval ? { recurring: { interval: spec.interval } } : {}),
      tax_behavior: 'exclusive',
      lookup_key:   spec.lookupKey,
      nickname:     spec.nickname,
      metadata:     { pricing_v2: spec.product },
    });
    console.log(`+ Created ${spec.nickname}: ${price.id}`);
    out.push(`${spec.env}=${price.id}`);
  }

  if (out.length) console.log(`\nSet these on Render (Environment), then redeploy:\n${out.join('\n')}`);
  if (!APPLY) console.log('\nDry run only. Re-run with --apply to create.');
  console.log('\nReminder: keep the old ₹25,999 Pro price active until no subscription uses it, then archive it in Stripe.');
}

run().catch((err) => { console.error('❌ ', err instanceof Error ? err.message : err); process.exit(1); });
