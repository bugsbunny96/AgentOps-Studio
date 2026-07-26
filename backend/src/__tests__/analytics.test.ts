/**
 * L2.F7 — Analytics Module Integration Tests
 *
 * Routes under test (mounted at /api/v1/analytics):
 *   GET /overview        — KPI cards: totalCalls, callsToday, callsThisWeek, etc.
 *   GET /calls-per-day   — [{date, count}] for bar chart; fills zeros for days with no calls
 *   GET /top-callers     — [{callerNumber, count, lastCall, totalDuration}]
 *
 * All routes are scoped to the authenticated user's org — tested with seeded calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import {
  OrganizationModel,
  MembershipModel,
} from '@/modules/organization/organization.model';
import { CallModel, SummaryModel } from '@/modules/calls/call.model';
import { VoiceAgentModel } from '@/modules/agents/agent.model';
import { signAccessToken } from '@/utils/jwt';
import mongoose from 'mongoose';

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

vi.mock('@/utils/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
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
    name: 'Analytics Owner',
    email: `analytics-owner-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified: true,
    status: 'Active',
  });
  const org = await OrganizationModel.create({
    name: 'Analytics Test Org',
    slug: `analytics-org-${suffix}`,
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

async function createAgent(orgId: mongoose.Types.ObjectId, suffix: string | number) {
  return VoiceAgentModel.create({
    organizationId: orgId,
    name: `Analytics Agent ${suffix}`,
    systemPrompt: 'You are a helpful assistant.',
    vapiAssistantId: `vapi-analytics-${suffix}`,
    voiceProvider: 'openai',
    voiceId: 'nova',
    primaryLanguage: 'en-US',
    supportedLanguages: ['en-US'],
    status: 'Active',
  });
}

async function seedCall(
  orgId: mongoose.Types.ObjectId,
  agentId: mongoose.Types.ObjectId,
  overrides: Partial<{
    status: 'active' | 'completed' | 'failed';
    direction: 'Inbound' | 'Outbound';
    callerNumber: string;
    duration: number;
    cost: number;
    createdAt: Date;
  }> = {},
) {
  const vapiCallId = new mongoose.Types.ObjectId().toString();
  return CallModel.create({
    organizationId: orgId,
    agentId,
    vapiCallId,
    direction: overrides.direction ?? 'Inbound',
    duration: overrides.duration ?? 90,
    status: overrides.status ?? 'completed',
    callerNumber: overrides.callerNumber ?? '+919999999999',
    cost: overrides.cost ?? 0.05,
    createdAt: overrides.createdAt ?? new Date(),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Analytics Module', () => {
  describe('GET /api/v1/analytics/overview', () => {
    it('returns zeroed KPIs when org has no calls', async () => {
      const ts = Date.now();
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.totalCalls).toBe(0);
      expect(d.callsToday).toBe(0);
      expect(d.callsThisWeek).toBe(0);
      expect(d.activeCalls).toBe(0);
      expect(d.avgDurationSec).toBe(0);
      expect(d.resolutionRate).toBe(0);
    });

    it('returns correct totalCalls and callsToday', async () => {
      const ts = Date.now() + 1;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);

      // 2 calls today
      await seedCall(org._id, agent._id, { createdAt: new Date() });
      await seedCall(org._id, agent._id, { createdAt: new Date() });
      // 1 call from 10 days ago (not today)
      const old = new Date();
      old.setDate(old.getDate() - 10);
      await seedCall(org._id, agent._id, { createdAt: old });

      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.totalCalls).toBe(3);
      expect(res.body.data.callsToday).toBe(2);
    });

    it('counts active calls separately', async () => {
      const ts = Date.now() + 2;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);

      await seedCall(org._id, agent._id, { status: 'active' });
      await seedCall(org._id, agent._id, { status: 'completed' });

      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.activeCalls).toBe(1);
    });

    it('calculates resolutionRate from summaries', async () => {
      const ts = Date.now() + 3;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);

      const call1 = await seedCall(org._id, agent._id, { status: 'completed' });
      const call2 = await seedCall(org._id, agent._id, { status: 'completed' });
      // Only call1 has a summary
      await SummaryModel.create({
        callId: call1._id,
        summaryText: 'Issue resolved.',
        resolutionState: 'Resolved',
      });
      void call2;

      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      // 1 summary out of 2 completed calls = 50%
      expect(res.body.data.resolutionRate).toBe(50);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/analytics/overview');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/analytics/calls-per-day', () => {
    it('returns 30 data points (one per day) with zeros for days without calls', async () => {
      const ts = Date.now() + 4;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);
      // 1 call today
      await seedCall(org._id, agent._id, { createdAt: new Date() });

      const res = await request(app)
        .get('/api/v1/analytics/calls-per-day')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const points = res.body.data;
      expect(points).toHaveLength(30);
      // Last point is today — must have count >= 1
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayPoint = points.find((p: { date: string; count: number }) => p.date === todayStr);
      expect(todayPoint).toBeDefined();
      expect(todayPoint.count).toBeGreaterThanOrEqual(1);
      // All points have the date field in YYYY-MM-DD format
      points.forEach((p: { date: string }) => {
        expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('respects the ?days query param', async () => {
      const ts = Date.now() + 5;
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .get('/api/v1/analytics/calls-per-day?days=7')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(7);
    });
  });

  describe('GET /api/v1/analytics/top-callers', () => {
    it('returns callers sorted by call count descending', async () => {
      const ts = Date.now() + 6;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);

      // +91111 calls 3 times, +92222 calls 1 time
      await seedCall(org._id, agent._id, { callerNumber: '+911111111111' });
      await seedCall(org._id, agent._id, { callerNumber: '+911111111111' });
      await seedCall(org._id, agent._id, { callerNumber: '+911111111111' });
      await seedCall(org._id, agent._id, { callerNumber: '+922222222222' });

      const res = await request(app)
        .get('/api/v1/analytics/top-callers')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const callers = res.body.data;
      expect(callers).toHaveLength(2);
      expect(callers[0].callerNumber).toBe('+911111111111');
      expect(callers[0].count).toBe(3);
      expect(callers[1].callerNumber).toBe('+922222222222');
      expect(callers[1].count).toBe(1);
    });

    it('returns empty array when org has no calls', async () => {
      const ts = Date.now() + 7;
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .get('/api/v1/analytics/top-callers')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('respects the ?limit query param', async () => {
      const ts = Date.now() + 8;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);

      // 5 distinct callers
      for (let i = 1; i <= 5; i++) {
        await seedCall(org._id, agent._id, { callerNumber: `+9100000000${i}` });
      }

      const res = await request(app)
        .get('/api/v1/analytics/top-callers?limit=3')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
    });
  });
});
