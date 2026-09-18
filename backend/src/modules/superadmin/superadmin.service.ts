import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { UserModel } from '../auth/auth.model';
import { OrganizationModel, MembershipModel, Plan } from '../organization/organization.model';
import { CallModel } from '../calls/call.model';
import { signAccessToken } from '../../utils/jwt';
import { signSuperAdminToken } from '../../middleware/superAdminAuthenticate';
import { Unauthorized, BadRequest, NotFound } from '../../middleware/errorHandler';
import { sendEmail } from '../../utils/email';

// ── Plan pricing constants (INR / month) ─────────────────────────────────────
// Source of truth: AgentOps Studio — SaaS Pricing & Stripe Setup (2026-09-17)
// starter = Basic (₹9,999), growth = Standard (₹17,999), enterprise = Pro (₹25,999)
const PLAN_MRR: Record<string, number> = {
  free:       0,
  starter:    9_999,
  growth:     17_999,
  enterprise: 25_999,
};

// ─── SA Login ─────────────────────────────────────────────────────────────────
export async function superAdminLogin(email: string, password: string) {
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  if (!user) throw Unauthorized('Invalid credentials');

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw Unauthorized('Invalid credentials');

  if (!user.isSuperAdmin) throw Unauthorized('Access denied — not a super admin', 'NOT_SUPER_ADMIN');
  if (user.status === 'Suspended') throw Unauthorized('Account suspended', 'ACCOUNT_SUSPENDED');

  const token = signSuperAdminToken({
    superAdminId: user._id.toString(),
    email:        user.email,
    role:         'root',
  });

  return { token, admin: { id: user._id.toString(), name: user.name, email: user.email } };
}

// ─── Platform Stats ───────────────────────────────────────────────────────────
export async function getPlatformStats() {
  const [totalOrgs, totalUsers, activeUsers, suspendedUsers] = await Promise.all([
    OrganizationModel.countDocuments(),
    UserModel.countDocuments(),
    UserModel.countDocuments({ status: 'Active' }),
    UserModel.countDocuments({ status: 'Suspended' }),
  ]);

  // Plan breakdown
  const planBreakdown = await OrganizationModel.aggregate([
    { $group: { _id: '$plan', count: { $sum: 1 } } },
  ]);

  const plans: Record<string, number> = { free: 0, starter: 0, growth: 0, enterprise: 0 };
  planBreakdown.forEach((p) => { if (p._id) plans[p._id] = p.count; });

  return { totalOrgs, totalUsers, activeUsers, suspendedUsers, plans };
}

// ─── Org List ─────────────────────────────────────────────────────────────────
export async function listOrgs(
  page = 1,
  limit = 20,
  search?: string,
  plan?: string
): Promise<{ total: number; page: number; limit: number; orgs: Array<Record<string, unknown>> }> {
  const query: Record<string, unknown> = {};
  if (search) query.name = { $regex: search, $options: 'i' };
  if (plan)   query.plan = plan;

  const skip  = (page - 1) * limit;
  const total = await OrganizationModel.countDocuments(query);
  const orgs  = await OrganizationModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Attach member counts
  const orgIds = orgs.map((o) => o._id);
  const memberCounts = await MembershipModel.aggregate([
    { $match: { organizationId: { $in: orgIds } } },
    { $group: { _id: '$organizationId', count: { $sum: 1 } } },
  ]);
  const countMap: Record<string, number> = {};
  memberCounts.forEach((m) => { countMap[m._id.toString()] = m.count; });

  const enriched = orgs.map((o) => ({
    ...o,
    memberCount: countMap[o._id.toString()] ?? 0,
  }));

  return { total, page, limit, orgs: enriched };
}

// ─── Org Detail ───────────────────────────────────────────────────────────────
export async function getOrgDetail(orgId: string) {
  if (!mongoose.Types.ObjectId.isValid(orgId)) throw BadRequest('Invalid org ID');

  const org = await OrganizationModel.findById(orgId).lean();
  if (!org) throw NotFound('Organisation not found');

  const members = await MembershipModel.find({ organizationId: org._id })
    .populate<{ userId: { _id: mongoose.Types.ObjectId; name: string; email: string; status: string; isSuperAdmin: boolean } }>(
      'userId',
      'name email status isSuperAdmin'
    )
    .lean();

  return {
    org,
    members: members.map((m) => ({
      membershipId: m._id.toString(),
      role:         m.role,
      permissions:  m.permissions,
      user:         m.userId ? {
        id:          m.userId._id.toString(),
        name:        m.userId.name,
        email:       m.userId.email,
        status:      m.userId.status,
        isSuperAdmin: m.userId.isSuperAdmin,
      } : null,
    })),
  };
}

