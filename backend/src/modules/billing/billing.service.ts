/**
 * Billing Service — Stripe Checkout + Webhook processing
 *
 * Responsibilities:
 *   - PLAN_LIMITS: single source of truth for per-plan feature limits
 *   - createCheckoutSession: generate a Stripe Checkout URL for plan upgrade
 *   - handleStripeWebhook: process Stripe events and update org plan
 *   - getBillingStatus: return current plan + usage for the billing page
 *   - createTopupCheckout: prepaid extra-minute packs (pricing v2)
 *
 * Plan hierarchy: free → lite (Starter) → starter (Basic) → growth (Standard) → enterprise (Pro)
 * Prices and allowances: ./plan-catalog.ts (pricing v2, 2026-10-08).
 *
 * teamMembers limit = max number of additional Members (non-Owner) that can be
 * invited. Owners are not counted against this limit.
 */

import Stripe from 'stripe';
import { env } from '../../config/env';
import { OrganizationModel, MembershipModel, InvitationModel, type Plan } from '../organization/organization.model';
import { KbDocumentModel } from '../knowledge-base/kb.model';
import { BadRequest, NotFound } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { computeTrialState } from './trial.service';
import { getPremiumVoiceAccess, getPaidPlan, PREMIUM_VOICE_ADDON_PRICE_INR, type PremiumVoiceAccess } from '../agents/voice-pricing';
import { currentMonthMinutesUsed } from '../../utils/callMinutes';
import { validPackBalance, nextPackExpiry } from '../../utils/minutePacks';
import {
  PLAN_CATALOG, TOPUP_PACKS, TOPUP_VALIDITY_DAYS, isPaidPlan, isTopupPackId,
  type BillingInterval, type PaidPlan, type TopupPackId,
} from './plan-catalog';
import { membershipFilter } from '../../utils/requestContext';

// ─── Plan Limits (shared with kb.service + team.service + webhook.service) ────
//
// Source of truth: ./plan-catalog.ts (pricing v2, 2026-10-08 — see
// main-project-docs/Pricing-Redesign-2026-10.md). Internal enum values are kept
// from the old model to avoid a data migration:
//   lite → "Starter" · starter → "Basic" · growth → "Standard" · enterprise → "Pro"
//
// callMinutes: call minutes included per calendar month. Enforced at the
//   assistant-request webhook BEFORE Vapi connects the call. Usage beyond it is
//   covered by prepaid top-up packs (org.minutePacks); with no pack balance the
//   call is forwarded to the org's fallback number or gets a short message.
//   free=60 is an internal fallback for orgs with no plan/trial.
//   Pro was a 3,000-min hard cap with no overage billing (BIZ-04) — now 1,500 + packs.
//
// concurrentCalls: calls the org's agent may handle at the same time (checked
//   at assistant-request against Call records with status 'active').
//
// kbDocs: max knowledge-base documents (each doc ≤50KB).
//
// teamMembers: max additional Members (non-Owner). Owners excluded from count.

export const TRIAL_CALL_MINUTES = 30;

export interface PlanLimits {
  kbDocs:          number;
  teamMembers:     number;
  callMinutes:     number;
  concurrentCalls: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free:       { kbDocs: 5,   teamMembers: 0,        callMinutes: 60,                                       concurrentCalls: 1 },
  lite:       { kbDocs: 25,  teamMembers: 0,        callMinutes: PLAN_CATALOG.lite.includedMinutes,       concurrentCalls: PLAN_CATALOG.lite.concurrentCalls },
  starter:    { kbDocs: 50,  teamMembers: 1,        callMinutes: PLAN_CATALOG.starter.includedMinutes,    concurrentCalls: PLAN_CATALOG.starter.concurrentCalls },
  growth:     { kbDocs: 200, teamMembers: 5,        callMinutes: PLAN_CATALOG.growth.includedMinutes,     concurrentCalls: PLAN_CATALOG.growth.concurrentCalls },
  enterprise: { kbDocs: 500, teamMembers: Infinity, callMinutes: PLAN_CATALOG.enterprise.includedMinutes, concurrentCalls: PLAN_CATALOG.enterprise.concurrentCalls },
};

