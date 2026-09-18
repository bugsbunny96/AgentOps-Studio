/**
 * Billing Service — Stripe Checkout + Webhook processing
 *
 * Responsibilities:
 *   - PLAN_LIMITS: single source of truth for per-plan feature limits
 *   - createCheckoutSession: generate a Stripe Checkout URL for plan upgrade
 *   - handleStripeWebhook: process Stripe events and update org plan
 *   - getBillingStatus: return current plan + usage for the billing page
 *
 * Plan hierarchy: free → starter → growth → enterprise
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

// ─── Plan Limits (shared with kb.service + team.service + webhook.service) ────
//
// Source of truth: AgentOps Studio — SaaS Pricing & Stripe Setup (2026-09-17)
// Internal enum values (free/starter/growth/enterprise) are unchanged from the
// prior pricing model to avoid a data migration; they map to the doc's
// customer-facing plan names as: starter → "Basic", growth → "Standard",
// enterprise → "Pro". Only the numeric limits below were updated.
//
// callMinutes: max cumulative call-minutes per calendar month.
//   - Enforced at assistant-request webhook BEFORE Vapi connects the call.
//   - free=60       (1 hr — internal-only fallback for orgs with no plan/trial)
//   - starter=500   (Basic: ₹9,999/mo, 500 min, ~125 calls/month @ 4 min avg)
//   - growth=1000   (Standard: ₹17,999/mo, 1,000 min, ~250 calls/month)
//   - enterprise=3000 (Pro: ₹25,999/mo, 1,500 min included; doc specifies a
//     "soft cap with overage billing" up to a 3,000 min fair-use ceiling, but
//     no overage-billing system exists yet — see recharge/overage note in the
//     pricing doc §4/§9 Step 7. Until that's built, 3,000 is enforced as a
//     hard cap (the fair-use ceiling) rather than allowing unbilled overage.)
//
// kbDocs: max knowledge-base documents (not KB size in bytes — each doc ≤50KB).
//   The pricing doc's "Knowledge base: 50 KB / 200 KB / 500 KB" row is treated
//   as matching these existing document-count limits (50/200/500), not a
//   literal byte-size migration — flagged in the implementation report.
//   - free=5, starter=50, growth=200, enterprise=500
//
// teamMembers: max additional Members (non-Owner). Owners excluded from count.
//   Not present in the new pricing doc's package table — left unchanged.
//   - free=0 (solo), starter=1, growth=5, enterprise=∞

export const TRIAL_CALL_MINUTES = 30;

export const PLAN_LIMITS: Record<Plan, { kbDocs: number; teamMembers: number; callMinutes: number }> = {
  free:       { kbDocs: 5,   teamMembers: 0,        callMinutes: 60    },
  starter:    { kbDocs: 50,  teamMembers: 1,        callMinutes: 500   },
  growth:     { kbDocs: 200, teamMembers: 5,        callMinutes: 1_000 },
  enterprise: { kbDocs: 500, teamMembers: Infinity, callMinutes: 3_000 },
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

function getPlanPriceId(plan: 'starter' | 'growth' | 'enterprise'): string {
  if (plan === 'starter') {
    const id = env.STRIPE_STARTER_PRICE_ID_INR ?? env.STRIPE_STARTER_PRICE_ID;
    if (!id) throw BadRequest('Basic plan is not configured');
    return id;
  }
  if (plan === 'growth') {
    const id = env.STRIPE_GROWTH_PRICE_ID_INR ?? env.STRIPE_GROWTH_PRICE_ID;
    if (!id) throw BadRequest('Standard plan is not configured');
    return id;
  }
  const id = env.STRIPE_PRO_PRICE_ID_INR ?? env.STRIPE_PRO_PRICE_ID;
  if (!id) throw BadRequest('Pro plan is not configured');
  return id;
}

function getPlanFromPriceId(priceId: string): Plan | null {
  // Check INR variants first (they are preferred at checkout)
  if (priceId === env.STRIPE_STARTER_PRICE_ID_INR || priceId === env.STRIPE_STARTER_PRICE_ID) return 'starter';
  if (priceId === env.STRIPE_GROWTH_PRICE_ID_INR  || priceId === env.STRIPE_GROWTH_PRICE_ID)  return 'growth';
  if (priceId === env.STRIPE_PRO_PRICE_ID_INR     || priceId === env.STRIPE_PRO_PRICE_ID)     return 'enterprise';
  return null;
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
    .findOne({ userId, role: 'Owner' })
    .populate<{ organizationId: InstanceType<typeof OrganizationModel> }>('organizationId')
    .lean();

  if (!membership) throw NotFound('Organization');

  const org = membership.organizationId as typeof membership.organizationId & { _id: string };
  return { org, orgId: org._id.toString() };
}

// ─── createCheckoutSession ────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout session for upgrading to `starter`, `growth`, or `enterprise`
 * (customer-facing: Basic, Standard, Pro). Returns the Stripe Checkout URL for redirect.
 */
