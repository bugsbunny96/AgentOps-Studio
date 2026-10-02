/**
 * POST /api/v1/tools/lookup — search_catalog / search_knowledge_base tool webhook.
 * Covers the shared-secret gate, org resolution and per-tool dispatch.
 * Lookup + org resolution are mocked, so no database is needed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { env } from '@/config/env';

const { mockResolveOrg, mockSearchCatalog, mockSearchKb } = vi.hoisted(() => ({
  mockResolveOrg:    vi.fn(),
  mockSearchCatalog: vi.fn(),
  mockSearchKb:      vi.fn(),
}));

vi.mock('@/modules/orders/order.service', () => ({
  resolveOrgByAssistantId: mockResolveOrg,
  submitOrder:             vi.fn(),
  listOrders:              vi.fn(),
  getOrderById:            vi.fn(),
  updateOrderStatus:       vi.fn(),
}));

vi.mock('@/modules/tools/lookup.service', () => ({
  searchCatalog:       mockSearchCatalog,
  searchKnowledgeBase: mockSearchKb,
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn(), stream: { write: vi.fn() } },
}));

const SECRET = 'tool-secret-0123456789abcdef';
const URL = '/api/v1/tools/lookup';
const body = (calls: Array<{ name: string; query?: string }>) => ({
  message: {
    call: { id: 'call_1', assistantId: 'asst_1' },
    toolCallList: calls.map((c, i) => ({
      id: `tc_${i}`,
      function: { name: c.name, arguments: JSON.stringify(c.query ? { query: c.query } : {}) },
    })),
  },
});

const original = env.VAPI_TOOL_WEBHOOK_SECRET;
beforeEach(() => {
  env.VAPI_TOOL_WEBHOOK_SECRET = SECRET;
  mockResolveOrg.mockReset().mockResolvedValue('650000000000000000000001');
  mockSearchCatalog.mockReset().mockResolvedValue('- Ceiling Fan (Crompton) — ₹2499 per piece · stock 5');
  mockSearchKb.mockReset().mockResolvedValue('### Delivery\nPAN India, 3–7 days.');
});
afterEach(() => { env.VAPI_TOOL_WEBHOOK_SECRET = original; });

describe('POST /api/v1/tools/lookup', () => {
  it('rejects calls without the shared secret', async () => {
    const res = await request(app).post(URL).send(body([{ name: 'search_catalog', query: 'fan' }]));
    expect(res.status).toBe(401);
    expect(mockSearchCatalog).not.toHaveBeenCalled();
  });

  it('answers every tool call in the batch with its own result', async () => {
    const res = await request(app)
      .post(URL)
      .set('x-webhook-secret', SECRET)
      .send(body([
        { name: 'search_catalog', query: 'ceiling fan' },
        { name: 'search_knowledge_base', query: 'delivery' },
      ]));
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { toolCallId: 'tc_0', result: expect.stringContaining('₹2499') },
      { toolCallId: 'tc_1', result: expect.stringContaining('PAN India') },
    ]);
    expect(mockSearchCatalog).toHaveBeenCalledWith('650000000000000000000001', 'ceiling fan');
  });

  it('asks for keywords when the query is empty', async () => {
    const res = await request(app).post(URL).set('x-webhook-secret', SECRET).send(body([{ name: 'search_catalog' }]));
    expect(res.body.results[0].result).toMatch(/No search keywords/);
    expect(mockSearchCatalog).not.toHaveBeenCalled();
  });

  it('returns a spoken fallback when the assistant maps to no org', async () => {
    mockResolveOrg.mockResolvedValue(null);
    const res = await request(app).post(URL).set('x-webhook-secret', SECRET).send(body([{ name: 'search_catalog', query: 'fan' }]));
    expect(res.status).toBe(200);
    expect(res.body.results[0].result).toMatch(/callback/);
  });
});