/**
 * Call-minutes ceiling to apply for a given (plan, isInTrial) pair.
 * During an active trial the org gets the doc's 30-minute trial cap
 * regardless of plan — NOT the full plan allocation.
 */
export function getEffectiveCallMinutesLimit(plan: Plan, isInTrial: boolean): number {
  return isInTrial ? TRIAL_CALL_MINUTES : PLAN_LIMITS[plan].callMinutes;
}

// ─── Plan name → Stripe price ID mapping ──────────────────────────────────────
//
// INR-first strategy: if STRIPE_*_PRICE_ID_INR env vars are set they are used
// exclusively, so Indian customers are billed in ₹ (the currency is embedded in
// the Stripe Price object — no `currency` param needed on the session).
// If the INR variants are absent, we fall back to the primary price IDs.

const MONTHLY_PRICE_ENV: Record<PaidPlan, () => string | undefined> = {
  lite:       () => env.STRIPE_LITE_PRICE_ID_INR,
  starter:    () => env.STRIPE_STARTER_PRICE_ID_INR ?? env.STRIPE_STARTER_PRICE_ID,
  growth:     () => env.STRIPE_GROWTH_PRICE_ID_INR  ?? env.STRIPE_GROWTH_PRICE_ID,
  enterprise: () => env.STRIPE_PRO_PRICE_ID_INR     ?? env.STRIPE_PRO_PRICE_ID,
};

const ANNUAL_PRICE_ENV: Record<PaidPlan, () => string | undefined> = {
  lite:       () => env.STRIPE_LITE_ANNUAL_PRICE_ID_INR,
  starter:    () => env.STRIPE_STARTER_ANNUAL_PRICE_ID_INR,
  growth:     () => env.STRIPE_GROWTH_ANNUAL_PRICE_ID_INR,
  enterprise: () => env.STRIPE_PRO_ANNUAL_PRICE_ID_INR,
};

function getPlanPriceId(plan: PaidPlan, interval: BillingInterval = 'month'): string {
  const id = interval === 'year' ? ANNUAL_PRICE_ENV[plan]() : MONTHLY_PRICE_ENV[plan]();
  if (!id) {
    const label = `${PLAN_CATALOG[plan].name}${interval === 'year' ? ' (annual)' : ''}`;
    throw BadRequest(`${label} plan is not configured`, 'PLAN_NOT_CONFIGURED');
  }
  return id;
}

/** Maps a Stripe price ID back to the plan and billing interval it sells. */
export function getPlanFromPriceId(priceId: string): { plan: PaidPlan; interval: BillingInterval } | null {
  for (const plan of Object.keys(PLAN_CATALOG) as PaidPlan[]) {
    const monthly = MONTHLY_PRICE_ENV[plan]();
    if (monthly && priceId === monthly) return { plan, interval: 'month' };
    const annual = ANNUAL_PRICE_ENV[plan]();
    if (annual && priceId === annual) return { plan, interval: 'year' };
  }
  // Primary (non-INR) fallbacks
  if (priceId === env.STRIPE_STARTER_PRICE_ID) return { plan: 'starter',    interval: 'month' };
  if (priceId === env.STRIPE_GROWTH_PRICE_ID)  return { plan: 'growth',     interval: 'month' };
  if (priceId === env.STRIPE_PRO_PRICE_ID)     return { plan: 'enterprise', interval: 'month' };
  return null;
}

/** One-time setup-fee price for a plan, or null when the plan is self-serve or the price is not configured. */
function getSetupFeePriceId(plan: PaidPlan): string | null {
  if (PLAN_CATALOG[plan].setupFeeInr <= 0) return null;
  const id = plan === 'enterprise' ? env.STRIPE_SETUP_MANAGED_PRICE_ID_INR : env.STRIPE_SETUP_GUIDED_PRICE_ID_INR;
  return id ?? null;
}

function getTopupPriceId(pack: TopupPackId): string {
  const id = pack === 'topup_100' ? env.STRIPE_TOPUP_100_PRICE_ID_INR : env.STRIPE_TOPUP_500_PRICE_ID_INR;
  if (!id) throw BadRequest('Top-up packs are not configured yet', 'TOPUP_NOT_CONFIGURED');
  return id;
}

