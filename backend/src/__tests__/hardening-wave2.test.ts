/**
 * S-HARDEN Wave 2 — CORE-01, CORE-03, BIZ-01
 * (CORE-04 is a frontend fix: frontend/src/__tests__/utils/unwrapList.test.ts)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '@/app';
import { env } from '@/config/env';
import { toCallReportJobData, toEndOfCallEvent } from '@/jobs/callReport.mapper';
import { isRateLimitExempt } from '@/middleware/rateLimitExempt';
import { currentMonthMinutesUsed, startOfMonthUTC } from '@/utils/callMinutes';
import { handleAssistantRequest, type VapiEndOfCallReportEvent } from '@/modules/calls/webhook.service';
import { OrganizationModel } from '@/modules/organization/organization.model';

const { mockQueueAdd } = vi.hoisted(() => ({ mockQueueAdd: vi.fn() }));

vi.mock('@/jobs/callReport.queue', () => ({
  callReportQueue: { add: mockQueueAdd },
}));

vi.mock('@/config/redis', () => ({
  redis: {
    setex: vi.fn().mockResolvedValue('OK'),
    get:   vi.fn().mockResolvedValue(null),
    del:   vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/utils/email', () => ({
  sendEmail:              vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail:  vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

// ─── Fixture: a realistic end-of-call-report ─────────────────────────────────

const endOfCall: VapiEndOfCallReportEvent = {
  type: 'end-of-call-report',
  call: {
    id:          'call_w2_1',
    assistantId: 'asst_w2',
    type:        'inboundPhoneCall',
    customer:    { number: '+919800000000' },
    endedReason: 'customer-ended-call',
    cost:        0.21,
  },
  durationSeconds: 95,
  recordingUrl:    'https://example.com/old.wav',
  transcript:      'AI: Hello\nUser: I need 10 MCBs',
  messages:        [{ role: 'user', message: 'I need 10 MCBs', time: 1 }],
  summary:         'Customer ordered 10 MCBs.',
  cost:            0.2,
  costBreakdown:   { total: 0.2, llm: 0.01, stt: 0.02, tts: 0.03, vapi: 0.08, transport: 0.06 } as VapiEndOfCallReportEvent['costBreakdown'],
  artifact: {
    recordingUrl:         'https://example.com/new.wav',
    structuredDataOutput: { intent: 'order', followUpNeeded: true } as never,
  },
};

// ─── CORE-01: end-of-call data must reach the worker ─────────────────────────

describe('CORE-01 — call report job keeps artifact and cost data', () => {
  it('round-trips artifact, costBreakdown and call.cost through the job payload', () => {
    const job   = toCallReportJobData(endOfCall);
    // BullMQ stores job data as JSON
    const event = toEndOfCallEvent(JSON.parse(JSON.stringify(job)));

    expect(event.artifact).toEqual(endOfCall.artifact);
    expect(event.costBreakdown).toEqual(endOfCall.costBreakdown);
    expect(event.call.cost).toBe(0.21);
    expect(event.cost).toBe(0.2);
    expect(event.call.customer?.number).toBe('+919800000000');
    expect(event.summary).toBe(endOfCall.summary);
  });

  it('webhook enqueues the job with artifact.structuredDataOutput', async () => {
    mockQueueAdd.mockReset().mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/webhooks/vapi')
      .set('x-vapi-secret', env.VAPI_WEBHOOK_SECRET ?? '')
      .send({ message: endOfCall });

    expect(res.status).toBe(200);
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const [, data] = mockQueueAdd.mock.calls[0];
    expect(data.artifact.structuredDataOutput).toEqual({ intent: 'order', followUpNeeded: true });
    expect(data.artifact.recordingUrl).toBe('https://example.com/new.wav');
    expect(data.costBreakdown.total).toBe(0.2);
  });
});

// ─── CORE-03: Vapi routes skip the global per-IP limiter ─────────────────────

describe('CORE-03 — rate-limit exemptions', () => {
  it.each([
    '/api/v1/webhooks/vapi',
    '/api/v1/webhooks/vapi/',
    '/api/v1/webhooks/vapi?x=1',
    '/api/v1/orders/submit',
    '/api/v1/tools/lookup',
  ])('exempts %s', (url) => {
    expect(isRateLimitExempt(url)).toBe(true);
  });

  it.each([
    '/api/v1/auth/login',
    '/api/v1/orders',
    '/api/v1/orders/abc123',
    '/api/v1/orders/submitted',
    '/api/v1/webhooks/vapix',
    '/api/v1/calls',
    undefined,
  ])('does not exempt %s', (url) => {
    expect(isRateLimitExempt(url)).toBe(false);
  });

  it('a limiter using the exemption never throttles the Vapi webhook', async () => {
    const express = (await import('express')).default;
    const { rateLimit } = await import('express-rate-limit');
    const mini = express();
    mini.use('/api/v1', rateLimit({ windowMs: 60_000, max: 2, skip: (req) => isRateLimitExempt(req.originalUrl) }));
    mini.post('/api/v1/webhooks/vapi', (_req, res) => { res.sendStatus(200); });
    mini.get('/api/v1/calls', (_req, res) => { res.sendStatus(200); });

    for (let i = 0; i < 5; i++) {
      expect((await request(mini).post('/api/v1/webhooks/vapi')).status).toBe(200);
    }
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await request(mini).get('/api/v1/calls')).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});

// ─── BIZ-01: minutes reset at the month boundary even with the worker off ────

describe('BIZ-01 — monthly minutes boundary', () => {
  const now       = new Date(Date.UTC(2026, 9, 15, 12));        // 15 Oct 2026
  const thisMonth = startOfMonthUTC(now);                         // 1 Oct 2026
  const lastMonth = new Date(Date.UTC(2026, 8, 1));               // 1 Sep 2026

  it('treats a counter from a previous month as 0', () => {
    expect(currentMonthMinutesUsed({ callMinutesUsed: 500, callMinutesResetAt: lastMonth }, now)).toBe(0);
  });

  it('keeps the counter for the current month', () => {
    expect(currentMonthMinutesUsed({ callMinutesUsed: 500, callMinutesResetAt: thisMonth }, now)).toBe(500);
  });

  it('falls back to the raw counter when no reset date is stored', () => {
    expect(currentMonthMinutesUsed({ callMinutesUsed: 7 }, now)).toBe(7);
    expect(currentMonthMinutesUsed({}, now)).toBe(0);
  });

  describe('assistant-request gate', () => {
    beforeEach(async () => {
      await OrganizationModel.deleteMany({ vapiPhoneNumberId: /^pn_w2_/ });
    });

    async function makeOrg(phoneId: string, resetAt: Date) {
      return OrganizationModel.create({
        name:              'Wave2 Org',
        slug:              `wave2-${phoneId}`,
        ownerId:           new mongoose.Types.ObjectId(),
        industry:          'Retail',
        timezone:          'Asia/Kolkata',
        onboardingStatus:  'COMPLETED',
        businessHours:     { start: '00:00', end: '23:59' },
        plan:              'starter',
        trialUsed:         true,
        vapiPhoneNumberId: phoneId,
        callMinutesUsed:   1_000_000,
        callMinutesResetAt: resetAt,
      });
    }

    const askFor = (phoneId: string) =>
      handleAssistantRequest({
        type: 'assistant-request',
        call: { id: `call_${phoneId}`, phoneNumberId: phoneId },
      } as never);

    it('blocks an org that is over its limit this month', async () => {
      await makeOrg('pn_w2_current', startOfMonthUTC());
      const res = await askFor('pn_w2_current');
      expect(JSON.stringify(res)).toContain('Limit Reached');
    });

    it('does not block an org whose over-limit counter is from last month', async () => {
      const prev = startOfMonthUTC();
      prev.setUTCMonth(prev.getUTCMonth() - 1);
      await makeOrg('pn_w2_stale', prev);
      const res = await askFor('pn_w2_stale').catch((e: unknown) => ({ threw: String(e) }));
      expect(JSON.stringify(res)).not.toContain('Limit Reached');
    });
  });
});
