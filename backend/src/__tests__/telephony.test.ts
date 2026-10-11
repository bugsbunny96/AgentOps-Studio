/**
 * Business phone number (Vobiz → Vapi) — number automation, 2026-10-08
 *
 * Routes under test:
 *   GET  /api/v1/telephony/numbers/available
 *   GET  /api/v1/telephony/number
 *   POST /api/v1/telephony/number
 *   POST /api/v1/telephony/number/auto
 *
 * Paid plans only: spare owned numbers first, then local Vobiz inventory
 * (bought on claim + linked to the inbound trunk). Trial accounts get none.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { env } from '@/config/env';
import { UserModel } from '@/modules/auth/auth.model';
import { OrganizationModel, MembershipModel } from '@/modules/organization/organization.model';
import { signAccessToken } from '@/utils/jwt';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const { mockList, mockConfigured, mockCreatePhone, mockDeletePhone, mockInventory, mockPurchase, mockAssignTrunk } = vi.hoisted(() => ({
  mockList:        vi.fn(),
  mockConfigured:  vi.fn(),
  mockCreatePhone: vi.fn(),
  mockDeletePhone: vi.fn(),
  mockInventory:   vi.fn(),
  mockPurchase:    vi.fn(),
  mockAssignTrunk: vi.fn(),
}));

vi.mock('@/modules/telephony/vobiz.client', () => ({
  listAccountNumbers:     mockList,
  isVobizApiConfigured:   mockConfigured,
  listInventoryNumbers:   mockInventory,
  purchaseFromInventory:  mockPurchase,
  assignNumberToTrunk:    mockAssignTrunk,
}));

vi.mock('@/modules/agents/vapi.service', () => ({
  vapiCreatePhoneNumber:    mockCreatePhone,
  vapiDeletePhoneNumber:    mockDeletePhone,
  vapiInitiateOutboundCall: vi.fn(),
  vapiCreateAssistant:      vi.fn().mockResolvedValue({ id: 'stub-assistant' }),
  vapiUpdateAssistant:      vi.fn().mockResolvedValue({}),
  vapiDeleteAssistant:      vi.fn().mockResolvedValue(undefined),
  vapiCreateWebCall:        vi.fn().mockResolvedValue({ id: 'stub', webCallUrl: 'https://stub' }),
}));

const redisStore = new Map<string, string>();
vi.mock('@/config/redis', () => ({
  redis: {
    setex: vi.fn((k: string, _t: number, v: string) => { redisStore.set(k, v); return Promise.resolve('OK'); }),
    get:   vi.fn((k: string) => Promise.resolve(redisStore.get(k) ?? null)),
    del:   vi.fn((k: string) => { redisStore.delete(k); return Promise.resolve(1); }),
  },
}));

vi.mock('@/utils/email', () => ({
  sendEmail:              vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail:  vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────
const NUM_A = '+918071387370';
const NUM_B = '+918071387371';
const NUM_C = '+918071387372';

const vobiz = (e164: string, extra: Record<string, unknown> = {}) => ({
  id: `id-${e164}`, e164, country: 'IN', region: 'KA', status: 'active',
  voice_enabled: true, is_blocked: false, ...extra,
});

const savedEnv = {
  cred:  env.VOBIZ_VAPI_INBOUND_CREDENTIAL_ID,
  trunk: env.VOBIZ_INBOUND_TRUNK_GROUP_ID,
  trial: env.VOBIZ_TRIAL_NUMBERS,
};

const INV_A = '+918064000001';
const INV_B = '+918064000002';

beforeAll(async () => {
  await OrganizationModel.syncIndexes(); // make sure the unique phoneNumber index exists
});

afterAll(() => {
  (env as Record<string, unknown>).VOBIZ_VAPI_INBOUND_CREDENTIAL_ID = savedEnv.cred;
  (env as Record<string, unknown>).VOBIZ_INBOUND_TRUNK_GROUP_ID = savedEnv.trunk;
  (env as Record<string, unknown>).VOBIZ_TRIAL_NUMBERS = savedEnv.trial;
});

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  (env as Record<string, unknown>).VOBIZ_VAPI_INBOUND_CREDENTIAL_ID = 'vapi-inbound-cred';
  mockConfigured.mockReturnValue(true);
  mockList.mockImplementation(async (search?: string) => {
    const pool = [
      vobiz(NUM_A),
      vobiz(NUM_B),
      vobiz(NUM_C),
      vobiz('+918071387379', { status: 'released' }),
      vobiz('+918071387378', { aadhaar_verification_required: true, aadhaar_verified: false }),
      vobiz('+14155551234', { country: 'US' }),
    ];
    return search ? pool.filter((n) => n.e164 === search) : pool;
  });
  mockCreatePhone.mockResolvedValue({ id: 'vapi-phone-new' });
  mockDeletePhone.mockResolvedValue(undefined);
  (env as Record<string, unknown>).VOBIZ_INBOUND_TRUNK_GROUP_ID = undefined;
  (env as Record<string, unknown>).VOBIZ_TRIAL_NUMBERS = '';
  mockInventory.mockResolvedValue([]);
  mockPurchase.mockResolvedValue({ e164: INV_A, status: 'active' });
  mockAssignTrunk.mockResolvedValue(undefined);
});

async function createOwner(suffix: string, orgExtra: Record<string, unknown> = {}, role: 'Owner' | 'Member' = 'Owner') {
  const user = await UserModel.create({
    name: 'Owner', email: `tel-${suffix}@example.com`, passwordHash: '$2a$12$placeholder',
    isVerified: true, status: 'Active',
  });
  const org = await OrganizationModel.create({
    name: `Tel Org ${suffix}`, slug: `tel-org-${suffix}`, ownerId: user._id,
    industry: 'Healthcare', timezone: 'Asia/Kolkata', onboardingStatus: 'VOICE_SETUP',
    businessHours: { start: '09:00', end: '18:00' }, plan: 'starter', trialUsed: true, ...orgExtra,
  });
  await MembershipModel.create({ userId: user._id, organizationId: org._id, role });
  const token = signAccessToken({ userId: user._id.toString(), email: user.email });
  return { org, cookie: `accessToken=${token}` };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/telephony/numbers/available', () => {
  it('401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/telephony/numbers/available');
    expect(res.status).toBe(401);
  });

  it('503 when Vobiz API is not configured', async () => {
    mockConfigured.mockReturnValue(false);
    const { cookie } = await createOwner('nc');
    const res = await request(app).get('/api/v1/telephony/numbers/available').set('Cookie', cookie);
    expect(res.status).toBe(503);
  });

  it('returns only usable, unassigned Indian numbers', async () => {
    await createOwner('taken', { phoneNumber: NUM_B });
    const { cookie } = await createOwner('list');
    const res = await request(app).get('/api/v1/telephony/numbers/available').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const e164s = res.body.data.numbers.map((n: { e164: string }) => n.e164);
    expect(e164s).toEqual([NUM_A, NUM_C]);
    expect(res.body.data.numbers[0].display).toBe('+91 80 7138 7370');
  });

  it('502 when Vobiz errors', async () => {
    mockList.mockRejectedValueOnce(new Error('Vobiz API 500'));
    const { cookie } = await createOwner('err');
    const res = await request(app).get('/api/v1/telephony/numbers/available').set('Cookie', cookie);
    expect(res.status).toBe(502);
  });
});

describe('POST /api/v1/telephony/number', () => {
  it('claims a number, imports it into Vapi without an assistantId', async () => {
    const { org, cookie } = await createOwner('happy');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_A });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ phoneNumber: NUM_A, vapiPhoneNumberId: 'vapi-phone-new' });

    const payload = mockCreatePhone.mock.calls[0][0];
    expect(payload).toMatchObject({ provider: 'byo-phone-number', number: NUM_A, credentialId: 'vapi-inbound-cred' });
    expect(payload.assistantId).toBeUndefined();

    const saved = await OrganizationModel.findById(org._id).lean();
    expect(saved).toMatchObject({
      phoneNumber: NUM_A, vapiPhoneNumberId: 'vapi-phone-new', vapiCredentialId: 'vapi-inbound-cred', telephonyProvider: 'vobiz',
    });

    const current = await request(app).get('/api/v1/telephony/number').set('Cookie', cookie);
    expect(current.body.data).toMatchObject({ phoneNumber: NUM_A, linkedManually: false });
  });

  it('is idempotent for the same number', async () => {
    const { cookie } = await createOwner('idem', { phoneNumber: NUM_A, vapiPhoneNumberId: 'vapi-existing' });
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_A });
    expect(res.status).toBe(200);
    expect(res.body.data.vapiPhoneNumberId).toBe('vapi-existing');
    expect(mockCreatePhone).not.toHaveBeenCalled();
  });

  it('400 for a non-Indian or malformed number', async () => {
    const { cookie } = await createOwner('bad');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: '+14155551234' });
    expect(res.status).toBe(400);
  });

  it('403 for a non-owner', async () => {
    const { cookie } = await createOwner('member', {}, 'Member');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_A });
    expect(res.status).toBe(403);
  });

  it('409 when the org already has a (manually linked) number', async () => {
    const { cookie } = await createOwner('has', { vapiPhoneNumberId: 'manual-id' });
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_A });
    expect(res.status).toBe(409);
    expect(mockCreatePhone).not.toHaveBeenCalled();
  });

  it('409 when the number is not in the pool / unusable', async () => {
    const { cookie } = await createOwner('gone');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: '+918071387379' });
    expect(res.status).toBe(409);
  });

  it('409 when another org already holds the number', async () => {
    await createOwner('first', { phoneNumber: NUM_C, vapiPhoneNumberId: 'vapi-first' });
    const { org, cookie } = await createOwner('second');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_C });
    expect(res.status).toBe(409);
    expect(mockCreatePhone).not.toHaveBeenCalled();
    const saved = await OrganizationModel.findById(org._id).lean();
    expect(saved?.phoneNumber).toBeUndefined();
  });

  it('502 and rolls back when Vapi import fails', async () => {
    mockCreatePhone.mockRejectedValueOnce(new Error('Vapi API 400'));
    const { org, cookie } = await createOwner('rollback');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_B });
    expect(res.status).toBe(502);
    const saved = await OrganizationModel.findById(org._id).lean();
    expect(saved?.phoneNumber).toBeUndefined();
    expect(saved?.vapiPhoneNumberId).toBeUndefined();
  });

  it('503 when no Vapi inbound credential is configured', async () => {
    (env as Record<string, unknown>).VOBIZ_VAPI_INBOUND_CREDENTIAL_ID = undefined;
    const prev = env.VOBIZ_VAPI_CREDENTIAL_ID;
    (env as Record<string, unknown>).VOBIZ_VAPI_CREDENTIAL_ID = undefined;
    const { cookie } = await createOwner('nocred');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_A });
    (env as Record<string, unknown>).VOBIZ_VAPI_CREDENTIAL_ID = prev;
    expect(res.status).toBe(503);
  });
});

// ── Number automation (2026-10-08) ────────────────────────────────────────────

const inv = (e164: string, extra: Record<string, unknown> = {}) => ({
  e164, country: 'IN', region: 'Karnataka', number_type: 'local', monthly_fee: 500, setup_fee: 100, currency: 'INR', ...extra,
});

describe('trial accounts', () => {
  const trialOrg = { plan: 'free', trialUsed: true, trialEndsAt: new Date(Date.now() + 3 * 86_400_000) };

  it('GET /number reports the trial plan state', async () => {
    const { cookie } = await createOwner('trial-state', trialOrg);
    const res = await request(app).get('/api/v1/telephony/number').set('Cookie', cookie);
    expect(res.body.data).toMatchObject({ phoneNumber: null, planState: 'trial' });
  });

  it('402 NUMBER_NEEDS_PLAN for the picker and for claiming', async () => {
    const { cookie } = await createOwner('trial-pick', trialOrg);
    const list = await request(app).get('/api/v1/telephony/numbers/available').set('Cookie', cookie);
    expect(list.status).toBe(402);
    expect(list.body.code).toBe('NUMBER_NEEDS_PLAN');
    const claim = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_A });
    expect(claim.status).toBe(402);
    expect(mockCreatePhone).not.toHaveBeenCalled();
  });
});

describe('spare numbers + Vobiz inventory', () => {
  beforeEach(() => {
    (env as Record<string, unknown>).VOBIZ_INBOUND_TRUNK_GROUP_ID = 'trunk-in';
  });

  it('lists spares first, then local inventory; hides trial, 92-series, costly and KYC numbers', async () => {
    (env as Record<string, unknown>).VOBIZ_TRIAL_NUMBERS = NUM_C;
    mockInventory.mockResolvedValue([
      inv(INV_B, { monthly_fee: 600 }),
      inv(INV_A),
      inv('+919240953872', { number_type: 'mobile', monthly_fee: 1000 }),  // 92-series
      inv('+918064000009', { monthly_fee: 900 }),                         // above the ₹600 cap
      inv('+918064000008', { aadhaar_verification_required: true }),
      inv(NUM_A),                                                         // already owned
    ]);
    const { cookie } = await createOwner('inv-list');
    const res = await request(app).get('/api/v1/telephony/numbers/available').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.numbers.map((n: { e164: string; source: string }) => `${n.source}:${n.e164}`)).toEqual([
      `owned:${NUM_A}`, `owned:${NUM_B}`, `inventory:${INV_A}`, `inventory:${INV_B}`,
    ]);
  });

  it('passes search digits to the inventory and filters spares', async () => {
    const { cookie } = await createOwner('inv-search');
    const res = await request(app).get('/api/v1/telephony/numbers/available?search=80%207138%207371').set('Cookie', cookie);
    expect(mockInventory).toHaveBeenCalledWith(expect.objectContaining({ search: '8071387371' }));
    expect(res.body.data.numbers.map((n: { e164: string }) => n.e164)).toEqual([NUM_B]);
  });

  it('shows only spares when buying is not configured (no trunk group)', async () => {
    (env as Record<string, unknown>).VOBIZ_INBOUND_TRUNK_GROUP_ID = undefined;
    mockInventory.mockResolvedValue([inv(INV_A)]);
    const { cookie } = await createOwner('inv-off');
    const res = await request(app).get('/api/v1/telephony/numbers/available').set('Cookie', cookie);
    expect(res.body.data.numbers.every((n: { source: string }) => n.source === 'owned')).toBe(true);
    expect(mockInventory).not.toHaveBeenCalled();
  });

  it('buys an inventory number, links it to the trunk, then imports it into Vapi', async () => {
    mockInventory.mockResolvedValue([inv(INV_A)]);
    const { org, cookie } = await createOwner('inv-buy');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: INV_A });
    expect(res.status).toBe(200);
    expect(mockPurchase).toHaveBeenCalledWith(INV_A);
    expect(mockAssignTrunk).toHaveBeenCalledWith(INV_A, 'trunk-in');
    expect(mockCreatePhone).toHaveBeenCalledWith(expect.objectContaining({ number: INV_A }));
    expect((await OrganizationModel.findById(org._id).lean())?.phoneNumber).toBe(INV_A);
  });

  it('links an owned spare to the trunk when it is not linked yet, without buying', async () => {
    mockList.mockImplementation(async () => [vobiz(NUM_A, { trunk_group_id: null })]);
    const { cookie } = await createOwner('spare-link');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_A });
    expect(res.status).toBe(200);
    expect(mockPurchase).not.toHaveBeenCalled();
    expect(mockAssignTrunk).toHaveBeenCalledWith(NUM_A, 'trunk-in');
  });

  it('502 and rolls back when the purchase fails (e.g. low Vobiz balance)', async () => {
    mockInventory.mockResolvedValue([inv(INV_A)]);
    mockPurchase.mockRejectedValueOnce(new Error('Vobiz API 402: insufficient balance'));
    const { org, cookie } = await createOwner('inv-fail');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: INV_A });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('NUMBER_PURCHASE_FAILED');
    expect(mockCreatePhone).not.toHaveBeenCalled();
    expect((await OrganizationModel.findById(org._id).lean())?.phoneNumber).toBeUndefined();
  });

  it('409 for a 92-series or unknown number', async () => {
    mockInventory.mockResolvedValue([inv('+919240953872', { number_type: 'mobile', monthly_fee: 1000 })]);
    const { cookie } = await createOwner('inv-92');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: '+919240953872' });
    expect(res.status).toBe(409);
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('refuses a shared trial number', async () => {
    (env as Record<string, unknown>).VOBIZ_TRIAL_NUMBERS = NUM_A;
    const { cookie } = await createOwner('trial-num');
    const res = await request(app).post('/api/v1/telephony/number').set('Cookie', cookie).send({ e164: NUM_A });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/telephony/number/auto', () => {
  it('takes the first spare number (no purchase)', async () => {
    const { cookie } = await createOwner('auto-spare');
    const res = await request(app).post('/api/v1/telephony/number/auto').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.phoneNumber).toBe(NUM_A);
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('buys from inventory when there are no spares', async () => {
    (env as Record<string, unknown>).VOBIZ_INBOUND_TRUNK_GROUP_ID = 'trunk-in';
    mockList.mockImplementation(async () => []);
    mockInventory.mockResolvedValue([inv(INV_A)]);
    const { cookie } = await createOwner('auto-buy');
    const res = await request(app).post('/api/v1/telephony/number/auto').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.phoneNumber).toBe(INV_A);
    expect(mockPurchase).toHaveBeenCalledWith(INV_A);
  });

  it('409 NO_NUMBERS_AVAILABLE when nothing is free', async () => {
    mockList.mockImplementation(async () => []);
    const { cookie } = await createOwner('auto-none');
    const res = await request(app).post('/api/v1/telephony/number/auto').set('Cookie', cookie);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_NUMBERS_AVAILABLE');
  });
});

describe('releaseOrgNumber (plan cancelled)', () => {
  it('unlinks the number from Vapi and the org, keeping it as a spare', async () => {
    const { releaseOrgNumber } = await import('@/modules/telephony/number.service');
    const { org } = await createOwner('release', { phoneNumber: NUM_A, vapiPhoneNumberId: 'vapi-old' });
    await releaseOrgNumber(org._id.toString());
    expect(mockDeletePhone).toHaveBeenCalledWith('vapi-old');
    const saved = await OrganizationModel.findById(org._id).lean();
    expect(saved?.phoneNumber).toBeUndefined();
    expect(saved?.vapiPhoneNumberId).toBeUndefined();

    const { cookie } = await createOwner('after-release');
    const res = await request(app).get('/api/v1/telephony/numbers/available').set('Cookie', cookie);
    expect(res.body.data.numbers.map((n: { e164: string }) => n.e164)).toContain(NUM_A);
  });
});