// ─── Premium-voices add-on (separate Stripe subscription) ─────────────────────
//
// Pro includes premium voices. Starter, Basic and Standard can buy them as a monthly
// add-on; each plan has its own add-on price (agents/voice-pricing.ts).
// The add-on is its own subscription so it can be cancelled independently —
// and its webhook events must NEVER change `plan` (see isAddonSubscription).

export const PREMIUM_VOICES_ADDON = 'premium_voices';

function getAddonPriceId(plan: Plan): string {
  const id =
    plan === 'lite' ? env.STRIPE_PREMIUM_VOICES_LITE_PRICE_ID_INR
      : plan === 'starter' ? env.STRIPE_PREMIUM_VOICES_BASIC_PRICE_ID_INR
        : plan === 'growth' ? env.STRIPE_PREMIUM_VOICES_STANDARD_PRICE_ID_INR
          : undefined;
  if (!id) throw BadRequest('The Premium Voices add-on is not configured for this plan', 'ADDON_NOT_CONFIGURED');
  return id;
}

function isAddonPriceId(priceId: string | undefined): boolean {
  return !!priceId && (
    priceId === env.STRIPE_PREMIUM_VOICES_LITE_PRICE_ID_INR ||
    priceId === env.STRIPE_PREMIUM_VOICES_BASIC_PRICE_ID_INR ||
    priceId === env.STRIPE_PREMIUM_VOICES_STANDARD_PRICE_ID_INR
  );
}

/** True for the add-on subscription (by metadata, price, or the stored subscription ID). */
export function isAddonSubscription(
  sub: Pick<Stripe.Subscription, 'id' | 'metadata'> & { items?: { data?: Array<{ price?: { id?: string } }> } },
  storedAddonSubscriptionId?: string,
): boolean {
  if (sub.metadata?.addon === PREMIUM_VOICES_ADDON) return true;
  if (storedAddonSubscriptionId && sub.id === storedAddonSubscriptionId) return true;
  return (sub.items?.data ?? []).some((item) => isAddonPriceId(item.price?.id));
}

