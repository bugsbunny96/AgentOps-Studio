/**
 * Trial Gate Middleware
 *
 * Two exported middlewares:
 *
 * 1. `attachEffectivePlan` (lightweight, non-blocking)
 *    Reads the org's plan + trial state and attaches `req.effectivePlan`.
 *    Use on ALL authenticated org routes so controllers always have a reliable
 *    effective plan to check against (e.g. for showing UI limits).
 *    Never blocks a request — falls back to 'free' on any error.
 *
 * 2. `requirePaidOrTrial` (blocking gate)
 *    Returns HTTP 402 if the org is on the free plan AND the trial has expired.
 *    Use on routes that are not available on the bare free plan, e.g.:
 *      - creating extra KB documents beyond the free limit
 *      - inviting team members (Members seat is paid-only)
 *    Does NOT block routes that are always available (dashboard, calls view, etc.)
 *
 * Usage in routes:
 *   router.post('/kb', authenticate, validateOrganization, requirePaidOrTrial, createKbDocument);
 *   router.get('/billing', authenticate, getBillingStatus);  ← no gate needed
 */

import { Request, Response, NextFunction } from 'express';
import { OrganizationModel } from '../modules/organization/organization.model';
import { computeTrialState } from '../modules/billing/trial.service';
import { logger } from '../utils/logger';
import type { Plan } from '../modules/organization/organization.model';

// ─── attachEffectivePlan ──────────────────────────────────────────────────────

/**
 * Non-blocking middleware.
 * Reads org trial state and sets req.effectivePlan.
 * Requires req.orgId (must come after validateOrganization).
 */
export async function attachEffectivePlan(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.orgId) {
    // No org context — proceed without setting effectivePlan
    return next();
  }

  try {
    const org = await OrganizationModel.findById(req.orgId)
      .select('plan trialUsed trialEndsAt')
      .lean();

    if (!org) {
      req.effectivePlan = 'free';
      return next();
    }

    const plan = (org as { plan?: Plan }).plan ?? 'free';
    const orgData = org as { plan?: Plan; trialUsed?: boolean; trialEndsAt?: Date };
    const trial = computeTrialState(plan, orgData.trialUsed ?? false, orgData.trialEndsAt);

    req.effectivePlan = trial.isInTrial ? 'growth' : plan;
  } catch (err) {
    logger.warn('attachEffectivePlan: failed to resolve org plan — defaulting to free', {
      orgId: req.orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    req.effectivePlan = 'free';
  }

  next();
}

// ─── requirePaidOrTrial ───────────────────────────────────────────────────────

/**
 * Blocking gate middleware.
 * Blocks with HTTP 402 when:
 *   - org.plan === 'free'  AND
 *   - the free trial has expired (or was never started)
 *
 * Active trial → allowed (effectivePlan = 'growth')
 * Any paid plan → allowed
 *
 * Requires req.orgId (must come after validateOrganization).
 */
export async function requirePaidOrTrial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.orgId) {
    res.status(400).json({
      success: false,
      code:    'MISSING_ORG_CONTEXT',
      message: 'Organization context required',
    });
    return;
  }

  try {
    const org = await OrganizationModel.findById(req.orgId)
      .select('plan trialUsed trialEndsAt')
      .lean();

    if (!org) {
      res.status(403).json({ success: false, code: 'ORG_NOT_FOUND', message: 'Organization not found' });
      return;
    }

    const plan = (org as { plan?: Plan }).plan ?? 'free';

    // Paid plans — always pass through
    if (plan !== 'free') {
      req.effectivePlan = plan;
      return next();
    }

    // Free plan — check trial
    const orgData = org as { plan?: Plan; trialUsed?: boolean; trialEndsAt?: Date };
    const trial = computeTrialState(plan, orgData.trialUsed ?? false, orgData.trialEndsAt);

    if (trial.isInTrial) {
      // Trial is active — grant growth-level access
      req.effectivePlan = 'growth';
      return next();
    }

    // Trial expired (or never started) — block
    const message = trial.isTrialExpired
      ? `Your 7-day free trial has ended. Upgrade to continue using this feature.`
      : `This feature requires a paid plan. Upgrade to access it.`;

    res.status(402).json({
      success: false,
      code:    'TRIAL_EXPIRED',
      message,
      upgradeUrl: '/billing',
    });
  } catch (err) {
    logger.error('requirePaidOrTrial: error checking org trial state', {
      orgId: req.orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    next(err);
  }
}
