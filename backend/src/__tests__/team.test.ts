/**
 * L2.F4 — Team Module Integration Tests
 *
 * Routes under test (mounted at /api/v1/team):
 *   GET    /                         — list members + pending invitations
 *   POST   /invite                   — send invitation (Owner only)
 *   POST   /invitations/:id/resend   — resend invitation (Owner only)
 *   DELETE /invitations/:id          — revoke invitation (Owner only)
 *   PATCH  /members/:id/permissions  — update member permissions (Owner only)
 *   DELETE /members/:id              — remove member (Owner only)
 *   POST   /accept/:token            — accept invitation
 *   GET    /invite-info/:token       — public — returns email + orgName + role
 *
 * Auth strategy: create users directly via UserModel + signAccessToken (no HTTP round-trip).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import {
  OrganizationModel,
  MembershipModel,
  InvitationModel,
  DEFAULT_MEMBER_PERMISSIONS,
} from '@/modules/organization/organization.model';
import { signAccessToken } from '@/utils/jwt';

// ── Redis mock ───────────────────────────────────────────────────────────────
const redisStore = new Map<string, string>();

vi.mock('@/config/redis', () => ({
  redis: {
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      redisStore.set(key, value);
      return Promise.resolve('OK');
    }),
    get: vi.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    del: vi.fn((key: string) => {
      redisStore.delete(key);
      return Promise.resolve(1);
    }),
  },
}));

// ── Email mock ───────────────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file by Vitest, so references to outer
// const variables would be in the TDZ at hoist time. Use vi.hoisted() instead.
const { mockSendEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/email', () => ({
  sendEmail: mockSendEmail,
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createOwnerWithOrg(suffix: string | number = Date.now()) {
  const user = await UserModel.create({
    name: 'Owner User',
    email: `owner-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified: true,
    status: 'Active',
  });
  const org = await OrganizationModel.create({
    name: 'Test Org',
    slug: `test-org-${suffix}`,
    ownerId: user._id,
    industry: 'Technology',
    timezone: 'Asia/Kolkata',
    onboardingStatus: 'COMPLETED',
    businessHours: { start: '09:00', end: '18:00' },
  });
  await MembershipModel.create({
    userId: user._id,
    organizationId: org._id,
    role: 'Owner',
  });
  const token = signAccessToken({ userId: user._id.toString(), email: user.email });
  return { user, org, cookie: `accessToken=${token}` };
}

async function createMemberInOrg(
  orgId: unknown,
  suffix: string | number = Date.now(),
) {
  const user = await UserModel.create({
    name: 'Member User',
    email: `member-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified: true,
    status: 'Active',
  });
  const membership = await MembershipModel.create({
    userId: user._id,
    organizationId: orgId,
    role: 'Member',
    permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
  });
  const token = signAccessToken({ userId: user._id.toString(), email: user.email });
  return { user, membership, cookie: `accessToken=${token}` };
}

async function createPendingInvite(orgId: unknown, email: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return InvitationModel.create({
    email,
    organizationId: orgId,
    role: 'Member',
    permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
    token: `test-token-${Math.random().toString(36).slice(2)}`,
    expiresAt,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Team Module', () => {
  describe('GET /api/v1/team — list team', () => {
    it('returns members and pending invitations for the org', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      await createMemberInOrg(org._id, ts);
      await createPendingInvite(org._id, `invite-${ts}@example.com`);

      const res = await request(app)
        .get('/api/v1/team')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.members).toHaveLength(2); // owner + member
      expect(res.body.data.invitations).toHaveLength(1);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/team');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/team/invite — invite member', () => {
    it('creates an invitation and sends an email', async () => {
      const ts = Date.now();
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Cookie', cookie)
        .send({ email: `newmember-${ts}@example.com` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledOnce();

      // invitation is persisted
      const inv = await InvitationModel.findOne({ email: `newmember-${ts}@example.com` });
      expect(inv).not.toBeNull();
    });

    it('rejects duplicate invite for same email', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      await createPendingInvite(org._id, `dup-${ts}@example.com`);

      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Cookie', cookie)
        .send({ email: `dup-${ts}@example.com` });

      expect(res.status).toBe(409);
    });

    it('rejects invite if user is already a member', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      const { user: member } = await createMemberInOrg(org._id, ts);

      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Cookie', cookie)
        .send({ email: member.email });

      expect(res.status).toBe(409);
    });

    it('returns 403 when a Member tries to invite', async () => {
      const ts = Date.now();
      const { org } = await createOwnerWithOrg(ts);
      const { cookie: memberCookie } = await createMemberInOrg(org._id, ts);

      const res = await request(app)
        .post('/api/v1/team/invite')
        .set('Cookie', memberCookie)
        .send({ email: `anyone-${ts}@example.com` });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/team/invitations/:id/resend — resend invitation', () => {
    it('refreshes token and resends email', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      const invite = await createPendingInvite(org._id, `resend-${ts}@example.com`);
      const oldToken = invite.token;

      const res = await request(app)
        .post(`/api/v1/team/invitations/${invite._id}/resend`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledOnce();

      const updated = await InvitationModel.findById(invite._id);
      expect(updated!.token).not.toBe(oldToken);
    });

    it('returns 404 for non-existent invitation', async () => {
      const ts = Date.now();
      const { cookie } = await createOwnerWithOrg(ts);
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .post(`/api/v1/team/invitations/${fakeId}/resend`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/team/invitations/:id — revoke invitation', () => {
    it('deletes the invitation', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      const invite = await createPendingInvite(org._id, `revoke-${ts}@example.com`);

      const res = await request(app)
        .delete(`/api/v1/team/invitations/${invite._id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const deleted = await InvitationModel.findById(invite._id);
      expect(deleted).toBeNull();
    });

    it('returns 403 when a Member tries to revoke', async () => {
      const ts = Date.now();
      const { org } = await createOwnerWithOrg(ts);
      const { cookie: memberCookie } = await createMemberInOrg(org._id, ts);
      const invite = await createPendingInvite(org._id, `mrevoke-${ts}@example.com`);

      const res = await request(app)
        .delete(`/api/v1/team/invitations/${invite._id}`)
        .set('Cookie', memberCookie);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/team/members/:id/permissions — update permissions', () => {
    it('updates member permissions', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      const { membership } = await createMemberInOrg(org._id, ts);

      const res = await request(app)
        .patch(`/api/v1/team/members/${membership._id}/permissions`)
        .set('Cookie', cookie)
        .send({ permissions: { agents: false, calls: true, knowledgeBase: false } });

      expect(res.status).toBe(200);

      const updated = await MembershipModel.findById(membership._id);
      expect(updated!.permissions.agents).toBe(false);
      expect(updated!.permissions.calls).toBe(true);
    });

    it('returns 403 when a Member tries to update permissions', async () => {
      const ts = Date.now();
      const { org } = await createOwnerWithOrg(ts);
      const { membership, cookie: memberCookie } = await createMemberInOrg(org._id, ts);

      const res = await request(app)
        .patch(`/api/v1/team/members/${membership._id}/permissions`)
        .set('Cookie', memberCookie)
        .send({ permissions: { agents: false, calls: false, knowledgeBase: false } });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/team/members/:id — remove member', () => {
    it('removes a member from the org', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      const { membership } = await createMemberInOrg(org._id, ts);

      const res = await request(app)
        .delete(`/api/v1/team/members/${membership._id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const removed = await MembershipModel.findById(membership._id);
      expect(removed).toBeNull();
    });

    it('cannot remove an Owner membership', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      // create a second Owner via direct DB insert
      const otherOwner = await UserModel.create({
        name: 'Other Owner',
        email: `owner2-${ts}@example.com`,
        passwordHash: '$2a$12$placeholder',
        isVerified: true,
        status: 'Active',
      });
      const ownerMembership = await MembershipModel.create({
        userId: otherOwner._id,
        organizationId: org._id,
        role: 'Owner',
      });

      const res = await request(app)
        .delete(`/api/v1/team/members/${ownerMembership._id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/team/accept/:token — accept invitation', () => {
    it('creates membership and deletes invitation on accept', async () => {
      const ts = Date.now();
      const { org } = await createOwnerWithOrg(ts);

      // create the invited user
      const invitedUser = await UserModel.create({
        name: 'Invited User',
        email: `invited-${ts}@example.com`,
        passwordHash: '$2a$12$placeholder',
        isVerified: true,
        status: 'Active',
      });
      const invitedToken = signAccessToken({
        userId: invitedUser._id.toString(),
        email: invitedUser.email,
      });

      const invite = await createPendingInvite(org._id, invitedUser.email);

      const res = await request(app)
        .post(`/api/v1/team/accept/${invite.token}`)
        .set('Cookie', `accessToken=${invitedToken}`);

      expect(res.status).toBe(200);

      const membership = await MembershipModel.findOne({ userId: invitedUser._id });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe('Member');

      const deletedInvite = await InvitationModel.findById(invite._id);
      expect(deletedInvite).toBeNull();
    });

    it('returns 403 if email does not match invitation', async () => {
      const ts = Date.now();
      const { org } = await createOwnerWithOrg(ts);
      const invite = await createPendingInvite(org._id, `invited-${ts}@example.com`);

      const wrongUser = await UserModel.create({
        name: 'Wrong User',
        email: `wrong-${ts}@example.com`,
        passwordHash: '$2a$12$placeholder',
        isVerified: true,
        status: 'Active',
      });
      const wrongToken = signAccessToken({
        userId: wrongUser._id.toString(),
        email: wrongUser.email,
      });

      const res = await request(app)
        .post(`/api/v1/team/accept/${invite.token}`)
        .set('Cookie', `accessToken=${wrongToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 for invalid or expired token', async () => {
      const ts = Date.now();
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .post('/api/v1/team/accept/nonexistent-token-xyz')
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/team/invite-info/:token — public invite info', () => {
    it('returns email, orgName, role without authentication', async () => {
      const ts = Date.now();
      const { org } = await createOwnerWithOrg(ts);
      const invite = await createPendingInvite(org._id, `info-${ts}@example.com`);

      const res = await request(app)
        .get(`/api/v1/team/invite-info/${invite.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(`info-${ts}@example.com`);
      expect(res.body.data.orgName).toBe('Test Org');
      expect(res.body.data.role).toBe('Member');
    });

    it('returns 404 for unknown token', async () => {
      const res = await request(app)
        .get('/api/v1/team/invite-info/bad-token-xyz');

      expect(res.status).toBe(404);
    });
  });
});
