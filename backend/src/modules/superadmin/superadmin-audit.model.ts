import mongoose, { Schema, Document } from 'mongoose';

export type SuperAdminAction =
  // Auth
  | 'SA_LOGIN'
  | 'SA_LOGOUT'
  // Org actions
  | 'SA_ORG_VIEW'
  | 'SA_ORG_IMPERSONATE'
  | 'SA_ORG_EXIT_IMPERSONATION'
  // User actions
  | 'SA_USER_VIEW'
  | 'SA_USER_SUSPEND'
  | 'SA_USER_UNSUSPEND'
  | 'SA_USER_DELETE'
  // Blog actions
  | 'SA_BLOG_CREATE'
  | 'SA_BLOG_UPDATE'
  | 'SA_BLOG_TOGGLE'
  | 'SA_BLOG_DELETE'
  // Promo code actions
  | 'SA_PROMO_CREATE'
  | 'SA_PROMO_UPDATE'
  | 'SA_PROMO_TOGGLE'
  | 'SA_PROMO_DELETE'
  | 'SA_PROMO_APPLY'
  // Plan override actions
  | 'SA_PLAN_OVERRIDE'
  | 'SA_PLAN_OVERRIDE_REVERT'
  // Feature flag actions
  | 'SA_FLAG_TOGGLE'
  | 'SA_FLAG_CREATE'
  | 'SA_FLAG_DELETE'
  // Jobs / ops actions
  | 'SA_JOB_RETRY'
  | 'SA_JOB_CLEAN'
  | 'SA_JOB_PAUSE'
  | 'SA_JOB_RESUME'
  // Announcement actions
  | 'SA_ANNOUNCEMENT_CREATE'
  | 'SA_ANNOUNCEMENT_UPDATE'
  | 'SA_ANNOUNCEMENT_TOGGLE'
  | 'SA_ANNOUNCEMENT_DELETE'
  // Changelog actions
  | 'SA_CHANGELOG_CREATE'
  | 'SA_CHANGELOG_UPDATE'
  | 'SA_CHANGELOG_TOGGLE'
  | 'SA_CHANGELOG_DELETE'
  // Communications
  | 'SA_BROADCAST_EMAIL'
  // Org ownership
  | 'SA_ORG_TRANSFER'
  // Phase 19 — CEO Strategic Features
  | 'SA_ORG_EXPORT'
  | 'SA_WHITE_LABEL_SET'
  | 'SA_ENTERPRISE_LINK_CREATE'
  | 'SA_ABTEST_CREATE';

export interface ISuperAdminLog extends Document {
  _id: mongoose.Types.ObjectId;
  superAdminId: mongoose.Types.ObjectId;
  superAdminEmail: string;
  action: SuperAdminAction;
  targetType?: 'Organization' | 'User' | 'BlogPost' | 'PromoCode' | 'FeatureFlag' | 'Queue' | 'Announcement' | 'Changelog' | 'ABTest';
  targetId?: string;
  targetLabel?: string;  // human-readable (org name, user email)
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const SuperAdminLogSchema = new Schema<ISuperAdminLog>(
  {
    superAdminId:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    superAdminEmail: { type: String, required: true },
    action:          { type: String, required: true, index: true },
    targetType:      { type: String, enum: ['Organization', 'User', 'BlogPost', 'PromoCode', 'FeatureFlag', 'Queue', 'Announcement', 'Changelog', 'ABTest'] },
    targetId:        { type: String, index: true },
    targetLabel:     { type: String },
    metadata:        { type: Schema.Types.Mixed },
    ip:              { type: String },
    userAgent:       { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Audit logs are immutable — never updated
    strict: true,
  }
);

// TTL: keep audit logs for 2 years
SuperAdminLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

export const SuperAdminLogModel = mongoose.model<ISuperAdminLog>('SuperAdminLog', SuperAdminLogSchema);
