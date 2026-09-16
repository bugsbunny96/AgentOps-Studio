/**
 * Promo Code Service
 *
 * Responsibilities:
 *   - CRUD for promo codes (SA-only)
 *   - validatePromoCode — used at checkout to confirm a code is usable
 *   - applyPromoManually — SA bypasses Stripe to record a redemption
 *   - incrementUsage — called after a successful Stripe payment
 */

import { PromoCodeModel, type AppliesTo, type BillingCycle } from './promo.model';
import { BadRequest, NotFound } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatePromoInput {
  code:           string;
  discountType:   'percent' | 'fixed_inr';
  discountValue:  number;
  appliesTo:      AppliesTo;
  billingCycle:   BillingCycle;
  maxUses?:       number | null;
  validFrom?:     Date | string;
  validUntil?:    Date | string | null;
  notes?:         string;
}

export interface ValidatePromoResult {
  valid:          boolean;
  code:           string;
  discountType:   'percent' | 'fixed_inr';
  discountValue:  number;
  promoId:        string;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createPromo(data: CreatePromoInput, saEmail: string) {
  const code = data.code.trim().toUpperCase();
  if (!code) throw BadRequest('Promo code is required', 'MISSING_CODE');
  if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
    throw BadRequest('Code must be 2–30 uppercase letters, numbers, hyphens or underscores', 'INVALID_CODE_FORMAT');
  }

  const existing = await PromoCodeModel.findOne({ code }).lean();
  if (existing) throw BadRequest('Promo code already exists', 'CODE_EXISTS');

  if (data.discountType === 'percent' && (data.discountValue <= 0 || data.discountValue > 100)) {
    throw BadRequest('Percent discount must be between 1 and 100', 'INVALID_DISCOUNT');
  }
  if (data.discountType === 'fixed_inr' && data.discountValue <= 0) {
    throw BadRequest('Fixed discount must be positive', 'INVALID_DISCOUNT');
  }

  const promo = await PromoCodeModel.create({
    code,
    discountType:  data.discountType,
    discountValue: data.discountValue,
    appliesTo:     data.appliesTo,
    billingCycle:  data.billingCycle,
    maxUses:       data.maxUses ?? null,
    validFrom:     data.validFrom ? new Date(data.validFrom) : new Date(),
    validUntil:    data.validUntil ? new Date(data.validUntil as string) : null,
    notes:         data.notes?.trim() ?? '',
    createdBy:     saEmail,
  });

