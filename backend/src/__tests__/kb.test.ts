/**
 * L2.F6 — Knowledge Base Module Integration Tests
 *
 * Routes under test (mounted at /api/v1/knowledge-base):
 *   GET    /          — list docs
 *   POST   /          — create manual_text doc
 *   GET    /status    — crawl status + doc counts
 *   POST   /re-sync   — trigger website re-crawl
 *   GET    /:id       — get single doc with full content
 *   PATCH  /:id       — update manual_text doc
 *   DELETE /:id       — delete doc
 *
 * Also unit-tests getKbContext() directly for formatting and truncation behaviour.
 *
 * BullMQ and Vapi are mocked — no real Redis or external HTTP in tests.
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
import { getKbContext } from '@/modules/knowledge-base/kb.service';
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

// ── BullMQ mocks ─────────────────────────────────────────────────────────────
// vi.mock() calls are hoisted to the top of the file by Vitest, so plain `const`
// mock functions referenced inside mock factories would be in the TDZ at call time.
// vi.hoisted() runs at hoist time, making these variables available when the
// mock factories execute. Same pattern used in billing.test.ts.
const { mockKbQueueAdd, mockCrawlQueueAdd } = vi.hoisted(() => ({
  mockKbQueueAdd:    vi.fn().mockResolvedValue({ id: 'kb-job-123' }),
  mockCrawlQueueAdd: vi.fn().mockResolvedValue({ id: 'crawl-job-456' }),
}));

vi.mock('@/jobs/kb.queue', () => ({
  kbQueue: { add: mockKbQueueAdd },
}));

vi.mock('@/jobs/crawl.queue', () => ({
  crawlQueue: { add: mockCrawlQueueAdd },
}));

// ── Vapi mock (used by syncKbToVapi fire-and-forget on deleteDoc) ─────────────
vi.mock('@/modules/agents/vapi.service', () => ({
  vapiUpdateAssistant: vi.fn().mockResolvedValue({}),
}));

beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  mockKbQueueAdd.mockResolvedValue({ id: 'kb-job-123' });
  mockCrawlQueueAdd.mockResolvedValue({ id: 'crawl-job-456' });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createOwnerWithOrg(suffix: string | number = Date.now()) {
  const user = await UserModel.create({
    name: 'KB Owner',
    email: `kb-owner-${suffix}@example.com`,
    passwordHash: '$2a$12$placeholder',
    isVerified: true,
    status: 'Active',
  });
  const org = await OrganizationModel.create({
    name: 'KB Test Org',
    slug: `kb-org-${suffix}`,
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

async function createReadyDoc(
  orgId: mongoose.Types.ObjectId,
  overrides: Partial<{
    title: string;
    content: string;
    sourceType: 'manual_text' | 'website_page' | 'faq_import';
  }> = {},
) {
  return KbDocumentModel.create({
    organizationId: orgId,
    title: overrides.title ?? 'Test Doc',
    content: overrides.content ?? 'This is test content for the knowledge base.',
    sourceType: overrides.sourceType ?? 'manual_text',
    status: 'ready',
    tokenEstimate: 10,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Knowledge Base Module', () => {
  describe('GET /api/v1/knowledge-base — list docs', () => {
    it('returns all docs for the org (content excluded from list)', async () => {
      const ts = Date.now();
      const { org, cookie } = await createOwnerWithOrg(ts);
      await createReadyDoc(org._id, { title: 'FAQ Doc' });
      await createReadyDoc(org._id, { title: 'Policy Doc' });

      const res = await request(app)
        .get('/api/v1/knowledge-base')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.docs).toHaveLength(2);
      // content is excluded from list view
      expect(res.body.data.docs[0].content).toBeUndefined();
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/knowledge-base');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/knowledge-base — create doc', () => {
    it('creates a manual_text doc and enqueues ingest job', async () => {
      const ts = Date.now() + 1;
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .post('/api/v1/knowledge-base')
        .set('Cookie', cookie)
        .send({
          title: 'Refund Policy',
          content: 'We offer a 30-day money-back guarantee on all plans.',
          sourceType: 'manual_text',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Refund Policy');
      expect(res.body.data.status).toBe('pending');
      expect(mockKbQueueAdd).toHaveBeenCalledOnce();
      expect(mockKbQueueAdd).toHaveBeenCalledWith('ingest', expect.objectContaining({
        docId: expect.any(String),
      }));
    });

    it('returns 400 when title is missing', async () => {
      const ts = Date.now() + 2;
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .post('/api/v1/knowledge-base')
        .set('Cookie', cookie)
        .send({ content: 'Some content', sourceType: 'manual_text' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when content is missing', async () => {
      const ts = Date.now() + 3;
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .post('/api/v1/knowledge-base')
        .set('Cookie', cookie)
        .send({ title: 'Title only', sourceType: 'manual_text' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/knowledge-base/:id — get single doc', () => {
    it('returns full content of the doc', async () => {
      const ts = Date.now() + 4;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const doc = await createReadyDoc(org._id, { content: 'Full detailed content here.' });

      const res = await request(app)
        .get(`/api/v1/knowledge-base/${doc._id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('Full detailed content here.');
    });

    it('returns 404 for doc belonging to another org', async () => {
      const ts = Date.now() + 5;
      const { cookie: cookie1 } = await createOwnerWithOrg(`${ts}-a`);
      const { org: org2 } = await createOwnerWithOrg(`${ts}-b`);
      const doc2 = await createReadyDoc(org2._id);

      const res = await request(app)
        .get(`/api/v1/knowledge-base/${doc2._id}`)
        .set('Cookie', cookie1);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/knowledge-base/:id — update doc', () => {
    it('updates title and content; re-queues ingest when content changes', async () => {
      const ts = Date.now() + 6;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const doc = await createReadyDoc(org._id, { title: 'Old Title', content: 'Old content.' });

      const res = await request(app)
        .patch(`/api/v1/knowledge-base/${doc._id}`)
        .set('Cookie', cookie)
        .send({ title: 'New Title', content: 'Completely new content.' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('New Title');
      expect(res.body.data.status).toBe('pending'); // reset for re-ingestion
      expect(mockKbQueueAdd).toHaveBeenCalledOnce();
    });

    it('updates title only without re-queuing ingest', async () => {
      const ts = Date.now() + 7;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const doc = await createReadyDoc(org._id, { title: 'Original Title' });

      const res = await request(app)
        .patch(`/api/v1/knowledge-base/${doc._id}`)
        .set('Cookie', cookie)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
      expect(mockKbQueueAdd).not.toHaveBeenCalled();
    });

    it('returns 400 when trying to update a non-manual_text doc', async () => {
      const ts = Date.now() + 8;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const doc = await createReadyDoc(org._id, { sourceType: 'website_page' });

      const res = await request(app)
        .patch(`/api/v1/knowledge-base/${doc._id}`)
        .set('Cookie', cookie)
        .send({ title: 'New Title' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/knowledge-base/:id — delete doc', () => {
    it('deletes the doc from the database', async () => {
      const ts = Date.now() + 9;
      const { org, cookie } = await createOwnerWithOrg(ts);
      const doc = await createReadyDoc(org._id);

      const res = await request(app)
        .delete(`/api/v1/knowledge-base/${doc._id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const deleted = await KbDocumentModel.findById(doc._id);
      expect(deleted).toBeNull();
    });

    it('returns 404 when deleting a doc that belongs to another org', async () => {
      const ts = Date.now() + 10;
      const { cookie: cookie1 } = await createOwnerWithOrg(`${ts}-a`);
      const { org: org2 } = await createOwnerWithOrg(`${ts}-b`);
      const doc2 = await createReadyDoc(org2._id);

      const res = await request(app)
        .delete(`/api/v1/knowledge-base/${doc2._id}`)
        .set('Cookie', cookie1);

      expect(res.status).toBe(404);
      // doc2 must still exist
      const stillExists = await KbDocumentModel.findById(doc2._id);
      expect(stillExists).not.toBeNull();
    });
  });

  describe('POST /api/v1/knowledge-base/re-sync — trigger resync', () => {
    it('returns 400 when org has no websiteUrl', async () => {
      const ts = Date.now() + 11;
      const { cookie } = await createOwnerWithOrg(ts);

      const res = await request(app)
        .post('/api/v1/knowledge-base/re-sync')
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
    });

    it('returns 400 when crawl is not enabled', async () => {
      const ts = Date.now() + 12;
      const { org, cookie } = await createOwnerWithOrg(ts);
      await OrganizationModel.findByIdAndUpdate(org._id, {
        $set: { websiteUrl: 'https://example.com', crawlEnabled: false },
      });

      const res = await request(app)
        .post('/api/v1/knowledge-base/re-sync')
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
    });

    it('enqueues crawl job when websiteUrl and crawlEnabled are set', async () => {
      const ts = Date.now() + 13;
      const { org, cookie } = await createOwnerWithOrg(ts);
      await OrganizationModel.findByIdAndUpdate(org._id, {
        $set: {
          websiteUrl: 'https://example.com',
          crawlEnabled: true,
          crawlStatus: 'idle',
        },
      });

      const res = await request(app)
        .post('/api/v1/knowledge-base/re-sync')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(mockCrawlQueueAdd).toHaveBeenCalledOnce();
      expect(mockCrawlQueueAdd).toHaveBeenCalledWith('crawl', expect.objectContaining({
        websiteUrl: 'https://example.com',
      }));
    });

    it('returns 400 when a crawl is already in progress', async () => {
      const ts = Date.now() + 14;
      const { org, cookie } = await createOwnerWithOrg(ts);
      await OrganizationModel.findByIdAndUpdate(org._id, {
        $set: {
          websiteUrl: 'https://example.com',
          crawlEnabled: true,
          crawlStatus: 'processing',
        },
      });

      const res = await request(app)
        .post('/api/v1/knowledge-base/re-sync')
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(mockCrawlQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('getKbContext() — unit tests', () => {
    it('returns empty string when no ready docs exist', async () => {
      const ts = Date.now() + 15;
      const { org } = await createOwnerWithOrg(ts);
      // only pending doc — should not appear
      await KbDocumentModel.create({
        organizationId: org._id,
        title: 'Pending Doc',
        content: 'Not ready yet.',
        sourceType: 'manual_text',
        status: 'pending',
        tokenEstimate: 0,
      });

      const result = await getKbContext(org._id);
      expect(result).toBe('');
    });

    it('formats ready docs with the expected header + section format', async () => {
      const ts = Date.now() + 16;
      const { org } = await createOwnerWithOrg(ts);
      await createReadyDoc(org._id, { title: 'Shipping Policy', content: 'We ship in 3–5 days.' });

      const result = await getKbContext(org._id);
      expect(result).toMatch(/^## Knowledge Base\n\n### Shipping Policy\n/);
      expect(result).toContain('We ship in 3–5 days.');
    });

    it('truncates content at MAX_CHARS_PER_DOC (1200) characters per doc', async () => {
      const ts = Date.now() + 17;
      const { org } = await createOwnerWithOrg(ts);
      const longContent = 'x'.repeat(2400);
      await createReadyDoc(org._id, { title: 'Long Doc', content: longContent });

      const result = await getKbContext(org._id);
      // The section content should be at most 1200 'x' chars (MAX_CHARS_PER_DOC)
      const match = result.match(/### Long Doc\n(x+)/);
      expect(match).not.toBeNull();
      expect(match![1].length).toBeLessThanOrEqual(1200);
    });

    it('excludes docs from other orgs', async () => {
      const ts = Date.now() + 18;
      const { org: org1 } = await createOwnerWithOrg(`${ts}-a`);
      const { org: org2 } = await createOwnerWithOrg(`${ts}-b`);
      await createReadyDoc(org1._id, { title: 'Org1 Doc', content: 'Private to org1.' });
      await createReadyDoc(org2._id, { title: 'Org2 Doc', content: 'Private to org2.' });

      const result = await getKbContext(org1._id);
      expect(result).toContain('Org1 Doc');
      expect(result).not.toContain('Org2 Doc');
    });
  });
});
