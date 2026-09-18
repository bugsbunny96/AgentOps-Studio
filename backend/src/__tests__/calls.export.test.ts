/**
 * L2.F5 — Calls Export Integration Tests
 *
 * Routes under test:
 *   GET /api/v1/calls/export — CSV download with optional filters
 *
 * Verifies:
 *   - 401 when unauthenticated
 *   - Content-Type: text/csv
 *   - Content-Disposition: attachment; filename=...
 *   - Header row always present
 *   - Data rows match seeded calls
 *   - Filter by status
 *   - Filter by dateFrom / dateTo
 *   - Empty result returns header-only CSV
 *   - Tenant isolation (only own org's calls exported)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';
import {
  OrganizationModel,
  MembershipModel,
} from '@/modules/organization/organization.model';
import { CallModel } from '@/modules/calls/call.model';
import { VoiceAgentModel } from '@/modules/agents/agent.model';
import { signAccessToken } from '@/utils/jwt';
import mongoose from 'mongoose';

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
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createOwnerWithOrg(suffix: string | number = Date.now()) {
  const user = await UserModel.create({
    name: 'Owner',
    email: `owner-export-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified: true,
    status: 'Active',
  });
  const org = await OrganizationModel.create({
    name: 'Export Test Org',
    slug: `export-org-${suffix}`,
    ownerId: user._id,
    industry: 'Technology',
    timezone: 'Asia/Kolkata',
    onboardingStatus: 'COMPLETED',
    businessHours: { start: '09:00', end: '18:00' },
  });
  await MembershipModel.create({ userId: user._id, organizationId: org._id, role: 'Owner' });
  const token = signAccessToken({ userId: user._id.toString(), email: user.email });
  return { user, org, cookie: `accessToken=${token}` };
}

async function createAgent(orgId: mongoose.Types.ObjectId, suffix: string | number) {
  return VoiceAgentModel.create({
    organizationId: orgId,
    name: `Export Agent ${suffix}`,
    systemPrompt: 'You are a helpful assistant.',
    vapiAssistantId: `vapi-export-${suffix}`,
    voiceProvider: 'openai',
    voiceId: 'nova',
    primaryLanguage: 'en-US',
    supportedLanguages: ['en-US'],
    status: 'Active',
  });
}

interface SeedCallOptions {
  status?: 'active' | 'completed' | 'failed';
  direction?: 'Inbound' | 'Outbound';
  createdAt?: Date;
  callerNumber?: string;
  duration?: number;
  cost?: number;
}

async function seedCall(
  orgId: mongoose.Types.ObjectId,
  agentId: mongoose.Types.ObjectId,
  opts: SeedCallOptions = {},
) {
  const doc = await CallModel.create({
    organizationId: orgId,
    agentId,
    vapiCallId: `vapi-exp-${Math.random().toString(36).slice(2)}`,
    direction: opts.direction ?? 'Inbound',
    duration: opts.duration ?? 90,
    status: opts.status ?? 'completed',
    callerNumber: opts.callerNumber ?? '+911234567890',
    cost: opts.cost ?? 1.5,
  });
  if (opts.createdAt) {
    // Use native driver to bypass mongoose's timestamp immutability
    await CallModel.collection.updateOne({ _id: doc._id }, { $set: { createdAt: opts.createdAt } });
  }
  return doc;
}

// CSV header expected in every export response
const CSV_HEADER = 'id,caller_number,direction,status,duration_seconds,duration_formatted,ended_reason,date';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/calls/export', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/calls/export');
    expect(res.status).toBe(401);
  });

  it('returns CSV with correct Content-Type and Content-Disposition headers', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(ts);
    const agent = await createAgent(org._id, ts);
    await seedCall(org._id, agent._id);

    const res = await request(app)
      .get('/api/v1/calls/export')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/calls-export-/);
    expect(res.headers['content-disposition']).toMatch(/\.csv/);
  });

  it('always includes the header row', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(`hdr-${ts}`);

    const res = await request(app)
      .get('/api/v1/calls/export')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const lines = (res.text as string).trim().split('\n');
    expect(lines[0]).toBe(CSV_HEADER);
  });

  it('returns header-only CSV when the org has no calls', async () => {
    const ts = Date.now();
    const { cookie } = await createOwnerWithOrg(`empty-${ts}`);

    const res = await request(app)
      .get('/api/v1/calls/export')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const lines = (res.text as string).trim().split('\n');
    expect(lines).toHaveLength(1);      // header only
    expect(lines[0]).toBe(CSV_HEADER);
  });

  it('exports all calls for the org (data rows)', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(`all-${ts}`);
    const agent = await createAgent(org._id, `all-${ts}`);

    await Promise.all([
      seedCall(org._id, agent._id, { callerNumber: '+910000000001' }),
      seedCall(org._id, agent._id, { callerNumber: '+910000000002' }),
      seedCall(org._id, agent._id, { callerNumber: '+910000000003' }),
    ]);

    const res = await request(app)
      .get('/api/v1/calls/export')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const lines = (res.text as string).trim().split('\n');
    // 1 header + 3 data rows
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(CSV_HEADER);

    const body = lines.slice(1).join('\n');
    expect(body).toContain('+910000000001');
    expect(body).toContain('+910000000002');
    expect(body).toContain('+910000000003');
  });

  it('each data row contains caller_number, direction, status, duration, date — no internal cost', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(`row-${ts}`);
    const agent = await createAgent(org._id, `row-${ts}`);

    await seedCall(org._id, agent._id, {
      callerNumber: '+919876543210',
      direction: 'Outbound',
      status: 'completed',
      duration: 125,
      cost: 2.75,
    });

    const res = await request(app)
      .get('/api/v1/calls/export')
      .set('Cookie', cookie);

    const dataRow = (res.text as string).trim().split('\n')[1]!;
    expect(dataRow).toContain('+919876543210');
    expect(dataRow).toContain('Outbound');
    expect(dataRow).toContain('completed');
    expect(dataRow).toContain('125');          // duration_seconds
    expect(dataRow).toContain('2m 05s');       // duration_formatted
    // Internal vendor cost must never appear in a customer-facing export.
    expect(dataRow).not.toContain('2.75');
  });

  it('filters by status=completed', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(`status-${ts}`);
    const agent = await createAgent(org._id, `status-${ts}`);

    await seedCall(org._id, agent._id, { status: 'completed', callerNumber: '+911111111111' });
    await seedCall(org._id, agent._id, { status: 'failed',    callerNumber: '+912222222222' });
    await seedCall(org._id, agent._id, { status: 'active',    callerNumber: '+913333333333' });

    const res = await request(app)
      .get('/api/v1/calls/export')
      .query({ status: 'completed' })
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const lines = (res.text as string).trim().split('\n');
    expect(lines).toHaveLength(2);  // header + 1 row
    expect(lines[1]).toContain('+911111111111');
    expect(lines[1]).not.toContain('+912222222222');
  });

  it('filters by direction=Outbound', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(`dir-${ts}`);
    const agent = await createAgent(org._id, `dir-${ts}`);

    await seedCall(org._id, agent._id, { direction: 'Inbound',  callerNumber: '+910101010101' });
    await seedCall(org._id, agent._id, { direction: 'Outbound', callerNumber: '+910202020202' });

    const res = await request(app)
      .get('/api/v1/calls/export')
      .query({ direction: 'Outbound' })
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const body = (res.text as string);
    expect(body).toContain('+910202020202');
    expect(body).not.toContain('+910101010101');
  });

  it('filters by dateFrom and dateTo', async () => {
    const ts = Date.now();
    const { org, cookie } = await createOwnerWithOrg(`date-${ts}`);
    const agent = await createAgent(org._id, `date-${ts}`);

    // Three calls at different dates
    await seedCall(org._id, agent._id, {
      callerNumber: '+910001000100',
      createdAt: new Date('2024-01-10T12:00:00Z'),
    });
    await seedCall(org._id, agent._id, {
      callerNumber: '+910002000200',
      createdAt: new Date('2024-02-15T12:00:00Z'),
    });
    await seedCall(org._id, agent._id, {
      callerNumber: '+910003000300',
      createdAt: new Date('2024-03-20T12:00:00Z'),
    });

    const res = await request(app)
      .get('/api/v1/calls/export')
      .query({ dateFrom: '2024-02-01', dateTo: '2024-02-28' })
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const body = res.text as string;
    expect(body).toContain('+910002000200');
    expect(body).not.toContain('+910001000100');
    expect(body).not.toContain('+910003000300');
  });

  it('only exports calls belonging to the authenticated user\'s org (tenant isolation)', async () => {
    const ts = Date.now();
    const { org: orgA, cookie: cookieA } = await createOwnerWithOrg(`ta-${ts}`);
    const { org: orgB }                  = await createOwnerWithOrg(`tb-${ts}`);

    const agentA = await createAgent(orgA._id, `ta-${ts}`);
    const agentB = await createAgent(orgB._id, `tb-${ts}`);

    await seedCall(orgA._id, agentA._id, { callerNumber: '+91AAAAAAAAAA' });
    await seedCall(orgB._id, agentB._id, { callerNumber: '+91BBBBBBBBBB' });

    const res = await request(app)
      .get('/api/v1/calls/export')
      .set('Cookie', cookieA);  // authenticated as org A

    expect(res.status).toBe(200);
    expect(res.text).toContain('+91AAAAAAAAAA');
    expect(res.text).not.toContain('+91BBBBBBBBBB');
  });
});
