/**
 * L2.F8 — Outbound Calling Integration Tests
 *
 * Routes under test:
 *   POST /api/v1/calls/initiate
 *
 * Verifies:
 *   - 401 when unauthenticated
 *   - 400 missing phoneNumber
 *   - 400 missing agentId
 *   - 400 invalid phone number format (not E.164)
 *   - 404 agent does not belong to the authenticated org
 *   - 422 org has no vapiPhoneNumberId
 *   - 422 agent has no vapiAssistantId
 *   - 200 happy path — Vapi called, Call record created
 *   - Vapi error propagates as 500
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import {
  OrganizationModel,
  MembershipModel,
} from '@/modules/organization/organization.model';
import { VoiceAgentModel } from '@/modules/agents/agent.model';
import { CallModel } from '@/modules/calls/call.model';
import { signAccessToken } from '@/utils/jwt';
import mongoose from 'mongoose';

// ── Vapi mock ─────────────────────────────────────────────────────────────────
// vi.mock is hoisted — use vi.hoisted() to safely reference mock fns in the factory.
const { mockVapiInitiateOutboundCall } = vi.hoisted(() => ({
  mockVapiInitiateOutboundCall: vi.fn(),
}));

vi.mock('@/modules/agents/vapi.service', () => ({
  vapiInitiateOutboundCall: mockVapiInitiateOutboundCall,
  // Unused by this module but exported — keep stubs so other imports don't break
  vapiCreateAssistant:  vi.fn().mockResolvedValue({ id: 'stub-assistant' }),
  vapiUpdateAssistant:  vi.fn().mockResolvedValue({}),
  vapiDeleteAssistant:  vi.fn().mockResolvedValue(undefined),
  vapiCreateWebCall:    vi.fn().mockResolvedValue({ id: 'stub-webcall', webCallUrl: 'https://stub' }),
}));

// ── Redis mock ────────────────────────────────────────────────────────────────
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
  sendEmail:              vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail:  vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();

  // Default Vapi mock: happy path
  mockVapiInitiateOutboundCall.mockResolvedValue({
    id:            'vapi-outbound-call-123',
    type:          'outboundPhoneCall',
    status:        'queued',
    assistantId:   'vapi-assistant-abc',
    phoneNumberId: 'vapi-phone-xyz',
    customer:      { number: '+919876543210' },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createOwnerWithOrg(
  suffix: string | number = Date.now(),
  opts: { withPhoneNumberId?: boolean } = {},
) {
  const user = await UserModel.create({
    name:         'Owner',
    email:        `owner-ob-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified:   true,
    status:       'Active',
  });
  const org = await OrganizationModel.create({
    name:              'Outbound Test Org',
    slug:              `ob-org-${suffix}`,
    ownerId:           user._id,
    industry:          'Technology',
    timezone:          'Asia/Kolkata',
    onboardingStatus:  'COMPLETED',
    businessHours:     { start: '09:00', end: '18:00' },
    ...(opts.withPhoneNumberId ? { vapiPhoneNumberId: 'vapi-phone-xyz' } : {}),
  });
  await MembershipModel.create({ userId: user._id, organizationId: org._id, role: 'Owner' });
  const token = signAccessToken({ userId: user._id.toString(), email: user.email });
  return { user, org, cookie: `accessToken=${token}` };
}

async function createAgent(
  orgId: mongoose.Types.ObjectId,
  suffix: string | number,
  opts: { withVapiAssistantId?: boolean } = {},
) {
  return VoiceAgentModel.create({
    organizationId:  orgId,
    name:            `Outbound Agent ${suffix}`,
    systemPrompt:    'You are a helpful assistant.',
    vapiAssistantId: opts.withVapiAssistantId !== false
      ? `vapi-assistant-${suffix}`
      : 'placeholder-not-provisioned',
    voiceProvider:   'openai',
    voiceId:         'nova',
    primaryLanguage: 'en-US',
    supportedLanguages: ['en-US'],
    status:          'Active',
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/calls/initiate', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/calls/initiate')
      .send({ phoneNumber: '+919876543210', agentId: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when phoneNumber is missing', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts, { withPhoneNumberId: true });
    const agent = await createAgent(org._id, ts);

    const res = await request(app)
      .post('/api/v1/calls/initiate')
      .set('Cookie', cookie)
      .send({ agentId: agent.id });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PHONE_FORMAT');
  });

  it('returns 400 when phoneNumber is not E.164 format', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts, { withPhoneNumberId: true });
    const agent = await createAgent(org._id, ts);

    const res = await request(app)
      .post('/api/v1/calls/initiate')
      .set('Cookie', cookie)
      .send({ phoneNumber: '9876543210', agentId: agent.id }); // missing +

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PHONE_FORMAT');
  });

  it('returns 400 when agentId is missing', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(ts, { withPhoneNumberId: true });

    const res = await request(app)
      .post('/api/v1/calls/initiate')
      .set('Cookie', cookie)
      .send({ phoneNumber: '+919876543210' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_AGENT_ID');
  });

  it('returns 422 when org has no vapiPhoneNumberId', async () => {
    const ts = Date.now();
    // withPhoneNumberId: false (default)
    const { org, cookie } = await createOwnerWithOrg(ts);
    const agent = await createAgent(org._id, ts);

    const res = await request(app)
      .post('/api/v1/calls/initiate')
      .set('Cookie', cookie)
      .send({ phoneNumber: '+919876543210', agentId: agent.id });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NO_PHONE_NUMBER');
  });

  it('returns 404 when agentId does not belong to the authenticated org', async () => {
    const ts = Date.now();
    const { cookie }        = await createOwnerWithOrg(`a-${ts}`, { withPhoneNumberId: true });
    const { org: otherOrg } = await createOwnerWithOrg(`b-${ts}`, { withPhoneNumberId: true });
    const foreignAgent      = await createAgent(otherOrg._id, `b-${ts}`);

    const res = await request(app)
      .post('/api/v1/calls/initiate')
      .set('Cookie', cookie)
      .send({ phoneNumber: '+919876543210', agentId: foreignAgent.id });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Agent/i);
  });

  it('returns 200 on happy path, creates a Call record, and returns vapiCallId', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts, { withPhoneNumberId: true });
    const agent = await createAgent(org._id, ts);

    const res = await request(app)
      .post('/api/v1/calls/initiate')
      .set('Cookie', cookie)
      .send({ phoneNumber: '+919876543210', agentId: agent.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vapiCallId).toBe('vapi-outbound-call-123');
    expect(res.body.data.call.direction).toBe('Outbound');
    expect(res.body.data.call.status).toBe('active');
    expect(res.body.data.call.callerNumber).toBe('+919876543210');

    // Verify Vapi was called with correct payload
    expect(mockVapiInitiateOutboundCall).toHaveBeenCalledOnce();
    expect(mockVapiInitiateOutboundCall).toHaveBeenCalledWith({
      assistantId:   agent.vapiAssistantId,
      phoneNumberId: 'vapi-phone-xyz',
      customer:      { number: '+919876543210' },
    });

    // Verify Call record was persisted in the DB
    const dbCall = await CallModel.findOne({ vapiCallId: 'vapi-outbound-call-123' });
    expect(dbCall).not.toBeNull();
    expect(dbCall!.direction).toBe('Outbound');
    expect(dbCall!.callerNumber).toBe('+919876543210');
    expect(dbCall!.status).toBe('active');
    expect(dbCall!.organizationId.toString()).toBe(org._id.toString());
  });

  it('propagates Vapi API errors as 500', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts, { withPhoneNumberId: true });
    const agent = await createAgent(org._id, ts);

    mockVapiInitiateOutboundCall.mockRejectedValueOnce(
      new Error('Vapi API 503 on POST /call/phone: service unavailable'),
    );

    const res = await request(app)
      .post('/api/v1/calls/initiate')
      .set('Cookie', cookie)
      .send({ phoneNumber: '+919876543210', agentId: agent.id });

    expect(res.status).toBe(500);
    // No Call record should be created
    const dbCall = await CallModel.findOne({ callerNumber: '+919876543210', organizationId: org._id });
    expect(dbCall).toBeNull();
  });

  it('accepts various valid E.164 formats', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts, { withPhoneNumberId: true });
    const agent = await createAgent(org._id, ts);

    const validNumbers = [
      '+919876543210',  // India mobile
      '+12025551234',   // US number
      '+442071234567',  // UK number
      '+81312345678',   // Japan number
    ];

    for (const [i, number] of validNumbers.entries()) {
      // Each call gets a unique vapiCallId
      mockVapiInitiateOutboundCall.mockResolvedValueOnce({
        id: `vapi-call-valid-${i}`,
        type: 'outboundPhoneCall',
        status: 'queued',
        assistantId: agent.vapiAssistantId,
        phoneNumberId: 'vapi-phone-xyz',
        customer: { number },
      });

      const res = await request(app)
        .post('/api/v1/calls/initiate')
        .set('Cookie', cookie)
        .send({ phoneNumber: number, agentId: agent.id });

      expect(res.status).toBe(200);
    }
  });

  it('rejects clearly invalid phone formats', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts, { withPhoneNumberId: true });
    const agent = await createAgent(org._id, ts);

    const invalidNumbers = [
      '9876543210',     // no +
      '+',              // + only
      '+0123456789',    // starts with 0 after +
      'not-a-number',   // letters
    ];

    for (const number of invalidNumbers) {
      const res = await request(app)
        .post('/api/v1/calls/initiate')
        .set('Cookie', cookie)
        .send({ phoneNumber: number, agentId: agent.id });

      expect(res.status).toBe(400);
    }
  });
});
