/**
 * L2.F2.M2 — Middleware Integration Tests
 * Atomic Tasks: AT1–AT2
 *
 * Tests:
 *   AT1 — authenticate: reads accessToken cookie, verifies JWT, injects req.userId + req.userEmail
 *   AT2 — validateOrganization: reads X-Organization-ID, checks membership, injects req.orgId + req.userRole
 *
 * Uses a lightweight test Express app (not the full app) so middleware is tested in isolation
 * without rate limiters, CORS, or other production middleware.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

import { authenticate } from '@/middleware/authenticate';
import { validateOrganization } from '@/middleware/validateOrganization';
import { errorHandler } from '@/middleware/errorHandler';
import { signAccessToken } from '@/utils/jwt';
import { env } from '@/config/env';
import { UserModel } from '@/modules/auth/auth.model';
import { OrganizationModel, MembershipModel } from '@/modules/organization/organization.model';

// ── Redis mock (satisfy imports even though middleware doesn't use redis directly) ──
vi.mock('@/config/redis', () => ({
  redis: {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}));

// ── Test Express app ──────────────────────────────────────────────────────────
// Thin app: only the two middleware under test + a minimal response + global error handler.
function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Route: authenticate only
  app.get(
    '/test/auth-only',
    authenticate,
    (req: Request, res: Response) => {
      res.json({ userId: req.userId, userEmail: req.userEmail });
    },
  );

  // Route: authenticate → validateOrganization
  app.get(
    '/test/org-protected',
    authenticate,
    validateOrganization,
    (req: Request, res: Response) => {
      res.json({ userId: req.userId, orgId: req.orgId, userRole: req.userRole });
    },
  );

  // Global error handler (handles AppError + ZodError + CastError from middleware)
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    errorHandler(err, req, res, next);
  });

  return app;
}

const testApp = buildTestApp();

beforeEach(() => {
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// AT1 — authenticate middleware
// ═════════════════════════════════════════════════════════════════════════════
describe('authenticate middleware', () => {
  it('AT1.1 — injects req.userId and req.userEmail from a valid accessToken cookie', async () => {
    const user = await UserModel.create({
      name: 'Auth Test',
      email: `authtest-${Date.now()}@example.com`,
      passwordHash: '$2a$12$placeholder',
      isVerified: true,
      status: 'Active',
    });

    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
    });

    const res = await request(testApp)
      .get('/test/auth-only')
      .set('Cookie', `accessToken=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user._id.toString());
    expect(res.body.userEmail).toBe(user.email);
  });

  it('AT1.2 — 401 UNAUTHORIZED: no accessToken cookie at all', async () => {
    const res = await request(testApp).get('/test/auth-only');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AT1.3 — 401 INVALID_TOKEN: malformed cookie value (not a JWT)', async () => {
    const res = await request(testApp)
      .get('/test/auth-only')
      .set('Cookie', 'accessToken=this.is.not.a.jwt');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('AT1.4 — 401 INVALID_TOKEN: JWT signed with wrong secret', async () => {
    const fakeToken = jwt.sign(
      { userId: 'fake123', email: 'fake@example.com' },
      'wrong-secret-that-is-definitely-not-the-real-one-abcdefg',
      { expiresIn: '15m' },
    );

    const res = await request(testApp)
      .get('/test/auth-only')
      .set('Cookie', `accessToken=${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('AT1.5 — 401 INVALID_TOKEN: expired JWT', async () => {
    // Create a token that expired 1 second ago
    const expiredToken = jwt.sign(
      { userId: 'someid', email: 'user@example.com' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -1 }, // immediately expired
    );

    const res = await request(testApp)
      .get('/test/auth-only')
      .set('Cookie', `accessToken=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AT2 — validateOrganization middleware
// ═════════════════════════════════════════════════════════════════════════════
describe('validateOrganization middleware', () => {
  /**
   * Helper: create a user + org + membership, return an accessToken for that user.
   */
  async function setupOrgMember(role: 'Owner' | 'Admin' | 'Member' = 'Owner') {
    const user = await UserModel.create({
      name: 'Org Member',
      email: `orgmember-${Date.now()}@example.com`,
      passwordHash: '$2a$12$placeholder',
      isVerified: true,
      status: 'Active',
    });

    const org = await OrganizationModel.create({
      name: 'Test Organisation',
      slug: `test-org-${Date.now()}`,
      ownerId: user._id,
      industry: 'Technology',
    });

    await MembershipModel.create({
      userId: user._id,
      organizationId: org._id,
      role,
    });

    const token = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
    });

    return { user, org, token };
  }

  it('AT2.1 — injects req.orgId and req.userRole for a valid member', async () => {
    const { org, token } = await setupOrgMember('Admin');

    const res = await request(testApp)
      .get('/test/org-protected')
      .set('Cookie', `accessToken=${token}`)
      .set('X-Organization-ID', org._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.orgId).toBe(org._id.toString());
    expect(res.body.userRole).toBe('Admin');
  });

  it('AT2.2 — injects Owner role for the organisation creator', async () => {
    const { org, token } = await setupOrgMember('Owner');

    const res = await request(testApp)
      .get('/test/org-protected')
      .set('Cookie', `accessToken=${token}`)
      .set('X-Organization-ID', org._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.userRole).toBe('Owner');
  });

  it('AT2.3 — 400 MISSING_ORG_HEADER: no X-Organization-ID header', async () => {
    const user = await UserModel.create({
      name: 'No Header User',
      email: `noheader-${Date.now()}@example.com`,
      passwordHash: '$2a$12$placeholder',
      isVerified: true,
      status: 'Active',
    });
    const token = signAccessToken({ userId: user._id.toString(), email: user.email });

    const res = await request(testApp)
      .get('/test/org-protected')
      .set('Cookie', `accessToken=${token}`);
    // No X-Organization-ID

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('MISSING_ORG_HEADER');
  });

  it('AT2.4 — 403 FORBIDDEN: user authenticated but not a member of the org', async () => {
    // User exists but has no membership
    const user = await UserModel.create({
      name: 'Outsider',
      email: `outsider-${Date.now()}@example.com`,
      passwordHash: '$2a$12$placeholder',
      isVerified: true,
      status: 'Active',
    });

    const otherUser = await UserModel.create({
      name: 'Org Owner',
      email: `owner-${Date.now()}@example.com`,
      passwordHash: '$2a$12$placeholder',
      isVerified: true,
      status: 'Active',
    });

    const org = await OrganizationModel.create({
      name: 'Other Org',
      slug: `other-org-${Date.now()}`,
      ownerId: otherUser._id,
      industry: 'Retail',
    });
    // No Membership for `user` in this org

    const token = signAccessToken({ userId: user._id.toString(), email: user.email });

    const res = await request(testApp)
      .get('/test/org-protected')
      .set('Cookie', `accessToken=${token}`)
      .set('X-Organization-ID', org._id.toString());

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('AT2.5 — authenticate still rejects if no cookie (runs before validateOrganization)', async () => {
    const { org } = await setupOrgMember();

    const res = await request(testApp)
      .get('/test/org-protected')
      .set('X-Organization-ID', org._id.toString());
    // No accessToken cookie

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
