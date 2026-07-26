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
} from './billing.controller';

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
 * Body: { plan: 'starter' | 'growth' }
 */
billingRouter.post(
  '/checkout',
  express.json(),
  authenticate,
  createCheckoutSessionHandler,
);

/**
 * GET /api/v1/billing/status
 * Return current plan + usage. Owner-only.
 */
billingRouter.get('/status', authenticate, getBillingStatusHandler);
