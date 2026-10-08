import type { Request, Response, NextFunction } from 'express';
import { createCheckoutSession, handleStripeWebhook, getBillingStatus, createPortalSession, createPremiumVoiceAddonCheckout, createTopupCheckout } from './billing.service';
import { BadRequest } from '../../middleware/errorHandler';

/**
 * POST /api/v1/billing/checkout
 * Body: { plan: 'lite' | 'starter' | 'growth' | 'enterprise', interval?: 'month' | 'year' }
 *       (Starter | Basic | Standard | Pro; annual = 10 months' price for 12, setup fee waived)
 * Returns: { url } — redirect the browser to this Stripe Checkout URL
 */
export async function createCheckoutSessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { plan, interval } = req.body as { plan?: string; interval?: string };
    const result = await createCheckoutSession(req.userId!, plan ?? '', interval ?? 'month');
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/billing/webhook
 * Raw body required — must be mounted with express.raw() BEFORE express.json()
 * Header: stripe-signature
 */
export async function stripeWebhookHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      throw BadRequest('Missing Stripe-Signature header', 'MISSING_STRIPE_SIGNATURE');
    }

    // req.body is a Buffer when express.raw() is used
    const rawBody = req.body as Buffer;
    const result  = await handleStripeWebhook(rawBody, sig);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/billing/portal
 * Creates a Stripe Customer Portal session and returns a one-time redirect URL.
 * The org must already have a Stripe customer ID (i.e., be on a paid plan).
 * The portal lets the owner manage payment methods, invoices, and cancellation.
 */
export async function createPortalSessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await createPortalSession(req.userId!);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/billing/status
 * Returns current plan + feature usage for the BillingPage.
 */
export async function getBillingStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const status = await getBillingStatus(req.userId!);
    res.status(200).json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/billing/addons/premium-voices/checkout
 * Stripe Checkout for the Premium Voices add-on (Starter ₹1,499 / Basic ₹2,999 / Standard ₹4,999 a month).
 * Returns: { url } — redirect the browser to this Stripe Checkout URL
 */
export async function createPremiumVoiceAddonCheckoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await createPremiumVoiceAddonCheckout(req.userId!);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/billing/topups/checkout
 * Body: { pack: 'topup_100' | 'topup_500' } — ₹2,000 / 100 min, ₹9,000 / 500 min (+ GST)
 * Returns: { url } — redirect the browser to this Stripe Checkout URL
 */
export async function createTopupCheckoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { pack } = req.body as { pack?: string };
    const result = await createTopupCheckout(req.userId!, pack ?? '');
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
