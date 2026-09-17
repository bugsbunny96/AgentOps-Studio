/**
 * FeatureFlag Model
 *
 * Stores platform-level and per-org feature flags.
 *
 * scope: 'global' — applies platform-wide (e.g. MAINTENANCE_MODE)
 * scope: 'org'    — applies to a single org; orgId required
 *
 * Global flags are seeded on first use via seedGlobalFlags().
 * Org flags are created on demand by super admins.
 */
import mongoose, { Document, Schema } from 'mongoose';

export type FlagScope = 'global' | 'org';

export interface IFeatureFlag extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  scope: FlagScope;
  enabled: boolean;
  description: string;
  orgId?: string;
  lastChangedBy?: string;
  lastChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    name: { type: String, required: true },
    scope: { type: String, enum: ['global', 'org'], required: true },
    enabled: { type: Boolean, default: false },
    description: { type: String, default: '' },
    orgId: { type: String },
    lastChangedBy: { type: String },
    lastChangedAt: { type: Date },
  },
  { timestamps: true },
);

// (name + scope + orgId) is the unique identity for a flag
FeatureFlagSchema.index({ name: 1, scope: 1, orgId: 1 }, { unique: true, sparse: true });
FeatureFlagSchema.index({ scope: 1 });
FeatureFlagSchema.index({ orgId: 1 });

export const FeatureFlagModel = mongoose.model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);
