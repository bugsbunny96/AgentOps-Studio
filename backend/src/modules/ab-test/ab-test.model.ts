/**
 * A/B Test model
 *
 * Super admin defines test variants and assigns orgs to them.
 * Variants carry a split percentage (must sum to 100).
 * Conversion events are tracked per org via ABTestConversion.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface IABVariant {
  id:          string;  // short slug, e.g. 'control' | 'variant_a'
  name:        string;
  description: string;
  percentage:  number;  // 0–100; all variants must sum to 100
}

export interface IABTest extends Document {
  _id:         mongoose.Types.ObjectId;
  name:        string;
  description: string;
  hypothesis:  string;
  variants:    IABVariant[];
  status:      ABTestStatus;
  /** Orgs explicitly assigned to this test (if empty → all active orgs) */
  orgIds:      string[];
  /** Assignment map: orgId → variantId */
  assignments: Record<string, string>;
  /** Conversion goal description */
  conversionGoal: string;
  /** Conversion counts per variant */
  conversions: Record<string, number>;
  createdBy:   string;
  startedAt?:  Date;
  endedAt?:    Date;
  createdAt:   Date;
  updatedAt:   Date;
}

const ABVariantSchema = new Schema<IABVariant>(
  {
    id:          { type: String, required: true },
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    percentage:  { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const ABTestSchema = new Schema<IABTest>(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    hypothesis:  { type: String, default: '' },
    variants:    { type: [ABVariantSchema], default: [] },
    status:      { type: String, enum: ['draft', 'running', 'paused', 'completed'], default: 'draft', index: true },
    orgIds:      { type: [String], default: [] },
    assignments: { type: Schema.Types.Mixed, default: {} },
    conversionGoal: { type: String, default: '' },
    conversions: { type: Schema.Types.Mixed, default: {} },
    createdBy:   { type: String, required: true },
    startedAt:   { type: Date },
    endedAt:     { type: Date },
  },
  { timestamps: true }
);

export const ABTestModel = mongoose.model<IABTest>('ABTest', ABTestSchema);
