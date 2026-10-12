/**
 * Sales deal log (MKT-11, 2026-10-12) — super-admin only.
 *
 * One record per prospect the founder talks to: where they came from, the
 * stage (open / won / lost), why a deal was lost, and four price-sensitivity
 * answers (Van Westendorp) asked on discovery calls. Feeds the lost-deal
 * review ("fix the #1 reason deals stall") and later LTV:CAC by channel.
 * Prospect business data only — no customer org data is copied here.
 */
import mongoose, { Document, Schema } from 'mongoose';

export const DEAL_STAGES   = ['open', 'won', 'lost'] as const;
export const DEAL_SOURCES  = ['outbound', 'inbound_call', 'website', 'referral', 'walk_in', 'event', 'other'] as const;
export const LOST_REASONS  = [
  'price', 'no_need', 'timing', 'chose_competitor', 'missing_feature',
  'trust', 'no_response', 'decision_maker', 'other',
] as const;
export const DEAL_PLANS    = ['lite', 'starter', 'growth', 'enterprise'] as const;

export type DealStage  = (typeof DEAL_STAGES)[number];
export type DealSource = (typeof DEAL_SOURCES)[number];
export type LostReason = (typeof LOST_REASONS)[number];
export type DealPlan   = (typeof DEAL_PLANS)[number];

/** Van Westendorp answers, ₹ per month ex-GST. All optional. */
export interface PriceAnswers {
  tooCheapInr?:     number;
  bargainInr?:      number;
  expensiveInr?:    number;
  tooExpensiveInr?: number;
}

export interface ISalesDeal extends Document {
  _id:               mongoose.Types.ObjectId;
  businessName:      string;
  city?:             string;
  niche?:            string;
  contactName?:      string;
  source:            DealSource;
  stage:             DealStage;
  lostReason?:       LostReason;
  plan?:             DealPlan;
  callsPerDay?:      number;
  avgOrderValueInr?: number;
  successMeasure?:   string;
  nextStep?:         string;
  nextStepAt?:       Date | null;
  notes?:            string;
  priceAnswers?:     PriceAnswers;
  closedAt?:         Date | null;
  createdBy:         string;
  createdAt:         Date;
  updatedAt:         Date;
}

const money = { type: Number, min: 0, max: 10_000_000 };

const SalesDealSchema = new Schema<ISalesDeal>(
  {
    businessName:     { type: String, required: true, trim: true, maxlength: 200 },
    city:             { type: String, trim: true, maxlength: 100 },
    niche:            { type: String, trim: true, maxlength: 100 },
    contactName:      { type: String, trim: true, maxlength: 120 },
    source:           { type: String, enum: DEAL_SOURCES, default: 'outbound' },
    stage:            { type: String, enum: DEAL_STAGES, default: 'open', index: true },
    lostReason:       { type: String, enum: LOST_REASONS },
    plan:             { type: String, enum: DEAL_PLANS },
    callsPerDay:      { type: Number, min: 0, max: 100_000 },
    avgOrderValueInr: money,
    successMeasure:   { type: String, trim: true, maxlength: 500 },
    nextStep:         { type: String, trim: true, maxlength: 300 },
    nextStepAt:       { type: Date, default: null },
    notes:            { type: String, trim: true, maxlength: 4000 },
    priceAnswers: {
      _id:             false,
      tooCheapInr:     money,
      bargainInr:      money,
      expensiveInr:    money,
      tooExpensiveInr: money,
    },
    closedAt:         { type: Date, default: null },
    createdBy:        { type: String, required: true },
  },
  { timestamps: true },
);

SalesDealSchema.index({ createdAt: -1 });

export const SalesDealModel = mongoose.model<ISalesDeal>('SalesDeal', SalesDealSchema);
