/**
 * EnterpriseLink model — 19.3 Self-serve enterprise onboarding
 *
 * Super admin generates a signed magic link for an enterprise prospect.
 * The link encodes a pre-set plan, custom trial days, and optional pre-fills.
 * When clicked, the normal onboarding flow starts with those values injected.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type EnterpriseLinkStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface IEnterpriseLink extends Document {
  _id:         mongoose.Types.ObjectId;
  token:       string;            // URL-safe unique token
  plan:        string;            // plan to auto-assign: 'starter' | 'growth' | 'enterprise'
  trialDays:   number;            // custom trial length (0 = no trial, direct paid)
  /** Prospect metadata pre-filled in the onboarding form */
  prefilledName?:     string;
  prefilledEmail?:    string;
  prefilledCompany?:  string;
  prefilledIndustry?: string;
  note:        string;            // SA-internal note (e.g. "Acme Corp — closed on WhatsApp")
  status:      EnterpriseLinkStatus;
  expiresAt:   Date;
  usedAt?:     Date;
  usedByOrgId?: string;
  createdBy:   string;
  createdAt:   Date;
  updatedAt:   Date;
}

const EnterpriseLinkSchema = new Schema<IEnterpriseLink>(
  {
    token:              { type: String, required: true, unique: true, index: true },
    plan:               { type: String, enum: ['free', 'starter', 'growth', 'enterprise'], required: true },
    trialDays:          { type: Number, default: 14 },
    prefilledName:      { type: String },
    prefilledEmail:     { type: String },
    prefilledCompany:   { type: String },
    prefilledIndustry:  { type: String },
    note:               { type: String, default: '' },
    status:             { type: String, enum: ['active', 'used', 'expired', 'revoked'], default: 'active', index: true },
    expiresAt:          { type: Date, required: true },
    usedAt:             { type: Date },
    usedByOrgId:        { type: String },
    createdBy:          { type: String, required: true },
  },
  { timestamps: true }
);

// TTL-based auto-expiry (MongoDB removes the doc 0 seconds after expiresAt)
EnterpriseLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EnterpriseLinkModel = mongoose.model<IEnterpriseLink>('EnterpriseLink', EnterpriseLinkSchema);