/** Re-checks the org's agent voice after an entitlement change (lazy import avoids a load-order cycle). */
async function enforceVoiceAccessSafe(orgId: string): Promise<void> {
  try {
    const { enforceVoiceAccess } = await import('../agents/agent.service');
    await enforceVoiceAccess(orgId);
  } catch (err) {
    logger.error('enforceVoiceAccess failed after billing change', {
      orgId, error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Stripe Checkout for the Premium Voices add-on. Owner-only.
 * Allowed on paid Starter / Basic / Standard when the add-on is not already active.
 */
export async function createPremiumVoiceAddonCheckout(userId: string): Promise<{ url: string }> {
  const { org, orgId } = await resolveOwnerOrgForBilling(userId);
  const access = getPremiumVoiceAccess(org as unknown as Parameters<typeof getPremiumVoiceAccess>[0]);

  if (access.includedInPlan) throw BadRequest('Premium voices are already included in your plan', 'ADDON_INCLUDED');
  if (access.addonActive)    throw BadRequest('The Premium Voices add-on is already active', 'ADDON_ACTIVE');
  if (!access.addonEligible) {
    throw BadRequest('Choose a paid Starter, Basic or Standard plan first — the add-on is not sold on the free trial', 'ADDON_NOT_ELIGIBLE');
  }

  const paidPlan = getPaidPlan(org as unknown as Parameters<typeof getPaidPlan>[0]);
  const priceId  = getAddonPriceId(paidPlan);
  const stripe   = getStripe();
  const metadata = { organizationId: orgId, addon: PREMIUM_VOICES_ADDON };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode:              'subscription',
    line_items:        [{ price: priceId, quantity: 1 }],
    success_url:       `${env.CLIENT_URL}/billing?addon=premium_voices`,
    cancel_url:        `${env.CLIENT_URL}/billing?cancelled=true`,
    metadata,
    subscription_data: { metadata },
  };
  const customerId = (org as unknown as { stripeCustomerId?: string }).stripeCustomerId;
  if (customerId) params.customer = customerId;

  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error('Stripe did not return a checkout URL');

  logger.info('Premium voices add-on checkout created', { orgId, plan: paidPlan, sessionId: session.id });
  return { url: session.url };
}

/** Cancels a now-redundant add-on (e.g. after upgrading to Pro), prorated. Never throws. */
async function cancelRedundantAddon(orgId: string, addonSubscriptionId: string | undefined): Promise<void> {
  if (!addonSubscriptionId) return;
  try {
    await getStripe().subscriptions.cancel(addonSubscriptionId, { prorate: true });
    logger.info('Cancelled Premium Voices add-on — now included in Pro', { orgId, addonSubscriptionId });
  } catch (err) {
    logger.error('Could not cancel redundant Premium Voices add-on — cancel it in Stripe', {
      orgId, addonSubscriptionId, error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Stripe client ────────────────────────────────────────────────────────────
// No module-level singleton — a fresh instance is created on each call so that
// Vitest's vi.mock('stripe', ...) properly intercepts every new Stripe(...).

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw BadRequest('Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' });
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function resolveOwnerOrgForBilling(userId: string) {
  const membership = await MembershipModel
    .findOne(membershipFilter(userId, { role: 'Owner' as const }))
    .populate<{ organizationId: InstanceType<typeof OrganizationModel> }>('organizationId')
    .lean();

  if (!membership) throw NotFound('Organization');

  const org = membership.organizationId as typeof membership.organizationId & { _id: string };
  return { org, orgId: org._id.toString() };
}

// ─── createCheckoutSession ────────────────────────────────────────────────────

const PAID_PLAN_IDS = Object.keys(PLAN_CATALOG) as PaidPlan[];

/**
 * Creates a Stripe Checkout session for a paid plan — `lite`, `starter`,
 * `growth` or `enterprise` (Starter, Basic, Standard, Pro) — billed monthly or
 * annually. Monthly checkouts add the plan's one-time setup fee the first time
 * (Basic/Standard ₹4,999, Pro ₹14,999); annual checkouts waive it.
 * Returns the Stripe Checkout URL for redirect.
 */
export async function createCheckoutSession(
  userId: string,
  targetPlan: string,
  interval: string = 'month',
): Promise<{ url: string }> {
  if (!targetPlan || !isPaidPlan(targetPlan)) {
    throw BadRequest(`Plan must be one of: ${PAID_PLAN_IDS.join(', ')}`, 'INVALID_PLAN');
  }
  if (interval !== 'month' && interval !== 'year') {
    throw BadRequest('Interval must be "month" or "year"', 'INVALID_INTERVAL');
  }

  const stripe = getStripe();
  const { org, orgId } = await resolveOwnerOrgForBilling(userId);

  const priceId = getPlanPriceId(targetPlan, interval);
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: priceId, quantity: 1 }];

  // One-time setup fee: monthly billing only, charged once per org
  const setupFeePaidAt = (org as unknown as { setupFeePaidAt?: Date }).setupFeePaidAt;
  let setupFee = false;
  if (interval === 'month' && !setupFeePaidAt) {
    const setupPriceId = getSetupFeePriceId(targetPlan);
    if (setupPriceId) {
      line_items.push({ price: setupPriceId, quantity: 1 });
      setupFee = true;
    } else if (PLAN_CATALOG[targetPlan].setupFeeInr > 0) {
      logger.warn('Setup-fee price not configured — checkout continues without it', { orgId, targetPlan });
    }
  }

  const successUrl = `${env.CLIENT_URL}/billing?upgraded=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${env.CLIENT_URL}/billing?cancelled=true`;

  const metadata = { organizationId: orgId, plan: targetPlan, interval, setupFee: String(setupFee) };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode:               'subscription',
    line_items,
    success_url:        successUrl,
    cancel_url:         cancelUrl,
    metadata,
    subscription_data:  { metadata: { organizationId: orgId, plan: targetPlan, interval } },
    allow_promotion_codes: true,
  };

  // Re-use existing Stripe customer if the org already has one
  const existingCustomerId = (org as unknown as { stripeCustomerId?: string }).stripeCustomerId;
  if (existingCustomerId) {
    params.customer = existingCustomerId;
  }

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  logger.info('Stripe Checkout session created', { orgId, targetPlan, interval, setupFee, sessionId: session.id });

  return { url: session.url };
}

// ─── createTopupCheckout ──────────────────────────────────────────────────────

/**
 * Stripe Checkout (one-time payment) for a prepaid top-up pack. Owner-only.
 * Sold on paid plans only — not on the free plan or the trial.
 * Pack minutes are added on checkout.session.completed and expire
 * TOPUP_VALIDITY_DAYS after purchase.
 */
export async function createTopupCheckout(userId: string, packId: string): Promise<{ url: string }> {
  if (!isTopupPackId(packId)) {
    throw BadRequest(`Pack must be one of: ${Object.keys(TOPUP_PACKS).join(', ')}`, 'INVALID_TOPUP_PACK');
  }
  const { org, orgId } = await resolveOwnerOrgForBilling(userId);
  const o = org as unknown as { plan?: Plan; planOverride?: Plan; stripeCustomerId?: string };
  const paidPlan = (o.planOverride ?? o.plan) || 'free';
  if (!isPaidPlan(paidPlan)) {
    throw BadRequest('Top-up packs are available on paid plans. Choose a plan first.', 'TOPUP_NOT_ELIGIBLE');
  }

  const pack     = TOPUP_PACKS[packId];
  const priceId  = getTopupPriceId(packId);
  const stripe   = getStripe();
  const metadata = { organizationId: orgId, topupPack: packId, minutes: String(pack.minutes) };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode:            'payment',
    line_items:      [{ price: priceId, quantity: 1 }],
    success_url:     `${env.CLIENT_URL}/billing?topup=${packId}`,
    cancel_url:      `${env.CLIENT_URL}/billing?cancelled=true`,
    metadata,
    payment_intent_data: { metadata },
    invoice_creation:    { enabled: true }, // GST invoice for the pack
  };
  if (o.stripeCustomerId) params.customer = o.stripeCustomerId;
  else params.customer_creation = 'always';

  const session = await stripe.checkout.sessions.create(params);
  if (!session.url) throw new Error('Stripe did not return a checkout URL');

  logger.info('Top-up checkout created', { orgId, packId, sessionId: session.id });
  return { url: session.url };
}

/** Credits a paid top-up pack to the org. Idempotent per Checkout session. */
export async function creditTopupPack(
  orgId: string,
  packId: TopupPackId,
  stripeSessionId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const pack = TOPUP_PACKS[packId];
  const expiresAt = new Date(now.getTime() + TOPUP_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const res = await OrganizationModel.updateOne(
    { _id: orgId, 'minutePacks.stripeSessionId': { $ne: stripeSessionId } },
    {
      $push: {
        minutePacks: {
          packId, minutes: pack.minutes, remaining: pack.minutes,
          purchasedAt: now, expiresAt, stripeSessionId,
        },
      },
    },
  );
  return res.modifiedCount === 1;
}

/** Credits a paid top-up Checkout session and stores the Stripe customer if missing. */
async function handlePaidTopupSession(session: Stripe.Checkout.Session): Promise<void> {
  const orgId  = session.metadata?.organizationId;
  const packId = session.metadata?.topupPack;
  if (!orgId || !isTopupPackId(packId)) return;
  const credited = await creditTopupPack(orgId, packId, session.id);
  if (session.customer) {
    await OrganizationModel.updateOne(
      { _id: orgId, stripeCustomerId: { $exists: false } },
      { $set: { stripeCustomerId: String(session.customer) } },
    );
  }
  logger.info('Top-up pack credited', { orgId, packId, credited, sessionId: session.id });
}

// ─── handleStripeWebhook ──────────────────────────────────────────────────────

/**
 * Verifies Stripe webhook signature and processes events.
 *
 * Handles:
 *   checkout.session.completed       → set plan + interval + setup-fee flag + stripeCustomerId;
 *                                      top-up pack → credit minutes; add-on → flag
 *   checkout.session.async_payment_succeeded → credit a top-up paid by a delayed method
 *   customer.subscription.updated    → update plan/interval if price changed
 *   customer.subscription.deleted    → downgrade to 'free'
 */
export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<{ received: boolean }> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
    return { received: true };
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    logger.warn('Stripe webhook signature verification failed', { msg });
    throw BadRequest(`Webhook signature verification failed: ${msg}`, 'INVALID_STRIPE_SIGNATURE');
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId   = session.metadata?.organizationId;
      const plan    = session.metadata?.plan as Plan | undefined;

      // Top-up pack (one-time payment) — adds minutes, never touches `plan`.
      // Delayed methods (e.g. some UPI flows) arrive unpaid here and are credited
      // on checkout.session.async_payment_succeeded instead.
      if (orgId && isTopupPackId(session.metadata?.topupPack)) {
        if (session.payment_status === 'paid') await handlePaidTopupSession(session);
        else logger.info('Top-up checkout completed, payment pending', { orgId, sessionId: session.id });
        break;
      }

      // Premium Voices add-on purchase — never touches `plan`
      if (orgId && session.metadata?.addon === PREMIUM_VOICES_ADDON) {
        await OrganizationModel.findByIdAndUpdate(orgId, {
          $set: {
            premiumVoiceAddon: true,
            ...(session.subscription ? { premiumVoiceAddonSubscriptionId: String(session.subscription) } : {}),
            ...(session.customer     ? { stripeCustomerId: String(session.customer) }                  : {}),
          },
        });
        logger.info('Premium Voices add-on activated', { orgId });
        break;
      }

      if (!orgId || !plan) {
        logger.warn('checkout.session.completed missing metadata', { sessionId: session.id });
        break;
      }

      const interval: BillingInterval = session.metadata?.interval === 'year' ? 'year' : 'month';
      await OrganizationModel.findByIdAndUpdate(orgId, {
        $set: {
          plan,
          billingInterval: interval,
          ...(session.metadata?.setupFee === 'true' ? { setupFeePaidAt: new Date() } : {}),
          ...(session.customer         ? { stripeCustomerId:     String(session.customer)         } : {}),
          ...(session.subscription     ? { stripeSubscriptionId: String(session.subscription)     } : {}),
          ...(session.metadata?.priceId ? { stripePriceId:        session.metadata.priceId }        : {}),
        },
      });

      logger.info('Org plan upgraded via checkout', { orgId, plan });

      // Pro includes premium voices — stop charging for the add-on
      if (plan === 'enterprise') {
        const updatedOrg = await OrganizationModel.findById(orgId).select('premiumVoiceAddonSubscriptionId').lean();
        await cancelRedundantAddon(orgId, updatedOrg?.premiumVoiceAddonSubscriptionId);
      }
      await enforceVoiceAccessSafe(orgId);
      break;
    }

    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (isTopupPackId(session.metadata?.topupPack)) await handlePaidTopupSession(session);
      break;
    }

    case 'customer.subscription.updated': {
      const sub         = event.data.object as Stripe.Subscription;
      const customerId  = String(sub.customer);
      const priceId     = sub.items.data[0]?.price.id;

      const org = await OrganizationModel.findOne({ stripeCustomerId: customerId });
      if (!org) {
        logger.warn('No org found for customer on subscription.updated', { customerId });
        break;
      }

      // Add-on subscription: only its own flag changes (never `plan`)
      if (isAddonSubscription(sub, org.premiumVoiceAddonSubscriptionId)) {
        const active = ['active', 'trialing', 'past_due'].includes(sub.status);
        await OrganizationModel.findByIdAndUpdate(org._id, {
          $set: { premiumVoiceAddon: active, premiumVoiceAddonSubscriptionId: sub.id },
        });
        if (!active) await enforceVoiceAccessSafe(org._id.toString());
        logger.info('Premium Voices add-on status updated', { orgId: org._id.toString(), status: sub.status });
        break;
      }

      const mapped  = priceId ? getPlanFromPriceId(priceId) : null;
      const newPlan = mapped?.plan ?? null;
      if (mapped && newPlan) {
        await OrganizationModel.findByIdAndUpdate(org._id, {
          $set: {
            plan:                 newPlan,
            billingInterval:      mapped.interval,
            stripeSubscriptionId: sub.id,
            stripePriceId:        priceId,
          },
        });
        logger.info('Org plan updated via subscription.updated', {
          orgId: org._id.toString(), newPlan,
        });
        if (newPlan === 'enterprise') await cancelRedundantAddon(org._id.toString(), org.premiumVoiceAddonSubscriptionId);
        await enforceVoiceAccessSafe(org._id.toString());
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub        = event.data.object as Stripe.Subscription;
      const customerId = String(sub.customer);

      const org = await OrganizationModel.findOne({ stripeCustomerId: customerId });
      if (!org) {
        logger.warn('No org found for customer on subscription.deleted', { customerId });
        break;
      }

      // Cancelling the add-on must NOT downgrade the plan (this handler used to
      // set plan 'free' for any deleted subscription of the customer).
      if (isAddonSubscription(sub, org.premiumVoiceAddonSubscriptionId)) {
        await OrganizationModel.findByIdAndUpdate(org._id, {
          $set:   { premiumVoiceAddon: false },
          $unset: { premiumVoiceAddonSubscriptionId: '' },
        });
        await enforceVoiceAccessSafe(org._id.toString());
        logger.info('Premium Voices add-on cancelled', { orgId: org._id.toString() });
        break;
      }

      await OrganizationModel.findByIdAndUpdate(org._id, {
        $set:   { plan: 'free' },
        $unset: { stripeSubscriptionId: '', stripePriceId: '', billingInterval: '' },
      });

      logger.info('Org downgraded to free on subscription.deleted', {
        orgId: org._id.toString(),
      });
      await enforceVoiceAccessSafe(org._id.toString());
      break;
    }

    default:
      // Unknown / unhandled event — acknowledge receipt
      break;
  }

  return { received: true };
}