// ─── Impersonate Org ──────────────────────────────────────────────────────────
export async function impersonateOrg(orgId: string) {
  if (!mongoose.Types.ObjectId.isValid(orgId)) throw BadRequest('Invalid org ID');

  const org = await OrganizationModel.findById(orgId).lean();
  if (!org) throw NotFound('Organisation not found');

  // Find the owner membership
  const ownerMembership = await MembershipModel.findOne({
    organizationId: org._id,
    role: 'Owner',
  }).populate<{ userId: { _id: mongoose.Types.ObjectId; email: string; name: string; status: string } }>(
    'userId',
    'email name status'
  ).lean();

  if (!ownerMembership || !ownerMembership.userId) {
    throw BadRequest('Organisation has no owner — cannot impersonate');
  }

  const owner = ownerMembership.userId;

  // Issue a short-lived (4h) access token scoped to the owner's identity
  // We reuse the standard access token format so existing `authenticate` middleware works unchanged
  const impersonateToken = signAccessToken({
    userId: owner._id.toString(),
    email:  owner.email,
  });

  return {
    impersonateToken,
    org:   { id: org._id.toString(), name: org.name, slug: org.slug },
    owner: { id: owner._id.toString(), name: owner.name, email: owner.email },
  };
}

// ─── User List ────────────────────────────────────────────────────────────────
export async function listUsers(
  page = 1,
  limit = 20,
  search?: string,
  status?: string
) {
  const query: Record<string, unknown> = {};
  if (search) {
    query.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (status) query.status = status;

  const skip  = (page - 1) * limit;
  const total = await UserModel.countDocuments(query);
  const users = await UserModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { total, page, limit, users };
}

// ─── User Detail ──────────────────────────────────────────────────────────────
export async function getUserDetail(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw BadRequest('Invalid user ID');

  const user = await UserModel.findById(userId).lean();
  if (!user) throw NotFound('User not found');

  const memberships = await MembershipModel.find({ userId: user._id })
    .populate<{ organizationId: { _id: mongoose.Types.ObjectId; name: string; slug: string; plan: string } }>(
      'organizationId',
      'name slug plan'
    )
    .lean();

  return {
    user: {
      id:          user._id.toString(),
      name:        user.name,
      email:       user.email,
      isVerified:  user.isVerified,
      isSuperAdmin: user.isSuperAdmin,
      status:      user.status,
      createdAt:   user.createdAt,
      updatedAt:   user.updatedAt,
    },
    memberships: memberships.map((m) => ({
      membershipId: m._id.toString(),
      role:         m.role,
      org: m.organizationId ? {
        id:   m.organizationId._id.toString(),
        name: m.organizationId.name,
        slug: m.organizationId.slug,
        plan: m.organizationId.plan,
      } : null,
    })),
  };
}

// ─── Suspend / Unsuspend User ─────────────────────────────────────────────────
export async function suspendUser(userId: string, suspend: boolean) {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw BadRequest('Invalid user ID');

  const user = await UserModel.findById(userId);
  if (!user) throw NotFound('User not found');
  if (user.isSuperAdmin) throw BadRequest('Cannot suspend a super admin account');

  user.status = suspend ? 'Suspended' : 'Active';
  await user.save();

  return { id: user._id.toString(), status: user.status };
}

// ─── Delete User ──────────────────────────────────────────────────────────────
export async function deleteUser(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) throw BadRequest('Invalid user ID');

  const user = await UserModel.findById(userId);
  if (!user) throw NotFound('User not found');
  if (user.isSuperAdmin) throw BadRequest('Cannot delete a super admin account');

  // Remove memberships, then the user
  await MembershipModel.deleteMany({ userId: user._id });
  await user.deleteOne();

  return { deleted: true, id: userId };
}

// ─── Plan Override ────────────────────────────────────────────────────────────
export async function overrideOrgPlan(
  orgId: string,
  plan: Plan,
  expiryDate: Date | null,
  saEmail: string
) {
  if (!mongoose.Types.ObjectId.isValid(orgId)) throw BadRequest('Invalid org ID');

  const org = await OrganizationModel.findById(orgId);
  if (!org) throw NotFound('Organisation not found');

  const oldPlan = org.plan;

  org.plan             = plan;
  org.planOverride     = plan;
  org.planOverrideExpiry = expiryDate;
  org.planOverrideBy   = saEmail;
  org.planOverrideAt   = new Date();
  await org.save();

  return {
    id:      org._id.toString(),
    name:    org.name,
    plan:    org.plan,
    oldPlan,
    planOverrideExpiry: org.planOverrideExpiry,
  };
}

