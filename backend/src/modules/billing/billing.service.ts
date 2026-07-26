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

// ─── Plan Limits (shared with kb.service + team.service) ─────────────────────

export const PLAN_LIMITS: Record<Plan, { kbDocs: number; teamMembers: number }> = {
  free:       { kbDocs: 5,        teamMembers: 0        }, // owner only
  starter:    { kbDocs: 5,        teamMembers: 1        }, // owner + 1 member
  growth:     { kbDocs: 50,       teamMembers: 5        }, // owner + 5 members
  enterprise: { kbDocs: Infinity, teamMembers: Infinity }, // unlimited
};

// ─── Plan name → Stripe price ID mapping ──────────────────────────────────────

function getPlanPriceId(plan: 'starter' | 'growth'): string {
  if (plan === 'starter') {
    if (!env.STRIPE_STARTER_PRICE_ID) throw BadRequest('Starter plan is not configured');
    return env.STRIPE_STARTER_PRICE_ID;
  }
  if (!env.STRIPE_GROWTH_PRICE_ID) throw BadRequest('Growth plan is not configured');
  return env.STRIPE_GROWTH_PRICE_ID;
}

function getPlanFromPriceId(priceId: string): Plan | null {
  if (priceId === env.STRIPE_STARTER_PRICE_ID) return 'starter';
  if (priceId === env.STRIPE_GROWTH_PRICE_ID)  return 'growth';
  return null;
}

// ─── Stripe client (lazy — only initialised when needed) ──────────────────────

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  if (!env.STRIPE_SECRET_KEY) {
    throw BadRequest('Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.');
  }
  _stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' });
  return _stripe;
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
 * Creates a Stripe Checkout session for upgrading to `starter` or `growth`.
 * Returns the Stripe Checkout URL for redirect.
 */
export async function createCheckoutSession(
  userId: string,
  targetPlan: string,
): Promise<{ url: string }> {
  if (!targetPlan || !['starter', 'growth'].includes(targetPlan)) {
    throw BadRequest('Plan must be "starter" or "growth"', 'INVALID_PLAN');
  }

  const stripe = getStripe();
  const { org, orgId } = await resolveOwnerOrgForBilling(userId);

  const priceId = getPlanPriceId(targetPlan as 'starter' | 'growth');

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

// ─── getBillingStatus ─────────────────────────────────────────────────────────

export interface BillingStatus {
  plan:            Plan;
  kbDocs:          { used: number; limit: number | null };
  teamMembers:     { used: number; limit: number | null };
  stripeCustomerId: string | null;
}

/**
 * Returns the current billing plan + feature usage counts.
 * Available to the org Owner only.
 */
export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const { org, orgId } = await resolveOwnerOrgForBilling(userId);

  // org is typed loosely from the lean query, access plan with fallback
  const plan: Plan = ((org as unknown as { plan?: Plan }).plan) ?? 'free';
  const limits     = PLAN_LIMITS[plan];

  const [kbDocsUsed, membersUsed, pendingInvites] = await Promise.all([
    KbDocumentModel.countDocuments({ organizationId: orgId }),
    MembershipModel.countDocuments({ organizationId: orgId, role: 'Member' }),
    InvitationModel.countDocuments({ organizationId: orgId, expiresAt: { $gt: new Date() } }),
  ]);

  return {
    plan,
    kbDocs: {
      used:  kbDocsUsed,
      limit: limits.kbDocs === Infinity ? null : limits.kbDocs,
    },
    teamMembers: {
      used:  membersUsed + pendingInvites,
      limit: limits.teamMembers === Infinity ? null : limits.teamMembers,
    },
    stripeCustomerId: ((org as unknown as { stripeCustomerId?: string }).stripeCustomerId) ?? null,
  };
}
