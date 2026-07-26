import type { Request, Response, NextFunction } from 'express';
import { createCheckoutSession, handleStripeWebhook, getBillingStatus } from './billing.service';
import { BadRequest } from '../../middleware/errorHandler';

/**
 * POST /api/v1/billing/checkout
 * Body: { plan: 'starter' | 'growth' }
 * Returns: { url } — redirect the browser to this Stripe Checkout URL
 */
export async function createCheckoutSessionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { plan } = req.body as { plan?: string };
    const result = await createCheckoutSession(req.userId!, plan ?? '');
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