// ─── createPortalSession ──────────────────────────────────────────────────────

/**
 * Creates a Stripe Customer Portal session so the org Owner can manage their
 * subscription, update payment methods, download invoices, and cancel — without
 * involving support.
 *
 * Pre-requisite: the Stripe Customer Portal must be configured in the Stripe
 * Dashboard (Customers → Customer portal → Activate portal).
 *
 * Returns the one-time portal URL to redirect the browser to.
 * The URL is valid for a short window (~5 minutes) and is single-use.
 */
export async function createPortalSession(userId: string): Promise<{ url: string }> {
  const { org, orgId } = await resolveOwnerOrgForBilling(userId);

  const orgData = org as unknown as { stripeCustomerId?: string };

  if (!orgData.stripeCustomerId) {
    throw BadRequest(
      'No active subscription found. Please upgrade to a paid plan first.',
      'NO_STRIPE_CUSTOMER',
    );
  }

  const stripe = getStripe();
  const returnUrl = `${env.CLIENT_URL}/billing`;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   orgData.stripeCustomerId,
    return_url: returnUrl,
  });

  logger.info('Stripe Customer Portal session created', {
    orgId,
    customerId: orgData.stripeCustomerId,
    sessionId:  portalSession.id,
  });

  return { url: portalSession.url };
}

