/**
 * Make sure the Stripe webhook endpoint for the billing API sends every event
 * the backend handles (billing.service.ts → handleStripeWebhook).
 * Pricing v2 added checkout.session.async_payment_succeeded (top-ups paid by
 * delayed methods such as some UPI flows).
 *
 * Finds endpoints whose URL ends with /api/v1/billing/webhook and adds any
 * missing events. Never removes events. Dry run by default.
 *
 * Usage (from backend/), with the same key mode as the endpoint (sk_test_ / sk_live_):
 *   npx tsx scripts/update-stripe-webhook-events.ts            # dry run
 *   npx tsx scripts/update-stripe-webhook-events.ts --apply    # update
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
dotenv.config();

const APPLY = process.argv.includes('--apply');
const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) { console.error('❌  STRIPE_SECRET_KEY must be set'); process.exit(1); }
const stripe = new Stripe(KEY, { apiVersion: '2026-06-24.dahlia' });

const REQUIRED: Stripe.WebhookEndpointUpdateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

async function run() {
  console.log(`Stripe ${KEY!.startsWith('sk_live_') ? 'LIVE' : 'TEST'} mode — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const ours = endpoints.data.filter((e) => /\/api\/v1\/billing\/webhook\/?$/.test(e.url));
  if (!ours.length) {
    console.log('⚠️  No webhook endpoint ending in /api/v1/billing/webhook in this mode. Existing endpoints:');
    endpoints.data.forEach((e) => console.log(`   ${e.id}  ${e.url}`));
    return;
  }
  for (const e of ours) {
    const current = e.enabled_events as string[];
    if (current.includes('*')) { console.log(`✓ ${e.url} receives all events — nothing to do`); continue; }
    const missing = REQUIRED.filter((ev) => !current.includes(ev));
    if (!missing.length) { console.log(`✓ ${e.url} already has all ${REQUIRED.length} events`); continue; }
    console.log(`${e.url} (${e.id})\n  has:     ${current.join(', ')}\n  missing: ${missing.join(', ')}`);
    if (APPLY) {
      await stripe.webhookEndpoints.update(e.id, {
        enabled_events: [...current, ...missing] as Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
      });
      console.log('  ✓ updated');
    }
  }
  if (!APPLY) console.log('\nDry run only. Re-run with --apply to update.');
}

run().catch((err) => { console.error('❌ ', err instanceof Error ? err.message : err); process.exit(1); });
