/**
 * Pricing v2 (2026-10-08) — main-project-docs/Pricing-Redesign-2026-10.md
 *
 *   - plan catalog: prices, allowances, Pro 1,500 min, Starter (lite) plan
 *   - top-up pack helpers (balance, overflow, FIFO allocation)
 *   - checkout: Starter plan, annual interval, setup fee once, waived on annual
 *   - top-up checkout + idempotent crediting via the Stripe webhook
 *   - assistant-request gate: packs extend the allowance, fallback transfer,
 *     simultaneous-call limit
 *   - end-of-call bookkeeping: pack consumption + one usage alert per month
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import { OrganizationModel, MembershipModel } from '@/modules/organization/organization.model';
import { CallModel } from '@/modules/calls/call.model';
import { signAccessToken } from '@/utils/jwt';
import { startOfMonthUTC } from '@/utils/callMinutes';
import {
  PLAN_CATALOG, TOPUP_PACKS, planMrrInr, isPaidPlan,
} from '@/modules/billing/plan-catalog';
import { PLAN_LIMITS, handleStripeWebhook, creditTopupPack, getPlanFromPriceId } from '@/modules/billing/billing.service';
import { PREMIUM_VOICE_ADDON_PRICE_INR } from '@/modules/agents/voice-pricing';
import {
  validPackBalance, nextPackExpiry, overflowMinutes, allocatePackConsumption,
} from '@/utils/minutePacks';
import {
  handleAssistantRequest, applyPackUsageAndAlerts, toE164,
} from '@/modules/calls/webhook.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const { mockCheckoutCreate, mockConstructEvent, mockUsageAlert } = vi.hoisted(() => ({
  mockCheckoutCreate: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockUsageAlert:     vi.fn(),
}));

vi.mock('stripe', () => {
  const MockStripe = vi.fn().mockImplementation(function MockStripeImpl() {
    return {
      checkout:      { sessions: { create: mockCheckoutCreate } },
      billingPortal: { sessions: { create: vi.fn() } },
      subscriptions: { cancel: vi.fn() },
      webhooks:      { constructEvent: mockConstructEvent },
    };
  });
  return { default: MockStripe };
});

vi.mock('@/config/redis', () => ({
  redis: { setex: vi.fn().mockResolvedValue('OK'), get: vi.fn().mockResolvedValue(null), del: vi.fn().mockResolvedValue(1) },
}));

vi.mock('@/utils/email', () => ({
  sendEmail:              vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail:  vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendUsageAlertEmail:    mockUsageAlert,
}));

vi.mock('@/config/env', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/config/env')>();
  return {
    ...original,
    env: {
      ...original.env,
      STRIPE_SECRET_KEY:                  'sk_test_mock',
      STRIPE_WEBHOOK_SECRET:              'whsec_mock',
      STRIPE_LITE_PRICE_ID_INR:           'price_lite_m',
      STRIPE_STARTER_PRICE_ID_INR:        'price_basic_m',
      STRIPE_GROWTH_PRICE_ID_INR:         'price_std_m',
      STRIPE_PRO_PRICE_ID_INR:            'price_pro_m',
      STRIPE_LITE_ANNUAL_PRICE_ID_INR:    'price_lite_y',
      STRIPE_STARTER_ANNUAL_PRICE_ID_INR: 'price_basic_y',
      STRIPE_GROWTH_ANNUAL_PRICE_ID_INR:  'price_std_y',
      STRIPE_PRO_ANNUAL_PRICE_ID_INR:     'price_pro_y',
      STRIPE_SETUP_GUIDED_PRICE_ID_INR:   'price_setup_guided',
      STRIPE_SETUP_MANAGED_PRICE_ID_INR:  'price_setup_managed',
      STRIPE_TOPUP_100_PRICE_ID_INR:      'price_topup_100',
      STRIPE_TOPUP_500_PRICE_ID_INR:      'price_topup_500',
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;

async function ownerWithOrg(plan = 'free', extra: Record<string, unknown> = {}) {
  const suffix = new mongoose.Types.ObjectId().toString();
  const user = await UserModel.create({
    name: 'Owner', email: `pv2-${suffix}@example.com`, passwordHash: '$2a$12$placeholder',
    isVerified: true, status: 'Active',
  });
  const org = await OrganizationModel.create({
    name: 'Pricing Org', slug: `pv2-${suffix}`, ownerId: user._id, industry: 'Retail',
    timezone: 'Asia/Kolkata', onboardingStatus: 'COMPLETED',
    businessHours: { start: '00:00', end: '23:59' }, plan, trialUsed: true, ...extra,
  });
  await MembershipModel.create({ userId: user._id, organizationId: org._id, role: 'Owner' });
  const token = signAccessToken({ userId: user._id.toString(), email: user.email });
  return { user, org, cookie: `accessToken=${token}` };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckoutCreate.mockResolvedValue({ id: 'cs_mock', url: 'https://checkout.stripe.com/pay/cs_mock' });
});

// ── Catalog ───────────────────────────────────────────────────────────────────
describe('plan catalog', () => {
  it('has the four paid plans at the v2 prices', () => {
    expect(PLAN_CATALOG.lite).toMatchObject({ name: 'Starter', monthlyInr: 4_999, includedMinutes: 200, concurrentCalls: 1, setupFeeInr: 0 });
    expect(PLAN_CATALOG.starter).toMatchObject({ name: 'Basic', monthlyInr: 9_999, includedMinutes: 500, setupFeeInr: 4_999 });
    expect(PLAN_CATALOG.growth).toMatchObject({ name: 'Standard', monthlyInr: 17_999, includedMinutes: 1_000, setupFeeInr: 4_999 });
    expect(PLAN_CATALOG.enterprise).toMatchObject({ name: 'Pro', monthlyInr: 29_999, includedMinutes: 1_500, concurrentCalls: 5, setupFeeInr: 14_999, premiumVoiceAddonInr: null });
  });

  it('prices annual plans at 10 months for 12', () => {
    for (const def of Object.values(PLAN_CATALOG)) expect(def.annualInr).toBe(def.monthlyInr * 10);
  });

  it('feeds PLAN_LIMITS (Pro no longer a 3,000-min hard cap)', () => {
    expect(PLAN_LIMITS.enterprise.callMinutes).toBe(1_500);
    expect(PLAN_LIMITS.lite.callMinutes).toBe(200);
    expect(PLAN_LIMITS.growth.concurrentCalls).toBe(3);
  });

  it('sells premium voices as an add-on on Starter, Basic and Standard only', () => {
    expect(PREMIUM_VOICE_ADDON_PRICE_INR).toEqual({ lite: 1_499, starter: 2_999, growth: 4_999 });
  });

  it('computes MRR for monthly and annual billing', () => {
    expect(planMrrInr('free')).toBe(0);
    expect(planMrrInr('starter')).toBe(9_999);
    expect(planMrrInr('starter', 'year')).toBe(8_333);
    expect(isPaidPlan('lite')).toBe(true);
    expect(isPaidPlan('free')).toBe(false);
  });

  it('prices top-up packs at ₹20 and ₹18 per minute', () => {
    expect(TOPUP_PACKS.topup_100.priceInr / TOPUP_PACKS.topup_100.minutes).toBe(20);
    expect(TOPUP_PACKS.topup_500.priceInr / TOPUP_PACKS.topup_500.minutes).toBe(18);
  });

  it('maps monthly and annual Stripe prices back to plan + interval', () => {
    expect(getPlanFromPriceId('price_lite_m')).toEqual({ plan: 'lite', interval: 'month' });
    expect(getPlanFromPriceId('price_pro_y')).toEqual({ plan: 'enterprise', interval: 'year' });
    expect(getPlanFromPriceId('price_unknown')).toBeNull();
  });
});

// ── Pack helpers ──────────────────────────────────────────────────────────────
describe('top-up pack helpers', () => {
  const now = new Date('2026-10-08T00:00:00Z');
  const packs = [
    { remaining: 50,  expiresAt: new Date(now.getTime() + 30 * DAY), stripeSessionId: 'b' },
    { remaining: 100, expiresAt: new Date(now.getTime() + 5 * DAY),  stripeSessionId: 'a' },
    { remaining: 999, expiresAt: new Date(now.getTime() - 1 * DAY),  stripeSessionId: 'expired' },
  ];

  it('counts only unexpired minutes', () => {
    expect(validPackBalance(packs, now)).toBe(150);
    expect(nextPackExpiry(packs, now)?.toISOString()).toBe(new Date(now.getTime() + 5 * DAY).toISOString());
    expect(validPackBalance(undefined, now)).toBe(0);
  });

  it('measures only the part of a call beyond the allowance', () => {
    expect(overflowMinutes(490, 498, 500)).toBe(0);
    expect(overflowMinutes(498, 504, 500)).toBe(4);
    expect(overflowMinutes(510, 513, 500)).toBe(3);
    expect(overflowMinutes(10, 20, Infinity)).toBe(0);
  });

  it('takes from the soonest-expiring pack first', () => {
    expect(allocatePackConsumption(packs, 120, now)).toEqual({
      takes: [{ stripeSessionId: 'a', take: 100 }, { stripeSessionId: 'b', take: 20 }],
      uncovered: 0,
    });
    expect(allocatePackConsumption(packs, 200, now).uncovered).toBe(50);
  });

  it('normalises fallback numbers to E.164', () => {
    expect(toE164('98765 43210')).toBe('+919876543210');
    expect(toE164('09876543210')).toBe('+919876543210');
    expect(toE164('+91-98765-43210')).toBe('+919876543210');
    expect(toE164('12345')).toBeNull();
    expect(toE164(undefined)).toBeNull();
  });
});

// ── Checkout ──────────────────────────────────────────────────────────────────
describe('POST /api/v1/billing/checkout (v2)', () => {
  it('sells the new Starter plan with no setup fee', async () => {
    const { cookie } = await ownerWithOrg();
    const res = await request(app).post('/api/v1/billing/checkout').set('Cookie', cookie).send({ plan: 'lite' });
    expect(res.status).toBe(200);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: 'price_lite_m', quantity: 1 }],
    }));
  });

  it('adds the one-time setup fee to a first monthly Basic checkout', async () => {
    const { cookie } = await ownerWithOrg();
    await request(app).post('/api/v1/billing/checkout').set('Cookie', cookie).send({ plan: 'starter' });
    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: 'price_basic_m', quantity: 1 }, { price: 'price_setup_guided', quantity: 1 }],
      metadata:   expect.objectContaining({ setupFee: 'true', interval: 'month' }),
    }));
  });

  it('uses the managed setup fee on Pro and skips it once paid', async () => {
    const { cookie, org } = await ownerWithOrg();
    await request(app).post('/api/v1/billing/checkout').set('Cookie', cookie).send({ plan: 'enterprise' });
    expect(mockCheckoutCreate.mock.calls[0][0].line_items[1]).toEqual({ price: 'price_setup_managed', quantity: 1 });

    await OrganizationModel.findByIdAndUpdate(org._id, { setupFeePaidAt: new Date() });
    await request(app).post('/api/v1/billing/checkout').set('Cookie', cookie).send({ plan: 'enterprise' });
    expect(mockCheckoutCreate.mock.calls[1][0].line_items).toEqual([{ price: 'price_pro_m', quantity: 1 }]);
  });

  it('waives the setup fee on annual billing', async () => {
    const { cookie } = await ownerWithOrg();
    const res = await request(app).post('/api/v1/billing/checkout').set('Cookie', cookie).send({ plan: 'growth', interval: 'year' });
    expect(res.status).toBe(200);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: 'price_std_y', quantity: 1 }],
      metadata:   expect.objectContaining({ interval: 'year', setupFee: 'false' }),
    }));
  });

  it('rejects an unknown interval', async () => {
    const { cookie } = await ownerWithOrg();
    const res = await request(app).post('/api/v1/billing/checkout').set('Cookie', cookie).send({ plan: 'growth', interval: 'week' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INTERVAL');
  });
});

// ── Top-ups ───────────────────────────────────────────────────────────────────
describe('top-up packs', () => {
  it('refuses packs on the free plan', async () => {
    const { cookie } = await ownerWithOrg('free');
    const res = await request(app).post('/api/v1/billing/topups/checkout').set('Cookie', cookie).send({ pack: 'topup_100' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOPUP_NOT_ELIGIBLE');
  });

  it('creates a one-time payment checkout on a paid plan', async () => {
    const { cookie } = await ownerWithOrg('starter');
    const res = await request(app).post('/api/v1/billing/topups/checkout').set('Cookie', cookie).send({ pack: 'topup_500' });
    expect(res.status).toBe(200);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode:       'payment',
      line_items: [{ price: 'price_topup_500', quantity: 1 }],
      metadata:   expect.objectContaining({ topupPack: 'topup_500', minutes: '500' }),
    }));
  });

  it('rejects an unknown pack', async () => {
    const { cookie } = await ownerWithOrg('starter');
    const res = await request(app).post('/api/v1/billing/topups/checkout').set('Cookie', cookie).send({ pack: 'topup_9' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOPUP_PACK');
  });

  it('credits a paid pack once, even if Stripe resends the event', async () => {
    const { org } = await ownerWithOrg('starter');
    const event = {
      type: 'checkout.session.completed', id: 'evt_topup',
      data: { object: {
        id: 'cs_topup_1', mode: 'payment', payment_status: 'paid', customer: 'cus_1',
        metadata: { organizationId: org._id.toString(), topupPack: 'topup_100', minutes: '100' },
      } },
    };
    mockConstructEvent.mockReturnValue(event);
    await handleStripeWebhook(Buffer.from('{}'), 'sig');
    await handleStripeWebhook(Buffer.from('{}'), 'sig');

    const after = await OrganizationModel.findById(org._id).lean();
    expect(after?.plan).toBe('starter');              // never touches the plan
    expect(after?.minutePacks).toHaveLength(1);
    expect(after?.minutePacks[0]).toMatchObject({ packId: 'topup_100', minutes: 100, remaining: 100 });
    const days = (new Date(after!.minutePacks[0].expiresAt).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(89);
    expect(after?.stripeCustomerId).toBe('cus_1');
  });

  it('waits for async payment before crediting', async () => {
    const { org } = await ownerWithOrg('starter');
    const session = {
      id: 'cs_topup_async', mode: 'payment', payment_status: 'unpaid',
      metadata: { organizationId: org._id.toString(), topupPack: 'topup_500' },
    };
    mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', id: 'e1', data: { object: session } });
    await handleStripeWebhook(Buffer.from('{}'), 'sig');
    expect((await OrganizationModel.findById(org._id).lean())?.minutePacks).toHaveLength(0);

    mockConstructEvent.mockReturnValue({ type: 'checkout.session.async_payment_succeeded', id: 'e2', data: { object: { ...session, payment_status: 'paid' } } });
    await handleStripeWebhook(Buffer.from('{}'), 'sig');
    expect((await OrganizationModel.findById(org._id).lean())?.minutePacks[0]?.minutes).toBe(500);
  });

  it('records the billing interval and setup fee on plan checkout', async () => {
    const { org } = await ownerWithOrg('free');
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed', id: 'e3',
      data: { object: { id: 'cs_plan', customer: 'cus_2', subscription: 'sub_2',
        metadata: { organizationId: org._id.toString(), plan: 'growth', interval: 'month', setupFee: 'true' } } },
    });
    await handleStripeWebhook(Buffer.from('{}'), 'sig');
    const after = await OrganizationModel.findById(org._id).lean();
    expect(after).toMatchObject({ plan: 'growth', billingInterval: 'month' });
    expect(after?.setupFeePaidAt).toBeInstanceOf(Date);
  });

  it('shows the pack balance on the billing status', async () => {
    const { org, cookie } = await ownerWithOrg('starter');
    await creditTopupPack(org._id.toString(), 'topup_100', 'cs_status');
    const res = await request(app).get('/api/v1/billing/status').set('Cookie', cookie);
    expect(res.body.data.topupMinutes.balance).toBe(100);
    expect(res.body.data.concurrentCalls).toBe(2);
    expect(res.body.data.billingInterval).toBe('month');
  });
});

// ── assistant-request gate ────────────────────────────────────────────────────
describe('assistant-request gate (v2)', () => {
  const ask = (phoneId: string) =>
    handleAssistantRequest({ type: 'assistant-request', call: { id: `call_${phoneId}`, phoneNumberId: phoneId } } as never);

  async function gateOrg(phoneId: string, extra: Record<string, unknown>) {
    const { org } = await ownerWithOrg('starter', {
      vapiPhoneNumberId: phoneId, vapiAssistantId: 'asst_live',
      callMinutesUsed: 500, callMinutesResetAt: startOfMonthUTC(), ...extra,
    });
    return org;
  }

  it('keeps answering on top-up minutes after the allowance', async () => {
    await gateOrg('pn_v2_pack', {
      minutePacks: [{ packId: 'topup_100', minutes: 100, remaining: 40, purchasedAt: new Date(), expiresAt: new Date(Date.now() + DAY), stripeSessionId: 's1' }],
    });
    expect(await ask('pn_v2_pack')).toEqual({ assistantId: 'asst_live' });
  });

  it('ignores expired packs', async () => {
    await gateOrg('pn_v2_expired', {
      minutePacks: [{ packId: 'topup_100', minutes: 100, remaining: 100, purchasedAt: new Date(), expiresAt: new Date(Date.now() - DAY), stripeSessionId: 's2' }],
    });
    expect(JSON.stringify(await ask('pn_v2_expired'))).toContain('Unavailable');
  });

  it('forwards to the fallback number when minutes are used up', async () => {
    await gateOrg('pn_v2_fwd', { fallbackNumber: '98765 43210' });
    expect(await ask('pn_v2_fwd')).toEqual({ destination: { type: 'number', number: '+919876543210', message: '' } });
  });

  it('enforces the simultaneous-call limit', async () => {
    const org = await gateOrg('pn_v2_busy', { callMinutesUsed: 0 });
    for (const id of ['c1', 'c2']) {
      await CallModel.create({
        organizationId: org._id, agentId: new mongoose.Types.ObjectId(), vapiCallId: id,
        direction: 'Inbound', callerNumber: '+910000000000', status: 'active', duration: 0, cost: 0,
      });
    }
    expect(JSON.stringify(await ask('pn_v2_busy'))).toContain('Lines Busy'); // Basic = 2 at once
  });

  it('does not count a stale active call', async () => {
    const org = await gateOrg('pn_v2_stale', { callMinutesUsed: 0 });
    for (const id of ['s1', 's2']) {
      const c = await CallModel.create({
        organizationId: org._id, agentId: new mongoose.Types.ObjectId(), vapiCallId: id,
        direction: 'Inbound', callerNumber: '+910000000000', status: 'active', duration: 0, cost: 0,
      });
      await CallModel.collection.updateOne({ _id: c._id }, { $set: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } });
    }
    expect(await ask('pn_v2_stale')).toEqual({ assistantId: 'asst_live' });
  });
});

// ── End-of-call bookkeeping ───────────────────────────────────────────────────
describe('applyPackUsageAndAlerts', () => {
  it('deducts minutes beyond the allowance from packs, soonest expiry first', async () => {
    const { org } = await ownerWithOrg('starter', {
      callMinutesUsed: 505, callMinutesResetAt: startOfMonthUTC(),
      minutePacks: [
        { packId: 'topup_100', minutes: 100, remaining: 3,   purchasedAt: new Date(), expiresAt: new Date(Date.now() + 2 * DAY),  stripeSessionId: 'soon' },
        { packId: 'topup_500', minutes: 500, remaining: 500, purchasedAt: new Date(), expiresAt: new Date(Date.now() + 60 * DAY), stripeSessionId: 'later' },
      ],
    });
    const doc = await OrganizationModel.findById(org._id);
    await applyPackUsageAndAlerts(doc!, 8, startOfMonthUTC()); // 497 → 505: 5 min beyond 500

    const after = await OrganizationModel.findById(org._id).lean();
    const bySession = Object.fromEntries(after!.minutePacks.map((p) => [p.stripeSessionId, p.remaining]));
    expect(bySession).toEqual({ soon: 0, later: 498 });
  });

  it('sends the 80% alert once per month', async () => {
    const { org } = await ownerWithOrg('starter', { callMinutesUsed: 402, callMinutesResetAt: startOfMonthUTC() });
    const doc = await OrganizationModel.findById(org._id);
    await applyPackUsageAndAlerts(doc!, 5, startOfMonthUTC()); // 397 → 402 crosses 400
    await applyPackUsageAndAlerts(doc!, 5, startOfMonthUTC()); // same crossing again → no second email
    expect(mockUsageAlert).toHaveBeenCalledTimes(1);
    expect(mockUsageAlert).toHaveBeenCalledWith(expect.objectContaining({ percent: 80, limit: 500, planName: 'Basic' }));
  });

  it('skips trial orgs', async () => {
    const { org } = await ownerWithOrg('free', {
      trialUsed: true, trialEndsAt: new Date(Date.now() + 3 * DAY),
      callMinutesUsed: 60, callMinutesResetAt: startOfMonthUTC(),
    });
    const doc = await OrganizationModel.findById(org._id);
    await applyPackUsageAndAlerts(doc!, 30, startOfMonthUTC());
    expect(mockUsageAlert).not.toHaveBeenCalled();
  });
});