export async function createCheckoutSession(
  userId: string,
  targetPlan: string,
): Promise<{ url: string }> {
  if (!targetPlan || !['starter', 'growth', 'enterprise'].includes(targetPlan)) {
    throw BadRequest('Plan must be "starter", "growth", or "enterprise"', 'INVALID_PLAN');
  }

  const stripe = getStripe();
  const { org, orgId } = await resolveOwnerOrgForBilling(userId);

  const priceId = getPlanPriceId(targetPlan as 'starter' | 'growth' | 'enterprise');

  const successUrl = `${env.CLIENT_URL}/billing?upgraded=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${env.CLIENT_URL}/billing?cancelled=true`;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode:               'subscription',
    line_items:         [{ price: priceId, quantity: 1 }],
    success_url:        successUrl,
    cancel_url:         cancelUrl,
    metadata:           { organizationId: orgId, plan: targetPlan },
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

  logger.info('Stripe Checkout session created', { orgId, targetPlan, sessionId: session.id });

  return { url: session.url };
}

// ─── handleStripeWebhook ──────────────────────────────────────────────────────

/**
 * Verifies Stripe webhook signature and processes events.
 *
 * Handles:
 *   checkout.session.completed       → set plan + stripeCustomerId
 *   customer.subscription.updated    → update plan if price changed
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

      if (!orgId || !plan) {
        logger.warn('checkout.session.completed missing metadata', { sessionId: session.id });
        break;
      }

      await OrganizationModel.findByIdAndUpdate(orgId, {
        $set: {
          plan,
          ...(session.customer         ? { stripeCustomerId:     String(session.customer)         } : {}),
          ...(session.subscription     ? { stripeSubscriptionId: String(session.subscription)     } : {}),
          ...(session.metadata?.priceId ? { stripePriceId:        session.metadata.priceId }        : {}),
        },
      });

      logger.info('Org plan upgraded via checkout', { orgId, plan });
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

      const newPlan = priceId ? getPlanFromPriceId(priceId) : null;
      if (newPlan) {
        await OrganizationModel.findByIdAndUpdate(org._id, {
          $set: {
            plan:                 newPlan,
            stripeSubscriptionId: sub.id,
            stripePriceId:        priceId,
          },
        });
        logger.info('Org plan updated via subscription.updated', {
          orgId: org._id.toString(), newPlan,
        });
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

      await OrganizationModel.findByIdAndUpdate(org._id, {
        $set:   { plan: 'free' },
        $unset: { stripeSubscriptionId: '', stripePriceId: '' },
      });

      logger.info('Org downgraded to free on subscription.deleted', {
        orgId: org._id.toString(),
      });
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
  /** Monthly call-minute quota. limit=null means unlimited (enterprise). resetAt = ISO string of next reset. */
  callMinutes:     { used: number; limit: number | null; resetAt: string };
  stripeCustomerId: string | null;
  // ── Trial ─────────────────────────────────────────────────────────
  isInTrial:       boolean;
  isTrialExpired:  boolean;
  trialDaysLeft:   number;
  trialEndsAt:     string | null;  // ISO string for JSON serialisation
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
      used:    orgData.callMinutesUsed ?? 0,
      limit:   callMinutesLimit === Infinity ? null : callMinutesLimit,
      resetAt: nextResetAt.toISOString(),
    },
    stripeCustomerId: orgData.stripeCustomerId ?? null,
    isInTrial:        trial.isInTrial,
    isTrialExpired:   trial.isTrialExpired,
    trialDaysLeft:    trial.trialDaysLeft,
    trialEndsAt:      trial.trialEndsAt?.toISOString() ?? null,
  };
}