// ─── getBillingStatus ─────────────────────────────────────────────────────────

export interface BillingStatus {
  plan:            Plan;
  /** The plan that governs feature access. Equals `plan` except during an active trial, where it's 'starter' (Basic feature set) — call-minutes are further capped to TRIAL_CALL_MINUTES regardless. */
  effectivePlan:   Plan;
  kbDocs:          { used: number; limit: number | null };
  teamMembers:     { used: number; limit: number | null };
  /** Monthly call-minute quota (plan allowance). limit=null means unlimited. resetAt = ISO string of next reset. */
  callMinutes:     { used: number; limit: number | null; resetAt: string };
  /** Prepaid top-up minutes left (unexpired packs), used after the plan allowance. */
  topupMinutes:    { balance: number; nextExpiry: string | null; canBuy: boolean };
  /** Calls the agent may handle at the same time on this plan. */
  concurrentCalls: number;
  /** Billing period of the current plan subscription (null on free / trial). */
  billingInterval: BillingInterval | null;
  /** True once the one-time setup fee has been paid. */
  setupFeePaid:    boolean;
  stripeCustomerId: string | null;
  // ── Trial ─────────────────────────────────────────────────────────
  isInTrial:       boolean;
  isTrialExpired:  boolean;
  trialDaysLeft:   number;
  trialEndsAt:     string | null;  // ISO string for JSON serialisation
  /** Whether premium voices (ElevenLabs, PlayHT, Azure, Cartesia) can be used right now */
  premiumVoices:   boolean;
  /** Premium Voices add-on state + price for the current plan — see agents/voice-pricing.ts */
  premiumVoiceAddon: PremiumVoiceAccess & {
    /** Display prices for every plan that sells the add-on (₹/month + GST) */
    pricesInr: { lite: number; starter: number; growth: number };
  };
}

