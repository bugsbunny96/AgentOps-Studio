/**
 * Number automation + outbound limits (2026-10-08)
 *
 *   - phone parsing (single + pasted lists)
 *   - outbound calling hours (IST window)
 *   - who calls from which number: paid → own; trial → shared trial number
 *     (least busy); paid without number → 422; trial ended → 402
 *   - outbound checks: minutes, simultaneous calls
 *   - call lists: create limits, step processing (dial, busy retry, stop on minutes)
 *   - callbacks to a shared trial number reach the trial business that called
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '@/app';
import { env } from '@/config/env';
import { UserModel } from '@/modules/auth/auth.model';
import { OrganizationModel, MembershipModel } from '@/modules/organization/organization.model';
import { VoiceAgentModel } from '@/modules/agents/agent.model';
import { CallModel } from '@/modules/calls/call.model';
import { CallBatchModel } from '@/modules/calls/call-batch.model';
import { signAccessToken } from '@/utils/jwt';
import { startOfMonthUTC } from '@/utils/callMinutes';
import { normalizePhone, parsePhoneList } from '@/modules/calls/outbound.service';
import { nextOutboundWindow, parseHoursWindow } from '@/modules/calls/call-capacity';
import { processBatchStep, BUSY_RETRY_MS, NEXT_CALL_GAP_MS } from '@/modules/calls/call-batch.service';
import { handleAssistantRequest } from '@/modules/calls/webhook.service';

const { mockOutbound, mockEnqueue } = vi.hoisted(() => ({
  mockOutbound: vi.fn(),
  mockEnqueue:  vi.fn(),
}));

vi.mock('@/modules/agents/vapi.service', () => ({
  vapiInitiateOutboundCall: mockOutbound,
  vapiCreatePhoneNumber:    vi.fn(),
  vapiDeletePhoneNumber:    vi.fn(),
  vapiCreateAssistant:      vi.fn().mockResolvedValue({ id: 'stub' }),
  vapiUpdateAssistant:      vi.fn().mockResolvedValue({}),
  vapiDeleteAssistant:      vi.fn().mockResolvedValue(undefined),
  vapiCreateWebCall:        vi.fn().mockResolvedValue({ id: 'stub', webCallUrl: 'https://stub' }),
}));

vi.mock('@/jobs/outboundBatch.queue', () => ({
  enqueueBatchStep:   mockEnqueue,
  outboundBatchQueue: { add: vi.fn() },
}));

vi.mock('@/config/redis', () => ({
  redis: { setex: vi.fn().mockResolvedValue('OK'), get: vi.fn().mockResolvedValue(null), del: vi.fn().mockResolvedValue(1) },
}));

vi.mock('@/utils/email', () => ({
  sendEmail:              vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail:  vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendUsageAlertEmail:    vi.fn().mockResolvedValue(undefined),
  sendChooseNumberEmail:  vi.fn().mockResolvedValue(undefined),
}));

const saved = { ids: env.VAPI_TRIAL_PHONE_NUMBER_IDS, trialMax: env.TRIAL_BATCH_MAX_NUMBERS };
afterAll(() => {
  (env as Record<string, unknown>).VAPI_TRIAL_PHONE_NUMBER_IDS = saved.ids;
  (env as Record<string, unknown>).TRIAL_BATCH_MAX_NUMBERS = saved.trialMax;
});

let callSeq = 0;
beforeEach(() => {
  vi.clearAllMocks();
  (env as Record<string, unknown>).VAPI_TRIAL_PHONE_NUMBER_IDS = 'trial_a,trial_b';
  (env as Record<string, unknown>).TRIAL_BATCH_MAX_NUMBERS = 20;
  mockOutbound.mockImplementation(async () => ({ id: `vapi-call-${++callSeq}` }));
  mockEnqueue.mockResolvedValue(undefined);
});

const DAY = 86_400_000;
const TRIAL = { plan: 'free', trialUsed: true, trialEndsAt: new Date(Date.now() + 3 * DAY) };
const EXPIRED = { plan: 'free', trialUsed: true, trialEndsAt: new Date(Date.now() - DAY) };

async function setup(orgExtra: Record<string, unknown> = {}) {
  const s = new mongoose.Types.ObjectId().toString();
  const user = await UserModel.create({ name: 'Owner', email: `na-${s}@example.com`, passwordHash: '$2a$12$placeholder', isVerified: true, status: 'Active' });
  const org = await OrganizationModel.create({
    name: `NA ${s}`, slug: `na-${s}`, ownerId: user._id, industry: 'Retail', timezone: 'Asia/Kolkata',
    onboardingStatus: 'COMPLETED', businessHours: { start: '00:00', end: '23:59' }, vapiAssistantId: 'asst-org', ...orgExtra,
  });
  await MembershipModel.create({ userId: user._id, organizationId: org._id, role: 'Owner' });
  const agent = await VoiceAgentModel.create({
    organizationId: org._id, name: 'Agent', systemPrompt: 'x', vapiAssistantId: `asst-${s}`,
    voiceProvider: 'openai', voiceId: 'nova', primaryLanguage: 'en-US', supportedLanguages: ['en-US'], status: 'Active',
  });
  const cookie = `accessToken=${signAccessToken({ userId: user._id.toString(), email: user.email })}`;
  return { user, org, agent, cookie };
}

const call = (cookie: string, agentId: string, phoneNumber = '98765 43210') =>
  request(app).post('/api/v1/calls/initiate').set('Cookie', cookie).send({ phoneNumber, agentId });

// ── Pure helpers ──────────────────────────────────────────────────────────────
describe('phone parsing', () => {
  it('normalises Indian formats to E.164', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('098765-43210')).toBe('+919876543210');
    expect(normalizePhone('080 1234 5678')).toBe('+918012345678');
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('+12025551234')).toBe('+12025551234');
    expect(normalizePhone('12345')).toBeNull();
  });

  it('splits a pasted list, de-duplicates and reports rejects', () => {
    expect(parsePhoneList('98765 43210\n+919876543210, 91234 56789; nope')).toEqual({
      numbers: ['+919876543210', '+919123456789'], invalid: ['nope'],
    });
  });
});

describe('outbound calling hours (IST)', () => {
  it('parses the window and falls back to 09:00–21:00', () => {
    expect(parseHoursWindow('10:30-18:00')).toEqual({ start: 630, end: 1080 });
    expect(parseHoursWindow('bad')).toEqual({ start: 540, end: 1260 });
  });

  it('is open inside the window and points to the next opening outside it', () => {
    expect(nextOutboundWindow(new Date('2026-10-08T06:00:00Z'), '09:00-21:00')).toBeNull();        // 11:30 IST
    expect(nextOutboundWindow(new Date('2026-10-08T16:00:00Z'), '09:00-21:00')?.toISOString())     // 21:30 IST
      .toBe('2026-10-09T03:30:00.000Z');                                                            // 09:00 IST next day
    expect(nextOutboundWindow(new Date('2026-10-08T01:00:00Z'), '09:00-21:00')?.toISOString())     // 06:30 IST
      .toBe('2026-10-08T03:30:00.000Z');
  });
});

// ── Single calls ──────────────────────────────────────────────────────────────
describe('POST /calls/initiate — caller number and checks', () => {
  it('paid plan calls from its own number', async () => {
    const { agent, cookie } = await setup({ plan: 'starter', vapiPhoneNumberId: 'own-phone' });
    const res = await call(cookie, agent.id);
    expect(res.status).toBe(200);
    expect(res.body.data.sharedNumber).toBe(false);
    expect(mockOutbound).toHaveBeenCalledWith(expect.objectContaining({ phoneNumberId: 'own-phone', customer: { number: '+919876543210' } }));
  });

  it('trial calls from the least busy shared trial number and records it', async () => {
    const busyOrg = await setup(TRIAL);
    await CallModel.create({
      organizationId: busyOrg.org._id, agentId: busyOrg.agent._id, vapiCallId: 'busy-1', direction: 'Outbound',
      callerNumber: '+910000000001', status: 'active', duration: 0, cost: 0, fromPhoneNumberId: 'trial_a',
    });
    const { org, agent, cookie } = await setup(TRIAL);
    const res = await call(cookie, agent.id);
    expect(res.status).toBe(200);
    expect(res.body.data.sharedNumber).toBe(true);
    expect(mockOutbound).toHaveBeenCalledWith(expect.objectContaining({ phoneNumberId: 'trial_b' }));
    const rec = await CallModel.findOne({ organizationId: org._id });
    expect(rec?.fromPhoneNumberId).toBe('trial_b');
  });

  it('503 when no shared trial numbers are configured', async () => {
    (env as Record<string, unknown>).VAPI_TRIAL_PHONE_NUMBER_IDS = '';
    const { agent, cookie } = await setup(TRIAL);
    const res = await call(cookie, agent.id);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('TRIAL_CALLING_UNAVAILABLE');
  });

  it('402 PLAN_REQUIRED after the trial ends', async () => {
    const { agent, cookie } = await setup(EXPIRED);
    const res = await call(cookie, agent.id);
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('PLAN_REQUIRED');
    expect(mockOutbound).not.toHaveBeenCalled();
  });

  it('402 MINUTES_EXHAUSTED when trial minutes are used up', async () => {
    const { agent, cookie } = await setup({ ...TRIAL, callMinutesUsed: 30, callMinutesResetAt: startOfMonthUTC() });
    const res = await call(cookie, agent.id);
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('MINUTES_EXHAUSTED');
  });

  it('429 LINES_BUSY over the simultaneous-call limit (trial = 1)', async () => {
    const { agent, cookie } = await setup(TRIAL);
    expect((await call(cookie, agent.id, '9876543210')).status).toBe(200);
    const res = await call(cookie, agent.id, '9123456789');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('LINES_BUSY');
  });

  it('422 OUTSIDE_CALLING_HOURS outside the window', async () => {
    const prev = env.OUTBOUND_CALLING_HOURS;
    (env as Record<string, unknown>).OUTBOUND_CALLING_HOURS = '00:00-00:00';
    const { agent, cookie } = await setup({ plan: 'starter', vapiPhoneNumberId: 'own-phone' });
    const res = await call(cookie, agent.id);
    (env as Record<string, unknown>).OUTBOUND_CALLING_HOURS = prev;
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('OUTSIDE_CALLING_HOURS');
  });
});

// ── Lists ─────────────────────────────────────────────────────────────────────
describe('outbound call lists', () => {
  const create = (cookie: string, agentId: string, numbers: string | string[]) =>
    request(app).post('/api/v1/calls/batches').set('Cookie', cookie).send({ agentId, numbers });

  it('creates a list, reports rejects and queues the first step', async () => {
    const { agent, cookie } = await setup(TRIAL);
    const res = await create(cookie, agent.id, '98765 43210\n91234 56789\nhello');
    expect(res.status).toBe(201);
    expect(res.body.data.invalid).toEqual(['hello']);
    expect(res.body.data.batch.counts).toMatchObject({ total: 2, pending: 2 });
    expect(mockEnqueue).toHaveBeenCalledWith(res.body.data.batch.id, 0);
  });

  it('caps trial lists', async () => {
    (env as Record<string, unknown>).TRIAL_BATCH_MAX_NUMBERS = 2;
    const { agent, cookie } = await setup(TRIAL);
    const res = await create(cookie, agent.id, ['9876543210', '9123456789', '9000000001']);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LIST_TOO_LONG');
  });

  it('allows one running list at a time', async () => {
    const { agent, cookie } = await setup(TRIAL);
    expect((await create(cookie, agent.id, '9876543210')).status).toBe(201);
    const res = await create(cookie, agent.id, '9123456789');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BATCH_ALREADY_RUNNING');
  });

  it('402 for an expired trial', async () => {
    const { agent, cookie } = await setup(EXPIRED);
    expect((await create(cookie, agent.id, '9876543210')).status).toBe(402);
  });

  it('dials one number per step, retries while busy, then completes', async () => {
    const { org, agent, cookie } = await setup(TRIAL);
    const created = await create(cookie, agent.id, '9876543210, 9123456789');
    const id = created.body.data.batch.id as string;

    expect(await processBatchStep(id)).toBe(NEXT_CALL_GAP_MS);                 // first number dialled
    expect(mockOutbound).toHaveBeenCalledTimes(1);
    expect(await processBatchStep(id)).toBe(BUSY_RETRY_MS);                    // trial: 1 call at a time

    await CallModel.updateMany({ organizationId: org._id }, { $set: { status: 'completed' } });
    expect(await processBatchStep(id)).toBe(NEXT_CALL_GAP_MS);                 // second number
    await CallModel.updateMany({ organizationId: org._id }, { $set: { status: 'completed' } });
    expect(await processBatchStep(id)).toBeNull();                             // nothing left

    const batch = await CallBatchModel.findById(id);
    expect(batch?.status).toBe('completed');
    expect(batch?.items.map((i) => i.status)).toEqual(['called', 'called']);
    const calls = await CallModel.find({ batchId: batch!._id });
    expect(calls).toHaveLength(2);
  });

  it('stops and skips the rest when minutes run out', async () => {
    const { org, agent, cookie } = await setup(TRIAL);
    const created = await create(cookie, agent.id, '9876543210, 9123456789');
    const id = created.body.data.batch.id as string;
    await OrganizationModel.updateOne({ _id: org._id }, { $set: { callMinutesUsed: 30, callMinutesResetAt: startOfMonthUTC() } });
    expect(await processBatchStep(id)).toBeNull();
    const batch = await CallBatchModel.findById(id);
    expect(batch?.status).toBe('stopped');
    expect(batch?.items.every((i) => i.status === 'skipped')).toBe(true);
    expect(mockOutbound).not.toHaveBeenCalled();
  });

  it('cancel skips pending numbers', async () => {
    const { agent, cookie } = await setup(TRIAL);
    const id = (await create(cookie, agent.id, '9876543210')).body.data.batch.id as string;
    const res = await request(app).post(`/api/v1/calls/batches/${id}/cancel`).set('Cookie', cookie);
    expect(res.body.data.batch.status).toBe('cancelled');
    expect(await processBatchStep(id)).toBeNull();
  });
});

// ── Callbacks to shared trial numbers ─────────────────────────────────────────
describe('assistant-request on a shared trial number', () => {
  const ring = (from: string) => handleAssistantRequest({
    type: 'assistant-request',
    call: { id: `cb-${from}-${Date.now()}`, type: 'inboundPhoneCall', phoneNumberId: 'trial_a', customer: { number: from } },
  });

  it('routes the callback to the trial business that last called this person', async () => {
    const { org, agent } = await setup(TRIAL);
    await CallModel.create({
      organizationId: org._id, agentId: agent._id, vapiCallId: 'out-1', direction: 'Outbound',
      callerNumber: '+919876543210', status: 'completed', duration: 60, cost: 0, fromPhoneNumberId: 'trial_b',
    });
    expect(await ring('+919876543210')).toEqual({ assistantId: 'asst-org' });
  });

  it('plays a neutral message when nobody called this person', async () => {
    expect(JSON.stringify(await ring('+919999999999'))).toContain('Shared number');
  });
});
