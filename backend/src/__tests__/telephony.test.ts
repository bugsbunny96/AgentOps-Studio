/**
 * Onboarding Step 5 — phone number pool (Vobiz → Vapi)
 *
 * Routes under test:
 *   GET  /api/v1/telephony/numbers/available
 *   GET  /api/v1/telephony/number
 *   POST /api/v1/telephony/number
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { env } from '@/config/env';
import { UserModel } from '@/modules/auth/auth.model';
import { OrganizationModel, MembershipModel } from '@/modules/organization/organization.model';
import { signAccessToken } from '@/utils/jwt';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const { mockList, mockConfigured, mockCreatePhone, mockDeletePhone } = vi.hoisted(() => ({
  mockList:        vi.fn(),
  mockConfigured:  vi.fn(),
  mockCreatePhone: vi.fn(),
  mockDeletePhone: vi.fn(),
}));

vi.mock('@/modules/telephony/vobiz.client', () => ({
  listAccountNumbers:   mockList,
  isVobizApiConfigured: mockConfigured,
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

const savedEnv = { cred: env.VOBIZ_VAPI_INBOUND_CREDENTIAL_ID };

beforeAll(async () => {
  await OrganizationModel.syncIndexes(); // make sure the unique phoneNumber index exists
});

afterAll(() => {
  (env as Record<string, unknown>).VOBIZ_VAPI_INBOUND_CREDENTIAL_ID = savedEnv.cred;
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
});

async function createOwner(suffix: string, orgExtra: Record<string, unknown> = {}, role: 'Owner' | 'Member' = 'Owner') {
  const user = await UserModel.create({
    name: 'Owner', email: `tel-${suffix}@example.com`, passwordHash: '$2a$12$placeholder',
    isVerified: true, status: 'Active',
  });
  const org = await OrganizationModel.create({
    name: `Tel Org ${suffix}`, slug: `tel-org-${suffix}`, ownerId: user._id,
    industry: 'Healthcare', timezone: 'Asia/Kolkata', onboardingStatus: 'VOICE_SETUP',
    businessHours: { start: '09:00', end: '18:00' }, ...orgExtra,
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
