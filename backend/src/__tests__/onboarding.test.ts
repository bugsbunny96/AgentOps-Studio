/**
 * L2.F3 — Onboarding Integration Tests
 * Atomic Task: L2.F3.M1.AT6
 *
 * Tests:
 *   POST   /api/v1/onboarding/org      — create organization (Steps 1)
 *   PATCH  /api/v1/onboarding/org      — update org per wizard step (Steps 2-4)
 *   POST   /api/v1/onboarding/complete — complete onboarding (Step 5)
 *
 * Auth strategy: create users directly via UserModel + signAccessToken (no HTTP round-trip).
 * Redis mock: required because authenticate middleware resolves to full app which imports redis.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import {
  OrganizationModel,
  MembershipModel,
  OnboardingSessionModel,
} from '@/modules/organization/organization.model';
import { signAccessToken } from '@/utils/jwt';
import { toSlugBase } from '@/modules/onboarding/onboarding.service';

// ── Redis mock ──────────────────────────────────────────────────────────────
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

vi.mock('@/utils/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Create an active, verified user and return a signed access token cookie */
async function createUserAndToken(suffix = Date.now()) {
  const user = await UserModel.create({
    name: 'Org Test User',
    email: `orgtest-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified: true,
    status: 'Active',
  });

  const token = signAccessToken({ userId: user._id.toString(), email: user.email });
  return { user, cookie: `accessToken=${token}` };
}

const VALID_ORG = {
  name: 'Acme Corp',
  industry: 'Technology',
  timezone: 'Asia/Kolkata',
} as const;

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// toSlugBase unit tests (pure function — no DB needed)
// ═══════════════════════════════════════════════════════════════════════════

describe('toSlugBase()', () => {
  it('converts org name to lowercase hyphenated slug', () => {
    expect(toSlugBase('Acme Corp')).toBe('acme-corp');
  });
  it('strips special characters', () => {
    expect(toSlugBase('Rao & Sons!!!')).toBe('rao-sons');
  });
  it('normalises accented characters', () => {
    expect(toSlugBase('Café Bistro')).toBe('cafe-bistro');
  });
  it('collapses multiple spaces / hyphens', () => {
    expect(toSlugBase('  Hello   World  ')).toBe('hello-world');
  });
  it('returns empty string for all-special-char input', () => {
    expect(toSlugBase('!!!!')).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/onboarding/org
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/onboarding/org', () => {
  it('AT6.1 — 201: creates org, membership (Owner), and session', async () => {
    const { cookie, user } = await createUserAndToken();

    const res = await request(app)
      .post('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send(VALID_ORG);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const { organization, membership, session } = res.body.data;

    // Organization
    expect(organization.name).toBe('Acme Corp');
    expect(organization.slug).toBe('acme-corp');
    expect(organization.industry).toBe('Technology');
    expect(organization.timezone).toBe('Asia/Kolkata');
    expect(organization.onboardingStatus).toBe('ORG_CREATION');

    // Membership
    expect(membership.role).toBe('Owner');

    // Session
    expect(session.currentStep).toBe('Learn');
    expect(session.stepStatus).toBe('NotStarted');
    expect(typeof session.resumeToken).toBe('string');
    expect(session.resumeToken.length).toBe(64); // 32 bytes hex = 64 chars

    // Verify DB state
    const dbOrg = await OrganizationModel.findById(organization._id);
    expect(dbOrg).not.toBeNull();
    expect(dbOrg!.ownerId.toString()).toBe(user._id.toString());

    const dbMembership = await MembershipModel.findOne({ userId: user._id });
    expect(dbMembership).not.toBeNull();
    expect(dbMembership!.role).toBe('Owner');

    const dbSession = await OnboardingSessionModel.findOne({ userId: user._id });
    expect(dbSession).not.toBeNull();
    expect(dbSession!.currentStep).toBe('Learn');
  });

  it('AT6.2 — 201: slug derived correctly from org name', async () => {
    const { cookie } = await createUserAndToken();
    const res = await request(app)
      .post('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({ name: 'Hello World & Co.', industry: 'Retail', timezone: 'Asia/Kolkata' });

    expect(res.status).toBe(201);
    expect(res.body.data.organization.slug).toBe('hello-world-co');
  });

  it('AT6.3 — 201: second user gets unique slug when first user has same name', async () => {
    const { cookie: cookie1 } = await createUserAndToken(1);
    const { cookie: cookie2 } = await createUserAndToken(2);

    const r1 = await request(app)
      .post('/api/v1/onboarding/org')
      .set('Cookie', cookie1)
      .send(VALID_ORG);
    const r2 = await request(app)
      .post('/api/v1/onboarding/org')
      .set('Cookie', cookie2)
      .send(VALID_ORG);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.data.organization.slug).toBe('acme-corp');
    expect(r2.body.data.organization.slug).toBe('acme-corp-1');
  });

  it('AT6.4 — 409 ORG_LIMIT_REACHED: same user creates a second org', async () => {
    const { cookie } = await createUserAndToken();

    await request(app).post('/api/v1/onboarding/org').set('Cookie', cookie).send(VALID_ORG);

    const res = await request(app)
      .post('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({ ...VALID_ORG, name: 'Different Name' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ORG_LIMIT_REACHED');
  });

  it('AT6.5 — 401 UNAUTHORIZED: no accessToken cookie', async () => {
    const res = await request(app).post('/api/v1/onboarding/org').send(VALID_ORG);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AT6.6 — 400 VALIDATION_ERROR: missing name field', async () => {
    const { cookie } = await createUserAndToken();

    const res = await request(app)
      .post('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({ industry: 'Technology', timezone: 'Asia/Kolkata' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AT6.7 — 400 VALIDATION_ERROR: invalid industry value', async () => {
    const { cookie } = await createUserAndToken();

    const res = await request(app)
      .post('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({ name: 'Test Corp', industry: 'INVALID_INDUSTRY', timezone: 'Asia/Kolkata' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/v1/onboarding/org
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/v1/onboarding/org', () => {
  /** Helper: create org via the API, return cookie + org data */
  async function createOrgViaApi() {
    const { cookie, user } = await createUserAndToken();
    const res = await request(app)
      .post('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send(VALID_ORG);
    return { cookie, user, orgId: res.body.data.organization._id };
  }

  it('AT6.8 — 200: learn step saves hasWebsite + websiteUrl, advances to WEBSITE_CRAWL', async () => {
    const { cookie, orgId } = await createOrgViaApi();

    const res = await request(app)
      .patch('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({ step: 'learn', hasWebsite: true, websiteUrl: 'https://acme.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.organization.hasWebsite).toBe(true);
    expect(res.body.data.organization.websiteUrl).toBe('https://acme.com');
    expect(res.body.data.organization.onboardingStatus).toBe('WEBSITE_CRAWL');

    // Verify DB
    const dbOrg = await OrganizationModel.findById(orgId);
    expect(dbOrg!.hasWebsite).toBe(true);
    expect(dbOrg!.websiteUrl).toBe('https://acme.com');
    expect(dbOrg!.onboardingStatus).toBe('WEBSITE_CRAWL');
  });

  it('AT6.9 — 200: learn step with hasWebsite=false skips URL', async () => {
    const { cookie } = await createOrgViaApi();

    const res = await request(app)
      .patch('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({ step: 'learn', hasWebsite: false });

    expect(res.status).toBe(200);
    expect(res.body.data.organization.hasWebsite).toBe(false);
    expect(res.body.data.organization.onboardingStatus).toBe('WEBSITE_CRAWL');
  });

  it('AT6.10 — 200: configure step saves business config, advances to BUSINESS_CONFIG', async () => {
    const { cookie } = await createOrgViaApi();

    const res = await request(app)
      .patch('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({
        step: 'configure',
        businessDescription: 'We are a leading tech company.',
        services: ['Web Development', 'Cloud Hosting'],
        businessHours: { start: '09:00', end: '18:00' },
        contactDetails: { email: 'contact@acme.com', phone: '+91-9876543210' },
      });

    expect(res.status).toBe(200);
    const org = res.body.data.organization;
    expect(org.businessDescription).toBe('We are a leading tech company.');
    expect(org.services).toEqual(['Web Development', 'Cloud Hosting']);
    expect(org.businessHours.start).toBe('09:00');
    expect(org.businessHours.end).toBe('18:00');
    expect(org.onboardingStatus).toBe('BUSINESS_CONFIG');
  });

  it('AT6.11 — 200: customize step saves languages + fallback, advances to VOICE_SETUP', async () => {
    const { cookie } = await createOrgViaApi();

    const res = await request(app)
      .patch('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({
        step: 'customize',
        supportedLanguages: ['en-US', 'hi-IN'],
        fallbackNumber: '+91-9000000000',
      });

    expect(res.status).toBe(200);
    const org = res.body.data.organization;
    expect(org.supportedLanguages).toEqual(['en-US', 'hi-IN']);
    expect(org.fallbackNumber).toBe('+91-9000000000');
    expect(org.onboardingStatus).toBe('VOICE_SETUP');
  });

  it('AT6.12 — 401 UNAUTHORIZED: no cookie', async () => {
    const res = await request(app)
      .patch('/api/v1/onboarding/org')
      .send({ step: 'learn', hasWebsite: false });

    expect(res.status).toBe(401);
  });

  it('AT6.13 — 400 VALIDATION_ERROR: invalid step value', async () => {
    const { cookie } = await createOrgViaApi();

    const res = await request(app)
      .patch('/api/v1/onboarding/org')
      .set('Cookie', cookie)
      .send({ step: 'invalid-step', someField: 'value' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/v1/onboarding/complete
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/onboarding/complete', () => {
  it('AT6.14 — 200: sets onboardingStatus to COMPLETED and marks session done', async () => {
    const { cookie, user } = await createUserAndToken();
    await request(app).post('/api/v1/onboarding/org').set('Cookie', cookie).send(VALID_ORG);

    const res = await request(app)
      .post('/api/v1/onboarding/complete')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.organization.onboardingStatus).toBe('COMPLETED');
    expect(typeof res.body.data.message).toBe('string');

    // Verify DB
    const membership = await MembershipModel.findOne({ userId: user._id, role: 'Owner' });
    const dbOrg = await OrganizationModel.findById(membership!.organizationId);
    expect(dbOrg!.onboardingStatus).toBe('COMPLETED');

    const dbSession = await OnboardingSessionModel.findOne({ userId: user._id });
    expect(dbSession!.stepStatus).toBe('Completed');
  });

  it('AT6.15 — 401 UNAUTHORIZED: no cookie', async () => {
    const res = await request(app).post('/api/v1/onboarding/complete');
    expect(res.status).toBe(401);
  });
});
