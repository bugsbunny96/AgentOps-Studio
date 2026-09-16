/**
 * PromoCode — Mongoose model
 *
 * Discount codes that users enter at checkout or that the super admin
 * applies directly to an org's subscription.
 *
 * Design rules:
 *   - Codes are stored and compared in UPPERCASE.
 *   - Codes with usedCount > 0 cannot be hard-deleted (disable instead).
 *   - Redemptions are embedded subdocs (no separate collection needed at this scale).
 *   - validUntil === null means the code never expires.
 */

import mongoose, { Schema, Document } from 'mongoose';

// ─── Sub-types ────────────────────────────────────────────────────────────────

export type DiscountType  = 'percent' | 'fixed_inr';
export type AppliesTo     = 'starter' | 'growth' | 'both' | 'all';
export type BillingCycle  = 'monthly' | 'annual' | 'both';

export interface IRedemption {
  orgId:             string;
  userId:            string;
  redeemedAt:        Date;
  planAtRedemption:  string;
}

export interface IPromoCode extends Document {
  code:           string;           // Unique, uppercase
  discountType:   DiscountType;
  discountValue:  number;           // % or ₹ amount
  appliesTo:      AppliesTo;
  billingCycle:   BillingCycle;
  maxUses:        number | null;    // null = unlimited
  usedCount:      number;
  validFrom:      Date;
  validUntil:     Date | null;
  active:         boolean;
  createdBy:      string;           // SA email
  notes:          string;
  redemptions:    IRedemption[];
  createdAt:      Date;
  updatedAt:      Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const RedemptionSchema = new Schema<IRedemption>(
  {
    orgId:            { type: String, required: true },
    userId:           { type: String, required: true },
    redeemedAt:       { type: Date,   default: Date.now },
    planAtRedemption: { type: String, required: true },
  },
  { _id: false }
);

const PromoCodeSchema = new Schema<IPromoCode>(
  {
    code: {
      type:      String,
      required:  true,
      unique:    true,
      trim:      true,
      uppercase: true,
      index:     true,
    },
    discountType: {
      type:     String,
      enum:     ['percent', 'fixed_inr'],
      required: true,
    },
    discountValue: {
      type:     Number,
      required: true,
      min:      0,
    },
    appliesTo: {
      type:     String,
      enum:     ['starter', 'growth', 'both', 'all'],
      required: true,
    },
    billingCycle: {
      type:     String,
      enum:     ['monthly', 'annual', 'both'],
      required: true,
    },
    maxUses: {
      type:    Number,
      default: null,    // null = unlimited
    },
    usedCount: {
      type:    Number,
      default: 0,
    },
    validFrom: {
      type:    Date,
      default: Date.now,
    },
    validUntil: {
      type:    Date,
      default: null,
    },
    active: {
      type:    Boolean,
      default: true,
      index:   true,
    },
    createdBy: {
      type:    String,
      default: '',
    },
    notes: {
      type:    String,
      default: '',
    },
    redemptions: {
      type:    [RedemptionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'promo_codes',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

PromoCodeSchema.index({ active: 1, validFrom: 1, validUntil: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const PromoCodeModel = mongoose.model<IPromoCode>('PromoCode', PromoCodeSchema);