export async function revertOrgPlanOverride(orgId: string) {
  if (!mongoose.Types.ObjectId.isValid(orgId)) throw BadRequest('Invalid org ID');

  const org = await OrganizationModel.findById(orgId);
  if (!org) throw NotFound('Organisation not found');
  if (!org.planOverride) throw BadRequest('No active override on this org');

  // Revert plan to 'free' if no Stripe subscription, else keep current (Stripe will reconcile)
  if (!org.stripeSubscriptionId) org.plan = 'free';

  org.planOverride       = undefined;
  org.planOverrideExpiry = undefined;
  org.planOverrideBy     = undefined;
  org.planOverrideAt     = undefined;
  await org.save();

  return { id: org._id.toString(), name: org.name, plan: org.plan };
}

// ─── Billing Dashboard ────────────────────────────────────────────────────────
export async function getBillingDashboard() {
  // Plan breakdown + MRR
  const planBreakdown = await OrganizationModel.aggregate([
    { $group: { _id: '$plan', count: { $sum: 1 } } },
  ]);
  let mrr = 0;
  let paidOrgs = 0;
  const plans: Record<string, number> = { free: 0, starter: 0, growth: 0, enterprise: 0 };
  planBreakdown.forEach((p) => {
    if (p._id) plans[p._id] = p.count;
    const monthly = PLAN_MRR[p._id] ?? 0;
    mrr += monthly * p.count;
    if (monthly > 0) paidOrgs += p.count;
  });
  const arpu = paidOrgs > 0 ? Math.round(mrr / paidOrgs) : 0;

  // Top orgs by call volume (30 days)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const topOrgsByVolume = await CallModel.aggregate([
    { $match: { createdAt: { $gte: since30d } } },
    { $group: { _id: '$organizationId', callCount: { $sum: 1 }, totalDuration: { $sum: '$duration' } } },
    { $sort: { callCount: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'organizations', localField: '_id', foreignField: '_id', as: 'org',
      },
    },
    { $unwind: { path: '$org', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1, callCount: 1, totalDuration: 1,
        orgId: '$org._id', orgName: '$org.name', orgPlan: '$org.plan',
      },
    },
  ]);

  // Recently "churned" orgs (plan = free with a past Stripe subscription, updated last 30d)
  const recentlyChurned = await OrganizationModel.find({
    plan: 'free',
    stripeSubscriptionId: { $exists: true, $ne: '' },
    updatedAt: { $gte: since30d },
  })
    .sort({ updatedAt: -1 })
    .limit(10)
    .select('name slug plan updatedAt stripeSubscriptionId')
    .lean();

  // Active plan overrides
  const activeOverrides = await OrganizationModel.find({
    planOverride: { $exists: true },
  })
    .sort({ planOverrideAt: -1 })
    .limit(20)
    .select('name slug plan planOverride planOverrideExpiry planOverrideBy planOverrideAt')
    .lean();

  // All orgs for plan-override picker (name + id + current plan)
  const allOrgs = await OrganizationModel.find()
    .sort({ name: 1 })
    .select('name slug plan planOverride')
    .lean();

  return {
    mrr,
    arr: mrr * 12,
    paidOrgs,
    arpu,
    plans,
    topOrgsByVolume,
    recentlyChurned,
    activeOverrides,
    allOrgs,
  };
}

