/**
 * Billing Routes
 *
 * IMPORTANT: This router is mounted in app.ts BEFORE express.json() so that the
 * webhook route can receive the raw request body required for Stripe signature
 * verification. Each route adds its own body-parsing middleware:
 *
 *   POST /webhook   — express.raw()                    (Stripe signature needs raw bytes)
 *   POST /checkout  — express.json()  + authenticate   (normal JSON API)
 *   GET  /status    — no body parsing + authenticate   (GET request)
 */

import { Router } from 'express';
import express from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  createCheckoutSessionHandler,
  stripeWebhookHandler,
  getBillingStatusHandler,
  createPortalSessionHandler,
  createPremiumVoiceAddonCheckoutHandler,
  createTopupCheckoutHandler,
} from './billing.controller';
import { orgContext } from '../../middleware/orgContext';

export const billingRouter = Router();

/**
 * POST /api/v1/billing/webhook
 * Stripe webhook — raw body required for signature verification.
 * No authentication (Stripe calls this; we verify via signature).
 */
billingRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

/**
 * POST /api/v1/billing/checkout
 * Create a Stripe Checkout session. Owner-only.
 * Body: { plan: 'lite' | 'starter' | 'growth' | 'enterprise', interval?: 'month' | 'year' }
 */
billingRouter.post(
  '/checkout',
  express.json(),
  authenticate,
  orgContext,   // SEC-05: honour X-Organization-ID (service stays Owner-only)
  createCheckoutSessionHandler,
);

/**
 * POST /api/v1/billing/portal
 * Create a Stripe Customer Portal session. Owner-only.
 * Org must have an existing Stripe customer ID (paid plan).
 * Returns { url } — redirect the browser to this one-time portal URL.
 */
billingRouter.post(
  '/portal',
  express.json(),
  authenticate,
  orgContext,   // SEC-05: honour X-Organization-ID (service stays Owner-only)
  createPortalSessionHandler,
);

/**
 * POST /api/v1/billing/addons/premium-voices/checkout
 * Stripe Checkout for the Premium Voices add-on. Owner-only; Starter / Basic / Standard only.
 */
billingRouter.post(
  '/addons/premium-voices/checkout',
  express.json(),
  authenticate,
  orgContext,   // SEC-05: honour X-Organization-ID (service stays Owner-only)
  createPremiumVoiceAddonCheckoutHandler,
);

/**
 * POST /api/v1/billing/topups/checkout
 * Stripe Checkout (one-time) for a prepaid top-up pack. Owner-only; paid plans only.
 */
billingRouter.post(
  '/topups/checkout',
  express.json(),
  authenticate,
  orgContext,   // SEC-05: honour X-Organization-ID (service stays Owner-only)
  createTopupCheckoutHandler,
);

/**
 * GET /api/v1/billing/status
 * Return current plan + usage. Owner-only.
 */
billingRouter.get('/status', authenticate, orgContext, getBillingStatusHandler);