/**
 * Returns the current billing plan + feature usage counts + trial state.
 * Available to the org Owner only.
 */
export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const { org, orgId } = await resolveOwnerOrgForBilling(userId);

  // org is typed loosely from the lean query, access plan with fallback
  type OrgExtra = {
    plan?:               Plan;
    stripeCustomerId?:   string;
    trialUsed?:          boolean;
    trialEndsAt?:        Date;
    callMinutesUsed?:    number;
    callMinutesResetAt?: Date;
    planOverride?:       Plan;
    billingInterval?:    BillingInterval;
    setupFeePaidAt?:     Date;
    minutePacks?:        Array<{ remaining: number; expiresAt: Date; stripeSessionId: string }>;
  };
  const orgData = org as unknown as OrgExtra;

  const plan: Plan = orgData.plan ?? 'free';

  // Compute trial state
  const trial = computeTrialState(plan, orgData.trialUsed ?? false, orgData.trialEndsAt);

  // During an active trial, treat the org as starter-level (Basic feature set)
  // for feature access; call-minutes get the separate 30-min trial cap below.
  const effectivePlan: Plan = trial.isInTrial ? 'starter' : plan;
  const limits = PLAN_LIMITS[effectivePlan];
  const callMinutesLimit = getEffectiveCallMinutesLimit(plan, trial.isInTrial);

  const [kbDocsUsed, membersUsed, pendingInvites] = await Promise.all([
    KbDocumentModel.countDocuments({ organizationId: orgId }),
    MembershipModel.countDocuments({ organizationId: orgId, role: 'Member' }),
    InvitationModel.countDocuments({ organizationId: orgId, expiresAt: { $gt: new Date() } }),
  ]);

  // ── Compute next reset date: 1st of following month UTC ────────────────────
  const now   = new Date();
  const voiceAccess = getPremiumVoiceAccess(org as unknown as Parameters<typeof getPremiumVoiceAccess>[0]);

  const nextResetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    plan,
    effectivePlan,
    kbDocs: {
      used:  kbDocsUsed,
      limit: limits.kbDocs === Infinity ? null : limits.kbDocs,
    },
    teamMembers: {
      used:  membersUsed + pendingInvites,
      limit: limits.teamMembers === Infinity ? null : limits.teamMembers,
    },
    callMinutes: {
      used:    currentMonthMinutesUsed(orgData, now), // BIZ-01
      limit:   callMinutesLimit === Infinity ? null : callMinutesLimit,
      resetAt: nextResetAt.toISOString(),
    },
    topupMinutes: {
      balance:    validPackBalance(orgData.minutePacks, now),
      nextExpiry: nextPackExpiry(orgData.minutePacks, now)?.toISOString() ?? null,
      canBuy:     isPaidPlan(orgData.planOverride ?? plan),
    },
    concurrentCalls: limits.concurrentCalls,
    billingInterval: isPaidPlan(plan) ? (orgData.billingInterval ?? 'month') : null,
    setupFeePaid:    !!orgData.setupFeePaidAt,
    stripeCustomerId: orgData.stripeCustomerId ?? null,
    isInTrial:        trial.isInTrial,
    isTrialExpired:   trial.isTrialExpired,
    trialDaysLeft:    trial.trialDaysLeft,
    trialEndsAt:      trial.trialEndsAt?.toISOString() ?? null,
    // Same rule the agent service enforces (planOverride + add-on aware)
    premiumVoices:     voiceAccess.allowed,
    premiumVoiceAddon: {
      ...voiceAccess,
      pricesInr: {
        lite:    PREMIUM_VOICE_ADDON_PRICE_INR.lite ?? 0,
        starter: PREMIUM_VOICE_ADDON_PRICE_INR.starter ?? 0,
        growth:  PREMIUM_VOICE_ADDON_PRICE_INR.growth ?? 0,
      },
    },
  };
}