// ─── Platform Analytics ───────────────────────────────────────────────────────
export async function getPlatformAnalytics(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Calls per day + status + direction
  const callsPerDay = await CallModel.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total:         { $sum: 1 },
        failed:        { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        completed:     { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        inbound:       { $sum: { $cond: [{ $eq: ['$direction', 'Inbound'] }, 1, 0] } },
        outbound:      { $sum: { $cond: [{ $eq: ['$direction', 'Outbound'] }, 1, 0] } },
        totalDuration: { $sum: '$duration' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // New sign-ups per day (org creation)
  const signupsPerDay = await OrganizationModel.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Summary totals
  const [totalCallsRange, failedCallsRange, totalOrgsRange] = await Promise.all([
    CallModel.countDocuments({ createdAt: { $gte: since } }),
    CallModel.countDocuments({ createdAt: { $gte: since }, status: 'failed' }),
    OrganizationModel.countDocuments({ createdAt: { $gte: since } }),
  ]);

  const avgDurationResult = await CallModel.aggregate([
    { $match: { createdAt: { $gte: since }, status: 'completed' } },
    { $group: { _id: null, avg: { $avg: '$duration' } } },
  ]);
  const avgDuration = Math.round(avgDurationResult[0]?.avg ?? 0);

  // Direction breakdown
  const directionBreakdown = await CallModel.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$direction', count: { $sum: 1 } } },
  ]);

  // Onboarding funnel (all-time, current state)
  const funnelStages = await OrganizationModel.aggregate([
    { $group: { _id: '$onboardingStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Trial → paid conversion (orgs that moved from free to a paid plan)
  const paidOrgs  = await OrganizationModel.countDocuments({ plan: { $ne: 'free' } });
  const totalOrgs = await OrganizationModel.countDocuments();
  const conversionRate = totalOrgs > 0 ? Math.round((paidOrgs / totalOrgs) * 100) : 0;

  return {
    callsPerDay,
    signupsPerDay,
    totalCallsRange,
    failedCallsRange,
    avgDuration,
    totalOrgsRange,
    directionBreakdown,
    funnelStages,
    conversionRate,
    paidOrgs,
    totalOrgs,
  };
}

// ─── Revenue Analytics ────────────────────────────────────────────────────────
export async function getRevenueAnalytics() {
  // Plan distribution + per-plan MRR
  const planBreakdown = await OrganizationModel.aggregate([
    { $group: { _id: '$plan', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  let totalMrr = 0;
  let paidOrgs = 0;
  const revenueByPlan = planBreakdown.map((p) => {
    const monthlyPrice = PLAN_MRR[p._id] ?? 0;
    const planMrr      = monthlyPrice * p.count;
    totalMrr += planMrr;
    if (monthlyPrice > 0) paidOrgs += p.count;
    return { plan: p._id, count: p.count, unitPrice: monthlyPrice, mrr: planMrr };
  });

  const arpu = paidOrgs > 0 ? Math.round(totalMrr / paidOrgs) : 0;
  // Simple LTV estimate: ARPU / estimated monthly churn rate (assume 5% = industry average for SMB SaaS)
  const ltv = arpu > 0 ? Math.round(arpu / 0.05) : 0;

  // MRR growth by month (last 12 months) — approximation based on org sign-ups + plan at time of query
  // We group paid-plan orgs by creation month and compute cumulative MRR added each month
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const mrrByMonth = await OrganizationModel.aggregate([
    { $match: { plan: { $ne: 'free' }, createdAt: { $gte: twelveMonthsAgo } } },
    {
      $group: {
        _id:        { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        starter:    { $sum: { $cond: [{ $eq: ['$plan', 'starter'] },    PLAN_MRR.starter,    0] } },
        growth:     { $sum: { $cond: [{ $eq: ['$plan', 'growth'] },     PLAN_MRR.growth,     0] } },
        enterprise: { $sum: { $cond: [{ $eq: ['$plan', 'enterprise'] }, PLAN_MRR.enterprise, 0] } },
        newOrgs:    { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    totalMrr,
    arr:  totalMrr * 12,
    arpu,
    ltv,
    paidOrgs,
    revenueByPlan,
    mrrByMonth,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — COMMUNICATIONS + POLISH
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Broadcast Email ──────────────────────────────────────────────────────────

export type BroadcastAudience =
  | { type: 'all' }
  | { type: 'plan'; plan: string }
  | { type: 'org'; orgId: string };

export interface BroadcastEmailResult {
  sent:    number;
  skipped: number;
  preview: string[];  // first 5 recipient emails for SA preview
}

/**
 * Send a broadcast email to a targeted audience via Resend.
 * Batches in groups of 50 to avoid Resend rate limits.
 * Returns count of sent/skipped and a preview of first 5 recipients.
 */
export async function broadcastEmail(
  audience: BroadcastAudience,
  subject:  string,
  htmlBody: string,
  saEmail:  string,
): Promise<BroadcastEmailResult> {
  // 1. Resolve target user emails
  let emails: string[] = [];

  if (audience.type === 'all') {
    const users = await UserModel.find({ isActive: { $ne: false } }).select('email').lean();
    emails = users.map(u => u.email).filter(Boolean) as string[];
  } else if (audience.type === 'plan') {
    const orgs = await OrganizationModel.find({ plan: audience.plan }).select('_id').lean();
    const orgIds = orgs.map(o => o._id);
    const memberships = await MembershipModel.find({ orgId: { $in: orgIds } }).select('userId').lean();
    const userIds = [...new Set(memberships.map(m => String(m.userId)))];
    const users = await UserModel.find({ _id: { $in: userIds }, isActive: { $ne: false } }).select('email').lean();
    emails = users.map(u => u.email).filter(Boolean) as string[];
  } else {
    // audience.type === 'org'
    const memberships = await MembershipModel.find({ orgId: audience.orgId }).select('userId').lean();
    const userIds = memberships.map(m => m.userId);
    const users = await UserModel.find({ _id: { $in: userIds }, isActive: { $ne: false } }).select('email').lean();
    emails = users.map(u => u.email).filter(Boolean) as string[];
  }

  if (emails.length === 0) {
    return { sent: 0, skipped: 0, preview: [] };
  }

  // 2. Wrap body in branded email shell
  const wrappedHtml = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc;">
      <div style="background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
        <div style="margin-bottom: 24px;">
          <span style="font-size: 12px; font-weight: 800; color: #6366f1; letter-spacing: 0.08em; text-transform: uppercase;">
            AgentOps Studio
          </span>
        </div>
        ${htmlBody}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          You're receiving this because you have an account on AgentOps Studio.
          This message was sent by ${saEmail}.
        </p>
      </div>
    </body>
    </html>
  `;

  // 3. Send in batches of 50
  const BATCH = 50;
  let sent = 0;
  let skipped = 0;

  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map(async (email) => {
        try {
          await sendEmail({ to: email, subject, html: wrappedHtml });
          sent++;
        } catch {
          skipped++;
        }
      }),
    );
  }

  return {
    sent,
    skipped,
    preview: emails.slice(0, 5),
  };
}

// ─── Org Ownership Transfer ───────────────────────────────────────────────────

export async function transferOrgOwnership(
  orgId:      string,
  newOwnerId: string,
  saEmail:    string,
): Promise<{ orgName: string; previousOwner: string; newOwner: string }> {
  const org = await OrganizationModel.findById(orgId);
  if (!org) throw NotFound('Organization');

  const newOwner = await UserModel.findById(newOwnerId);
  if (!newOwner) throw NotFound('User');

  // Verify new owner is a member of the org
  const membership = await MembershipModel.findOne({ orgId, userId: newOwnerId });
  if (!membership) {
    throw BadRequest('New owner must be an existing member of the organisation');
  }

  // Fetch old owner info for the audit record
  const oldOwner = await UserModel.findById(org.ownerId).select('email').lean();

  // Begin updates
  const previousOwnerId = org.ownerId;

  // 1. Downgrade old owner membership to Member (if a membership exists)
  await MembershipModel.findOneAndUpdate(
    { orgId, userId: previousOwnerId },
    { role: 'Member' },
  );

  // 2. Upgrade new owner membership to Owner
  await MembershipModel.findOneAndUpdate(
    { orgId, userId: newOwnerId },
    { role: 'Owner' },
  );

  // 3. Update org.ownerId
  org.ownerId = new mongoose.Types.ObjectId(newOwnerId) as mongoose.Types.ObjectId;
  await org.save();

  return {
    orgName:       org.name,
    previousOwner: oldOwner?.email ?? String(previousOwnerId),
    newOwner:      newOwner.email,
  };
}

// ─── Admin Access Log (for customer Settings page) ───────────────────────────

export interface AdminAccessEntry {
  timestamp: Date;
  action:    string;
  label:     string;
}

/**
 * Returns SA impersonation events for a specific org.
 * We deliberately exclude the SA email for privacy — customers
 * see WHEN someone accessed their org, not WHO.
 */
export async function getAdminAccessLog(orgId: string, limit = 20): Promise<AdminAccessEntry[]> {
  // Lazy import to avoid circular dep (audit model → controller → service loop)
  const { SuperAdminLogModel } = await import('./superadmin-audit.model');

  const logs = await SuperAdminLogModel.find({
    targetId: orgId,
    action: { $in: ['SA_ORG_IMPERSONATE', 'SA_ORG_VIEW', 'SA_ORG_EXIT_IMPERSONATION'] },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('action createdAt')
    .lean();

  const LABELS: Record<string, string> = {
    SA_ORG_IMPERSONATE:       'Admin accessed your account',
    SA_ORG_EXIT_IMPERSONATION:'Admin session ended',
    SA_ORG_VIEW:              'Admin viewed org details',
  };

  return logs.map(l => ({
    timestamp: l.createdAt as Date,
    action:    l.action,
    label:     LABELS[l.action] ?? 'Admin action',
  }));
}
