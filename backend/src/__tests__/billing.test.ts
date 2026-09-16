/**
 * L2.F9 — Billing / Stripe Integration Tests
 *
 * Routes under test:
 *   POST /api/v1/billing/checkout
 *   GET  /api/v1/billing/status
 *   POST /api/v1/billing/webhook
 *
 * Verifies:
 *   Checkout:
 *     - 401 unauthenticated
 *     - 400 missing plan
 *     - 400 invalid plan value
 *     - 400 Stripe not configured (no STRIPE_SECRET_KEY)
 *     - 200 returns Stripe checkout URL
 *
 *   Status:
 *     - 401 unauthenticated
 *     - 200 returns plan + usage counts
 *     - 200 plan defaults to 'free' when unset
 *
 *   Webhook:
 *     - 400 missing stripe-signature header
 *     - 400 invalid signature (Stripe throws)
 *     - 200 checkout.session.completed → org plan updated
 *     - 200 customer.subscription.deleted → org downgraded to free
 *     - 200 unknown event type → no-op, 200
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import {
  OrganizationModel,
  MembershipModel,
} from '@/modules/organization/organization.model';
import { KbDocumentModel } from '@/modules/knowledge-base/kb.model';
import { signAccessToken } from '@/utils/jwt';

// ── Stripe mock ───────────────────────────────────────────────────────────────
const {
  mockCheckoutCreate,
  mockWebhooksConstructEvent,
  mockPortalCreate,
} = vi.hoisted(() => ({
  mockCheckoutCreate:          vi.fn(),
  mockWebhooksConstructEvent:  vi.fn(),
  mockPortalCreate:            vi.fn(),
}));

vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutCreate,
      },
    },
    billingPortal: {
      sessions: {
        create: mockPortalCreate,
      },
    },
    webhooks: {
      constructEvent: mockWebhooksConstructEvent,
    },
  }));
  return { default: MockStripe };
});

// ── Redis mock ────────────────────────────────────────────────────────────────
const redisStore = new Map<string, string>();

vi.mock('@/config/redis', () => ({
  redis: {
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      redisStore.set(key, value);
      return Promise.resolve('OK');
    }),
    get:  vi.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    del:  vi.fn((key: string) => { redisStore.delete(key); return Promise.resolve(1); }),
  },
}));

vi.mock('@/utils/email', () => ({
  sendEmail:              vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail:  vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Env mock: provide Stripe config ──────────────────────────────────────────
vi.mock('@/config/env', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/config/env')>();
  return {
    ...original,
    env: {
      ...original.env,
      STRIPE_SECRET_KEY:           'sk_test_mock',
      STRIPE_WEBHOOK_SECRET:       'whsec_mock',
      // Primary (USD) price IDs — present as fallback
      STRIPE_STARTER_PRICE_ID:     'price_starter_mock',
      STRIPE_GROWTH_PRICE_ID:      'price_growth_mock',
      // INR-denominated price IDs — these take priority in getPlanPriceId()
      STRIPE_STARTER_PRICE_ID_INR: 'price_starter_inr_mock',
      STRIPE_GROWTH_PRICE_ID_INR:  'price_growth_inr_mock',
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createOwnerWithOrg(suffix: string | number = Date.now()) {
  const user = await UserModel.create({
    name:         'Owner',
    email:        `billing-owner-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified:   true,
    status:       'Active',
  });
  const org = await OrganizationModel.create({
    name:             'Billing Test Org',
    slug:             `billing-org-${suffix}`,
    ownerId:          user._id,
    industry:         'Technology',
    timezone:         'Asia/Kolkata',
    onboardingStatus: 'COMPLETED',
    businessHours:    { start: '09:00', end: '18:00' },
    plan:             'free',
  });
  await MembershipModel.create({ userId: user._id, organizationId: org._id, role: 'Owner' });
  const token = signAccessToken({ userId: user._id.toString(), email: user.email });
  return { user, org, cookie: `accessToken=${token}` };
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();

  // Default happy-path Stripe mocks
  mockCheckoutCreate.mockResolvedValue({
    id:  'cs_test_mock_session_123',
    url: 'https://checkout.stripe.com/pay/cs_test_mock_session_123',
  });

  mockPortalCreate.mockResolvedValue({
    id:  'bps_test_mock_session_123',
    url: 'https://billing.stripe.com/p/session/bps_test_mock_session_123',
  });

  mockWebhooksConstructEvent.mockImplementation(
    (_rawBody: Buffer, _sig: string, _secret: string) => ({
      type: 'checkout.session.completed',
      id:   'evt_test_001',
      data: {
        object: {
          id:           'cs_test_001',
          customer:     'cus_test_001',
          subscription: 'sub_test_001',
          metadata:     { organizationId: 'placeholder', plan: 'starter' },
        },
      },
    }),
  );
});

// ── POST /checkout ─────────────────────────────────────────────────────────────

describe('POST /api/v1/billing/checkout', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .send({ plan: 'starter' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when plan is missing', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(ts);

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PLAN');
  });

  it('returns 400 when plan is an invalid value', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(ts);

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', cookie)
      .send({ plan: 'enterprise' }); // enterprise uses contact-sales, not checkout

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PLAN');
  });

  it('returns 200 with Stripe checkout URL for starter plan', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(ts);

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', cookie)
      .send({ plan: 'starter' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBe('https://checkout.stripe.com/pay/cs_test_mock_session_123');
    expect(mockCheckoutCreate).toHaveBeenCalledOnce();
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode:       'subscription',
        line_items: [{ price: 'price_starter_inr_mock', quantity: 1 }],
      }),
    );
  });

  it('returns 200 with Stripe checkout URL for growth plan', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(ts);

    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', cookie)
      .send({ plan: 'growth' });

    expect(res.status).toBe(200);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_growth_inr_mock', quantity: 1 }],
      }),
    );
  });
});

// ── GET /status ───────────────────────────────────────────────────────────────

describe('GET /api/v1/billing/status', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/billing/status');
    expect(res.status).toBe(401);
  });

  it('returns 200 with plan=free and zero usage on a fresh org', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(ts);

    const res = await request(app)
      .get('/api/v1/billing/status')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plan).toBe('free');
    expect(res.body.data.kbDocs.used).toBe(0);
    expect(res.body.data.kbDocs.limit).toBe(5);    // free plan limit
    expect(res.body.data.teamMembers.used).toBe(0);
    expect(res.body.data.teamMembers.limit).toBe(0); // free: no additional members
  });

  it('reflects KB doc count in usage', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts);

    // Create 3 KB docs directly
    await KbDocumentModel.insertMany([
      { organizationId: org._id, title: 'Doc 1', content: 'c', sourceType: 'manual_text', status: 'ready', tokenEstimate: 10 },
      { organizationId: org._id, title: 'Doc 2', content: 'c', sourceType: 'manual_text', status: 'ready', tokenEstimate: 10 },
      { organizationId: org._id, title: 'Doc 3', content: 'c', sourceType: 'manual_text', status: 'pending', tokenEstimate: 0 },
    ]);

    const res = await request(app)
      .get('/api/v1/billing/status')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.kbDocs.used).toBe(3);
  });

  it('returns null limit for enterprise plan', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts);

    // Upgrade org to enterprise in DB
    await OrganizationModel.findByIdAndUpdate(org._id, { plan: 'enterprise' });

    const res = await request(app)
      .get('/api/v1/billing/status')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('enterprise');
    expect(res.body.data.kbDocs.limit).toBeNull();
    expect(res.body.data.teamMembers.limit).toBeNull();
  });
});

// ── POST /webhook ─────────────────────────────────────────────────────────────

describe('POST /api/v1/billing/webhook', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_STRIPE_SIGNATURE');
  });

  it('returns 400 when Stripe signature verification fails', async () => {
    mockWebhooksConstructEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=bad,v1=badhash')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STRIPE_SIGNATURE');
  });

  it('returns 200 and updates org plan on checkout.session.completed', async () => {
    const ts = Date.now();
    const { org } = await createOwnerWithOrg(ts);

    mockWebhooksConstructEvent.mockImplementationOnce(() => ({
      type: 'checkout.session.completed',
      id:   'evt_checkout_001',
      data: {
        object: {
          id:           'cs_completed_001',
          customer:     'cus_real_001',
          subscription: 'sub_real_001',
          metadata:     { organizationId: org._id.toString(), plan: 'starter' },
        },
      },
    }));

    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from(JSON.stringify({ type: 'checkout.session.completed' })));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    // Verify org was updated
    const updated = await OrganizationModel.findById(org._id).lean();
    expect(updated?.plan).toBe('starter');
    expect(updated?.stripeCustomerId).toBe('cus_real_001');
    expect(updated?.stripeSubscriptionId).toBe('sub_real_001');
  });

  it('returns 200 and downgrades org to free on customer.subscription.deleted', async () => {
    const ts = Date.now();
    const { org } = await createOwnerWithOrg(ts);

    // Pre-set org to growth + Stripe IDs
    await OrganizationModel.findByIdAndUpdate(org._id, {
      plan:                 'growth',
      stripeCustomerId:     'cus_downgrade_test',
      stripeSubscriptionId: 'sub_downgrade_test',
    });

    mockWebhooksConstructEvent.mockImplementationOnce(() => ({
      type: 'customer.subscription.deleted',
      id:   'evt_sub_deleted_001',
      data: {
        object: {
          id:       'sub_downgrade_test',
          customer: 'cus_downgrade_test',
          items:    { data: [] },
        },
      },
    }));

    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from(JSON.stringify({ type: 'customer.subscription.deleted' })));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const updated = await OrganizationModel.findById(org._id).lean();
    expect(updated?.plan).toBe('free');
    expect(updated?.stripeSubscriptionId).toBeUndefined();
  });

  it('returns 200 and is a no-op for unknown event types', async () => {
    mockWebhooksConstructEvent.mockImplementationOnce(() => ({
      type: 'payment_intent.created',
      id:   'evt_unknown_001',
      data: { object: {} },
    }));

    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=123,v1=abc')
      .send(Buffer.from(JSON.stringify({ type: 'payment_intent.created' })));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ── POST /portal ───────────────────────────────────────────────────────────────

describe('POST /api/v1/billing/portal', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/billing/portal')
      .send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 NO_STRIPE_CUSTOMER when org has no Stripe customer ID', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(ts);

    // Org was created without stripeCustomerId — portal cannot be opened
    const res = await request(app)
      .post('/api/v1/billing/portal')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_STRIPE_CUSTOMER');
  });

  it('returns 200 with portal URL when org has a Stripe customer ID', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts);

    // Simulate org already having a Stripe customer (paid subscription)
    await OrganizationModel.findByIdAndUpdate(org._id, {
      plan:             'starter',
      stripeCustomerId: 'cus_portal_test',
    });

    const res = await request(app)
      .post('/api/v1/billing/portal')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBe('https://billing.stripe.com/p/session/bps_test_mock_session_123');
    expect(mockPortalCreate).toHaveBeenCalledOnce();
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer:   'cus_portal_test',
        return_url: expect.stringContaining('/billing'),
      }),
    );
  });
});
