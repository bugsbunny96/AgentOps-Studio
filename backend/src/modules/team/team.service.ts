/**
 * Team Service
 *
 * Manages org membership and email invitations.
 *
 * Role model (2-tier):
 *   Owner  — full access; exactly one per org; cannot be removed.
 *   Member — configurable per-section access set by the Owner.
 *
 * Member permissions (Owner can set at invite time and edit after join):
 *   agents:        access to the Agents page
 *   calls:         access to the Calls page
 *   knowledgeBase: access to the Knowledge Base page
 *   (Dashboard is always visible; Settings + Team are always Owner-only)
 *
 * Authorization matrix:
 *   invite:             Owner only (invitations carry permissions snapshot)
 *   resend/revoke:      Owner only
 *   updatePermissions:  Owner only (edit a Member's access after they join)
 *   removeMember:       Owner only (cannot remove self or other Owners)
 *   accept:             Any authenticated user whose email matches the invitation
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  MembershipModel,
  InvitationModel,
  OrganizationModel,
  DEFAULT_MEMBER_PERMISSIONS,
  type IMemberPermissions,
  type Plan,
} from '../organization/organization.model';
import { UserModel } from '../auth/auth.model';
import { sendEmail } from '../../utils/email';
import { env } from '../../config/env';
import { NotFound, BadRequest, Forbidden } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { PLAN_LIMITS } from '../billing/billing.service';
import { computeTrialState } from '../billing/trial.service';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Resolve org + caller's membership in one round-trip. */
async function resolveCallerMembership(userId: string) {
  const membership = await MembershipModel
    .findOne({ userId })
    .populate<{ organizationId: { _id: mongoose.Types.ObjectId; name: string } }>('organizationId')
    .lean();

  if (!membership) throw NotFound('Organization membership');

  const org   = membership.organizationId as { _id: mongoose.Types.ObjectId; name: string };
  const orgId = org._id;

  return { membership, org, orgId };
}

/** Generate a secure 32-byte hex token. */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Build a human-readable permissions summary for emails. */
function permissionsSummary(p: IMemberPermissions): string {
  const sections: string[] = ['Dashboard (read-only)'];
  if (p.agents)        sections.push('Agents');
  if (p.calls)         sections.push('Calls & Transcripts');
  if (p.knowledgeBase) sections.push('Knowledge Base');
  return sections.join(', ');
}