  logger.info('Promo code created', { code, saEmail });
  return promo;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updatePromo(id: string, data: Partial<CreatePromoInput>) {
  const promo = await PromoCodeModel.findById(id);
  if (!promo) throw NotFound('Promo code');

  if (data.discountType  !== undefined) promo.discountType  = data.discountType;
  if (data.discountValue !== undefined) promo.discountValue = data.discountValue;
  if (data.appliesTo     !== undefined) promo.appliesTo     = data.appliesTo;
  if (data.billingCycle  !== undefined) promo.billingCycle  = data.billingCycle;
  if (data.maxUses       !== undefined) promo.maxUses       = data.maxUses ?? null;
  if (data.validFrom     !== undefined) promo.validFrom     = new Date(data.validFrom as string);
  if (data.validUntil    !== undefined) promo.validUntil    = data.validUntil ? new Date(data.validUntil as string) : null;
  if (data.notes         !== undefined) promo.notes         = data.notes?.trim() ?? '';

  await promo.save();
  return promo;
}

// ─── Toggle Active ────────────────────────────────────────────────────────────

export async function togglePromo(id: string) {
  const promo = await PromoCodeModel.findById(id);
  if (!promo) throw NotFound('Promo code');
  promo.active = !promo.active;
  await promo.save();
  return promo;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deletePromo(id: string) {
  const promo = await PromoCodeModel.findById(id);
  if (!promo) throw NotFound('Promo code');

  if (promo.usedCount > 0) {
    throw BadRequest(
      'Cannot delete a promo code that has been used. Disable it instead.',
      'CODE_HAS_REDEMPTIONS',
    );
  }

  await PromoCodeModel.findByIdAndDelete(id);
  logger.info('Promo code deleted', { id, code: promo.code });
  return { deleted: true };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listPromos(page = 1, limit = 20, activeOnly?: boolean) {
  const skip   = (page - 1) * limit;
  const filter = activeOnly ? { active: true } : {};

  const [promos, total] = await Promise.all([
    PromoCodeModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-redemptions') // exclude embedded array from list view
      .lean(),
    PromoCodeModel.countDocuments(filter),
  ]);

  return { promos, total, page, limit };
}

// ─── Get Detail ───────────────────────────────────────────────────────────────

export async function getPromo(id: string) {
  const promo = await PromoCodeModel.findById(id).lean();
  if (!promo) throw NotFound('Promo code');
  return promo;
}

// ─── Validate at Checkout ─────────────────────────────────────────────────────

/**
 * Called during Stripe checkout to validate a promo code before forwarding
 * to Stripe. Returns the discount details if valid.
 *
 * plan         — 'starter' | 'growth'
 * billingCycle — 'monthly' | 'annual'
 */
export async function validatePromoCode(
  code: string,
  plan: string,
  billingCycle: string,
): Promise<ValidatePromoResult> {
  const promo = await PromoCodeModel.findOne({ code: code.trim().toUpperCase() }).lean();

  if (!promo) throw BadRequest('Promo code not found', 'INVALID_PROMO');
  if (!promo.active) throw BadRequest('Promo code is no longer active', 'PROMO_INACTIVE');

  const now = new Date();
  if (promo.validFrom && promo.validFrom > now) {
    throw BadRequest('Promo code is not yet valid', 'PROMO_NOT_STARTED');
  }
  if (promo.validUntil && promo.validUntil < now) {
    throw BadRequest('Promo code has expired', 'PROMO_EXPIRED');
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    throw BadRequest('Promo code has reached its maximum uses', 'PROMO_MAX_USES');
  }

  // Plan applicability
  if (promo.appliesTo !== 'all' && promo.appliesTo !== 'both') {
    if (promo.appliesTo !== plan) {
      throw BadRequest(`Promo code does not apply to the ${plan} plan`, 'PROMO_PLAN_MISMATCH');
    }
  }

  // Billing cycle
  if (promo.billingCycle !== 'both') {
    if (promo.billingCycle !== billingCycle) {
      throw BadRequest(`Promo code only applies to ${promo.billingCycle} billing`, 'PROMO_CYCLE_MISMATCH');
    }
  }

  return {
    valid:         true,
    code:          promo.code,
    discountType:  promo.discountType,
    discountValue: promo.discountValue,
    promoId:       promo._id.toString(),
  };
}

// ─── Increment Usage (after successful payment) ───────────────────────────────

export async function incrementPromoUsage(
  code: string,
  orgId: string,
  userId: string,
  plan: string,
) {
  await PromoCodeModel.updateOne(
    { code: code.toUpperCase() },
    {
      $inc: { usedCount: 1 },
      $push: {
        redemptions: {
          orgId,
          userId,
          redeemedAt:       new Date(),
          planAtRedemption: plan,
        },
      },
    }
  );
}

// ─── Manual Apply (SA override — no Stripe) ───────────────────────────────────

/**
 * Super admin directly applies a promo code to an org without going through
 * Stripe checkout. Records the redemption and decrements remaining uses.
 */
export async function applyPromoManually(
  promoId: string,
  orgId: string,
  userId: string,
  plan: string,
  saEmail: string,
) {
  const promo = await PromoCodeModel.findById(promoId);
  if (!promo) throw NotFound('Promo code');
  if (!promo.active) throw BadRequest('Promo code is inactive', 'PROMO_INACTIVE');
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    throw BadRequest('Promo code has reached its maximum uses', 'PROMO_MAX_USES');
  }

  // Check org hasn't already used this code
  const alreadyUsed = promo.redemptions.some((r) => r.orgId === orgId);
  if (alreadyUsed) throw BadRequest('This org has already redeemed this promo code', 'ALREADY_REDEEMED');

  promo.usedCount += 1;
  promo.redemptions.push({
    orgId,
    userId,
    redeemedAt:       new Date(),
    planAtRedemption: plan,
  });

  await promo.save();
  logger.info('Promo code applied manually', { promoId, orgId, saEmail });
  return { applied: true, promo };
}
