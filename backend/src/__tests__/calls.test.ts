/**
 * L2.F5 — Calls Module Integration Tests
 *
 * Routes under test (mounted at /api/v1/calls):
 *   GET /              — paginated call list with filters
 *   GET /:id           — call detail with transcript + summary
 *
 * Tenant isolation: each test org only sees its own calls;
 * fetching another org's call ID must return 404.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import {
  OrganizationModel,
  MembershipModel,
} from '@/modules/organization/organization.model';
import {
  CallModel,
  TranscriptModel,
  SummaryModel,
} from '@/modules/calls/call.model';
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
    name: 'Owner User',
    email: `calls-owner-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified: true,
    status: 'Active',
  });
  const org = await OrganizationModel.create({
    name: 'Calls Test Org',
    slug: `calls-org-${suffix}`,
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
    name: `Test Agent ${suffix}`,
    systemPrompt: 'You are a helpful assistant.',
    vapiAssistantId: `vapi-${suffix}`,
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
    createdAt: Date;
  }> = {},
) {
  const vapiCallId = new mongoose.Types.ObjectId().toString();
  return CallModel.create({
    organizationId: orgId,
    agentId,
    vapiCallId,
    direction: overrides.direction ?? 'Inbound',
    duration: 120,
    status: overrides.status ?? 'completed',
    callerNumber: overrides.callerNumber ?? '+919999999999',
    cost: 0.05,
    createdAt: overrides.createdAt ?? new Date(),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Calls Module', () => {
  describe('GET /api/v1/calls — list calls', () => {
    it('returns paginated call list for the org', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);
      await seedCall(org._id, agent._id);
      await seedCall(org._id, agent._id);

      const res = await request(app)
        .get('/api/v1/calls')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calls).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
    });

    it('filters by status', async () => {
      const ts = Date.now() + 1;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);
      await seedCall(org._id, agent._id, { status: 'completed' });
      await seedCall(org._id, agent._id, { status: 'failed' });

      const res = await request(app)
        .get('/api/v1/calls?status=completed')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.calls).toHaveLength(1);
      expect(res.body.data.calls[0].status).toBe('completed');
    });

    it('filters by direction', async () => {
      const ts = Date.now() + 2;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);
      await seedCall(org._id, agent._id, { direction: 'Inbound' });
      await seedCall(org._id, agent._id, { direction: 'Outbound' });

      const res = await request(app)
        .get('/api/v1/calls?direction=Outbound')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.calls).toHaveLength(1);
      expect(res.body.data.calls[0].direction).toBe('Outbound');
    });

    it('filters by date range', async () => {
      const ts = Date.now() + 3;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);

      const old = new Date('2023-01-01T10:00:00Z');
      const recent = new Date('2024-06-01T10:00:00Z');
      await seedCall(org._id, agent._id, { createdAt: old });
      await seedCall(org._id, agent._id, { createdAt: recent });

      const res = await request(app)
        .get('/api/v1/calls?dateFrom=2024-01-01')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.calls).toHaveLength(1);
    });

    it('returns empty list when org has no calls', async () => {
      const ts = Date.now() + 4;
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .get('/api/v1/calls')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.calls).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/calls');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/calls/:id — call detail', () => {
    it('returns call with transcript and summary', async () => {
      const ts = Date.now() + 5;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);
      const call = await seedCall(org._id, agent._id);

      await TranscriptModel.create({
        callId: call._id,
        turns: [
          { speaker: 'agent', text: 'Hello!', timestamp: new Date() },
          { speaker: 'user', text: 'Hi there', timestamp: new Date() },
        ],
      });
      await SummaryModel.create({
        callId: call._id,
        summaryText: 'Customer called about billing.',
        intentDetected: ['billing_inquiry'],
        actionItems: ['follow up via email'],
        resolutionState: 'Resolved',
      });

      const res = await request(app)
        .get(`/api/v1/calls/${call._id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.call).toBeDefined();
      expect(res.body.data.transcript.turns).toHaveLength(2);
      expect(res.body.data.summary.summaryText).toBe('Customer called about billing.');
    });

    it('returns call detail with null transcript and summary when missing', async () => {
      const ts = Date.now() + 6;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const agent = await createAgent(org._id, ts);
      const call = await seedCall(org._id, agent._id);

      const res = await request(app)
        .get(`/api/v1/calls/${call._id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.call).toBeDefined();
      expect(res.body.data.transcript).toBeNull();
      expect(res.body.data.summary).toBeNull();
    });

    it('returns 404 for another org call — tenant isolation', async () => {
      const ts = Date.now() + 7;
      const { org: org1, cookie: cookie1 } = await createOwnerWithOrg(`${ts}-a`);
      const { org: org2 } = await createOwnerWithOrg(`${ts}-b`);
      const agent1 = await createAgent(org1._id, `${ts}-a`);
      const agent2 = await createAgent(org2._id, `${ts}-b`);
      const callOrg2 = await seedCall(org2._id, agent2._id);

      // org1's cookie tries to fetch org2's call
      const res = await request(app)
        .get(`/api/v1/calls/${callOrg2._id}`)
        .set('Cookie', cookie1);

      // suppress unused warning
      void agent1;

      expect(res.status).toBe(404);
    });

    it('returns 404 for non-existent call id', async () => {
      const ts = Date.now() + 8;
      const { cookie } = await createOwnerWithOrg(ts);
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/v1/calls/${fakeId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
    });
  });
});