/** Send the invite email. */
async function sendInviteEmail(opts: {
  toEmail:     string;
  inviterName: string;
  orgName:     string;
  permissions: IMemberPermissions;
  token:       string;
}): Promise<void> {
  const acceptUrl = `${env.CLIENT_URL}/accept-invite/${opts.token}`;

  if (env.NODE_ENV !== 'production') {
    logger.info(`[DEV] 📧 Invite URL for ${opts.toEmail}: ${acceptUrl}`);
  }

  await sendEmail({
    to:      opts.toEmail,
    subject: `You've been invited to join ${opts.orgName} on AgentOps Studio`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e1b4b;">You're invited to ${opts.orgName}</h2>
        <p style="color: #374151;">
          <strong>${opts.inviterName}</strong> has invited you to collaborate on
          <strong>${opts.orgName}</strong> as a <strong>Member</strong>.
        </p>
        <p style="color: #374151; font-size: 14px;">
          <strong>Your access:</strong> ${permissionsSummary(opts.permissions)}
        </p>
        <a href="${acceptUrl}"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;
                  text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0;">
          Accept Invitation
        </a>
        <p style="color: #6b7280; font-size: 14px;">This invitation expires in <strong>7 days</strong>.</p>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color: #9ca3af; font-size: 12px;">AgentOps Studio — AI Voice Agent Operations Platform</p>
      </body>
      </html>
    `,
  });
}

/** Validate and normalise a permissions object from request body. */
function parsePermissions(raw: unknown): IMemberPermissions {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MEMBER_PERMISSIONS };
  const p = raw as Record<string, unknown>;
  return {
    agents:        typeof p['agents']        === 'boolean' ? p['agents']        : DEFAULT_MEMBER_PERMISSIONS.agents,
    calls:         typeof p['calls']         === 'boolean' ? p['calls']         : DEFAULT_MEMBER_PERMISSIONS.calls,
    knowledgeBase: typeof p['knowledgeBase'] === 'boolean' ? p['knowledgeBase'] : DEFAULT_MEMBER_PERMISSIONS.knowledgeBase,
    team:          typeof p['team']          === 'boolean' ? p['team']          : DEFAULT_MEMBER_PERMISSIONS.team,
  };
}

// ─── listTeam ─────────────────────────────────────────────────────────────────

export interface TeamMember {
  membershipId: string;
  userId:       string;
  name:         string;
  email:        string;
  role:         'Owner' | 'Member';
  permissions:  IMemberPermissions;
  joinedAt:     Date;
}

export interface PendingInvitation {
  id:          string;
  email:       string;
  role:        'Member';
  permissions: IMemberPermissions;
  expiresAt:   Date;
  createdAt:   Date;
}

export interface TeamData {
  members:         TeamMember[];
  invitations:     PendingInvitation[];
  currentUserId:   string;
  currentUserRole: 'Owner' | 'Member';
}

export async function listTeam(userId: string): Promise<TeamData> {
  const { orgId } = await resolveCallerMembership(userId);

  // All memberships for the org, joined with user data
  const memberships = await MembershipModel
    .find({ organizationId: orgId })
    .sort({ createdAt: 1 })
    .lean();

  // Bulk fetch users for all membership user IDs
  const userIds = memberships.map((m) => m.userId);
  const users   = await UserModel.find({ _id: { $in: userIds } }, { name: 1, email: 1 }).lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const members: TeamMember[] = memberships
    .map((m) => {
      const user = userMap.get(m.userId.toString());
      if (!user) return null;
      return {
        membershipId: m._id.toString(),
        userId:       m.userId.toString(),
        name:         user.name,
        email:        user.email,
        role:         m.role,
        permissions:  m.permissions ?? { ...DEFAULT_MEMBER_PERMISSIONS },
        joinedAt:     m.createdAt,
      };
    })
    .filter((m): m is TeamMember => m !== null);

  // Pending (non-expired) invitations
  const rawInvites = await InvitationModel
    .find({ organizationId: orgId, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();

  const invitations: PendingInvitation[] = rawInvites.map((inv) => ({
    id:          inv._id.toString(),
    email:       inv.email,
    role:        inv.role,
    permissions: inv.permissions ?? { ...DEFAULT_MEMBER_PERMISSIONS },
    expiresAt:   inv.expiresAt,
    createdAt:   inv.createdAt,
  }));

  // Caller's role
  const callerMembership = memberships.find((m) => m.userId.toString() === userId);
  const currentUserRole  = callerMembership?.role ?? 'Member';

  return { members, invitations, currentUserId: userId, currentUserRole };
}

// ─── inviteMember ─────────────────────────────────────────────────────────────

export async function inviteMember(
  userId: string,
  dto: { email: string; permissions?: unknown },
): Promise<PendingInvitation> {
  const { membership, org, orgId } = await resolveCallerMembership(userId);

  // Only Owners can invite
  if (membership.role !== 'Owner') {
    throw Forbidden('Only Owners can send invitations');
  }

  const email = dto.email.trim().toLowerCase();
  if (!email) throw BadRequest('Email is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw BadRequest('Invalid email address');

  // Check existing member with that email
  const existingUser = await UserModel.findOne({ email }).lean();
  if (existingUser) {
    const existingMembership = await MembershipModel.findOne({
      userId:         existingUser._id,
      organizationId: orgId,
    }).lean();
    if (existingMembership) throw BadRequest('This user is already a team member');
  }

  // Check existing non-expired invitation
  const existingInvite = await InvitationModel.findOne({
    email,
    organizationId: orgId,
    expiresAt:      { $gt: new Date() },
  }).lean();
  if (existingInvite) throw BadRequest('A pending invitation for this email already exists');

  // ── Plan limit check (trial-aware) ──────────────────────────────────
  const orgDoc = await OrganizationModel
    .findById(orgId, { plan: 1, trialUsed: 1, trialEndsAt: 1 })
    .lean() as { plan?: Plan; trialUsed?: boolean; trialEndsAt?: Date } | null;
  const plan: Plan = orgDoc?.plan ?? 'free';
  const trial      = computeTrialState(plan, orgDoc?.trialUsed ?? false, orgDoc?.trialEndsAt);
  const effectivePlan: Plan = trial.isInTrial ? 'growth' : plan;
  const memberLimit   = PLAN_LIMITS[effectivePlan].teamMembers;
  if (memberLimit !== Infinity) {
    const [membersCount, pendingCount] = await Promise.all([
      MembershipModel.countDocuments({ organizationId: orgId, role: 'Member' }),
      InvitationModel.countDocuments({ organizationId: orgId, expiresAt: { $gt: new Date() } }),
    ]);
    if (membersCount + pendingCount >= memberLimit) {
      const upgradeMsg = trial.isTrialExpired
        ? 'Your free trial has ended. Upgrade to invite additional team members.'
        : `Your ${effectivePlan} plan allows up to ${memberLimit} additional team member${memberLimit === 1 ? '' : 's'}. Upgrade your plan to invite more.`;
      throw Forbidden(upgradeMsg, 'TEAM_PLAN_LIMIT_REACHED');
    }
  }

  const inviterName   = (await UserModel.findById(userId, { name: 1 }).lean())?.name ?? 'A team member';
  const permissions   = parsePermissions(dto.permissions);
  const token         = generateToken();
  const expiresAt     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await InvitationModel.create({
    email,
    organizationId: orgId,
    role:           'Member',
    permissions,
    token,
    expiresAt,
  });

  await sendInviteEmail({ toEmail: email, inviterName, orgName: org.name, permissions, token });

  logger.info('Invitation sent', { orgId: orgId.toString(), email, permissions });

  return {
    id:          invitation._id.toString(),
    email:       invitation.email,
    role:        invitation.role,
    permissions: invitation.permissions,
    expiresAt:   invitation.expiresAt,
    createdAt:   invitation.createdAt,
  };
}

// ─── resendInvitation ─────────────────────────────────────────────────────────

export async function resendInvitation(userId: string, invitationId: string): Promise<void> {
  const { membership, org } = await resolveCallerMembership(userId);

  if (membership.role !== 'Owner') {
    throw Forbidden('Only Owners can resend invitations');
  }

  const invitation = await InvitationModel.findById(invitationId);
  if (!invitation) throw NotFound('Invitation');

  // Verify it belongs to the caller's org
  if (invitation.organizationId.toString() !== org._id.toString()) {
    throw Forbidden('Invitation does not belong to your organization');
  }

  // Refresh token + extend expiry (permissions are preserved)
  invitation.token     = generateToken();
  invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await invitation.save();

  const inviterName = (await UserModel.findById(userId, { name: 1 }).lean())?.name ?? 'A team member';

  await sendInviteEmail({
    toEmail:     invitation.email,
    inviterName,
    orgName:     org.name,
    permissions: invitation.permissions ?? { ...DEFAULT_MEMBER_PERMISSIONS },
    token:       invitation.token,
  });

  logger.info('Invitation resent', { invitationId, email: invitation.email });
}

// ─── revokeInvitation ─────────────────────────────────────────────────────────

export async function revokeInvitation(userId: string, invitationId: string): Promise<void> {
  const { membership, org } = await resolveCallerMembership(userId);

  if (membership.role !== 'Owner') {
    throw Forbidden('Only Owners can revoke invitations');
  }

  const invitation = await InvitationModel.findById(invitationId);
  if (!invitation) throw NotFound('Invitation');

  if (invitation.organizationId.toString() !== org._id.toString()) {
    throw Forbidden('Invitation does not belong to your organization');
  }

  await InvitationModel.deleteOne({ _id: invitationId });
  logger.info('Invitation revoked', { invitationId, email: invitation.email });
}

// ─── updateMemberPermissions ──────────────────────────────────────────────────

export async function updateMemberPermissions(
  userId:       string,
  membershipId: string,
  dto:          { permissions: unknown },
): Promise<TeamMember> {
  const { membership, orgId } = await resolveCallerMembership(userId);

  if (membership.role !== 'Owner') {
    throw Forbidden('Only Owners can update member permissions');
  }

  const target = await MembershipModel
    .findOne({ _id: membershipId, organizationId: orgId })
    .lean();

  if (!target) throw NotFound('Team member');

  // Cannot change Owner permissions (Owners always have full access)
  if (target.role === 'Owner') {
    throw BadRequest('Owner permissions cannot be modified');
  }

  const permissions = parsePermissions(dto.permissions);

  const updated = await MembershipModel.findByIdAndUpdate(
    membershipId,
    { $set: { permissions } },
    { new: true },
  ).lean();

  if (!updated) throw NotFound('Team member');

  const user = await UserModel.findById(updated.userId, { name: 1, email: 1 }).lean();

  logger.info('Member permissions updated', {
    membershipId,
    permissions,
    orgId: orgId.toString(),
  });

  return {
    membershipId: updated._id.toString(),
    userId:       updated.userId.toString(),
    name:         user?.name ?? '',
    email:        user?.email ?? '',
    role:         updated.role,
    permissions:  updated.permissions ?? { ...DEFAULT_MEMBER_PERMISSIONS },
    joinedAt:     updated.createdAt,
  };
}

// ─── removeMember ────────────────────────────────────────────────────────────

export async function removeMember(userId: string, membershipId: string): Promise<void> {
  const { membership, orgId } = await resolveCallerMembership(userId);

  if (membership.role !== 'Owner') {
    throw Forbidden('Only Owners can remove members');
  }

  const target = await MembershipModel
    .findOne({ _id: membershipId, organizationId: orgId })
    .lean();

  if (!target) throw NotFound('Team member');

  if (target.userId.toString() === userId) {
    throw BadRequest('You cannot remove yourself from the team');
  }

  if (target.role === 'Owner') {
    throw BadRequest('The Owner cannot be removed from the team');
  }

  await MembershipModel.deleteOne({ _id: membershipId });
  logger.info('Member removed', { membershipId, orgId: orgId.toString() });
}

// ─── acceptInvitation ────────────────────────────────────────────────────────

export async function acceptInvitation(
  userId: string,
  token:  string,
): Promise<{ orgId: string; orgName: string }> {
  const invitation = await InvitationModel
    .findOne({ token })
    .populate<{ organizationId: { _id: mongoose.Types.ObjectId; name: string } }>('organizationId')
    .lean();

  if (!invitation) throw BadRequest('Invalid or expired invitation link');
  if (invitation.expiresAt < new Date()) throw BadRequest('This invitation has expired');

  const user = await UserModel.findById(userId, { email: 1 }).lean();
  if (!user) throw NotFound('User');

  if (user.email !== invitation.email) {
    throw Forbidden(
      `This invitation was sent to ${invitation.email}. ` +
      `Please sign in with that email address to accept it.`
    );
  }

  const org   = invitation.organizationId as { _id: mongoose.Types.ObjectId; name: string };
  const orgId = org._id;

  // Idempotent — if membership already exists, return success
  const existing = await MembershipModel.findOne({ userId, organizationId: orgId }).lean();
  if (existing) {
    await InvitationModel.deleteOne({ token });
    return { orgId: orgId.toString(), orgName: org.name };
  }

  // Copy permissions from the invitation to the new membership
  await MembershipModel.create({
    userId,
    organizationId: orgId,
    role:           'Member',
    permissions:    invitation.permissions ?? { ...DEFAULT_MEMBER_PERMISSIONS },
  });

  await InvitationModel.deleteOne({ token });

  logger.info('Invitation accepted', {
    userId,
    orgId:       orgId.toString(),
    permissions: invitation.permissions,
  });

  return { orgId: orgId.toString(), orgName: org.name };
}

// ─── getInviteInfo (public — no auth required) ───────────────────────────────

export async function getInviteInfo(token: string): Promise<{
  email:       string;
  orgName:     string;
  role:        'Member';
  permissions: IMemberPermissions;
}> {
  const invitation = await InvitationModel
    .findOne({ token })
    .populate<{ organizationId: { name: string } }>('organizationId', 'name')
    .lean();

  if (!invitation)                       throw BadRequest('Invalid or expired invitation link');
  if (invitation.expiresAt < new Date()) throw BadRequest('This invitation has expired');

  const org = invitation.organizationId as { name: string };

  return {
    email:       invitation.email,
    orgName:     org.name,
    role:        invitation.role,
    permissions: invitation.permissions ?? { ...DEFAULT_MEMBER_PERMISSIONS },
  };
}
