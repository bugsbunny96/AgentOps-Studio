/**
 * H1.1 / SEC-01 — submit_order tool webhook authentication
 *
 * Route under test: POST /api/v1/orders/submit (Vapi tool call, no user JWT).
 * The shared secret must arrive in x-webhook-secret or x-vapi-secret; anything
 * else is rejected with 401 before any order logic runs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { env } from '@/config/env';

// Order logic is mocked: these tests cover only the auth gate in front of it,
// so they need no database.
const { mockResolveOrg, mockSubmitOrder } = vi.hoisted(() => ({
  mockResolveOrg:  vi.fn(),
  mockSubmitOrder: vi.fn(),
}));

vi.mock('@/modules/orders/order.service', () => ({
  resolveOrgByAssistantId: mockResolveOrg,
  submitOrder:             mockSubmitOrder,
  listOrders:              vi.fn(),
  getOrderById:            vi.fn(),
  updateOrderStatus:       vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn(), stream: { write: vi.fn() } },
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

const SECRET = 'tool-secret-0123456789abcdef';
const URL = '/api/v1/orders/submit';

// Vapi-shaped tool call for an assistant that maps to no org: once auth passes,
// the route answers 200 with a spoken "could not identify organization" result.
const vapiBody = {
  message: {
    call: { id: 'call_test_1', assistantId: 'asst_unknown' },
    toolCallList: [
      { id: 'tc_1', function: { name: 'submit_order', arguments: '{}' } },
    ],
  },
};

const original = { secret: env.VAPI_TOOL_WEBHOOK_SECRET, nodeEnv: env.NODE_ENV };

beforeEach(() => {
  env.VAPI_TOOL_WEBHOOK_SECRET = SECRET;
  mockResolveOrg.mockReset().mockResolvedValue(null); // unknown assistant → "could not identify organization"
  mockSubmitOrder.mockReset();
});

afterEach(() => {
  env.VAPI_TOOL_WEBHOOK_SECRET = original.secret;
  env.NODE_ENV = original.nodeEnv;
});

describe('POST /api/v1/orders/submit — webhook secret', () => {
  it('rejects a request with no secret header', async () => {
    const res = await request(app).post(URL).send(vapiBody);
    expect(res.status).toBe(401);
  });

  it('rejects a wrong secret of the same length', async () => {
    const wrong = 'x'.repeat(SECRET.length);
    const res = await request(app).post(URL).set('x-webhook-secret', wrong).send(vapiBody);
    expect(res.status).toBe(401);
  });

  it('rejects a secret of a different length', async () => {
    const res = await request(app).post(URL).set('x-webhook-secret', 'short').send(vapiBody);
    expect(res.status).toBe(401);
  });

  it('rejects an empty header value', async () => {
    const res = await request(app).post(URL).set('x-webhook-secret', '').send(vapiBody);
    expect(res.status).toBe(401);
  });

  it('never reaches order logic when rejected', async () => {
    await request(app).post(URL).send(vapiBody);
    await request(app).post(URL).set('x-webhook-secret', 'wrong').send({ assistant_id: 'asst_1', customer_name: 'X' });
    expect(mockResolveOrg).not.toHaveBeenCalled();
    expect(mockSubmitOrder).not.toHaveBeenCalled();
  });

  it('accepts the correct secret in x-webhook-secret', async () => {
    const res = await request(app).post(URL).set('x-webhook-secret', SECRET).send(vapiBody);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].toolCallId).toBe('tc_1');
    expect(mockResolveOrg).toHaveBeenCalledWith('asst_unknown');
  });

  it("accepts the correct secret in Vapi's native x-vapi-secret header", async () => {
    const res = await request(app).post(URL).set('x-vapi-secret', SECRET).send(vapiBody);
    expect(res.status).toBe(200);
  });

  it('accepts when one of the two headers is correct', async () => {
    const res = await request(app)
      .post(URL)
      .set('x-webhook-secret', 'wrong')
      .set('x-vapi-secret', SECRET)
      .send(vapiBody);
    expect(res.status).toBe(200);
  });

  it('rejects every call in production when the secret is not configured', async () => {
    env.VAPI_TOOL_WEBHOOK_SECRET = undefined;
    env.NODE_ENV = 'production';
    const res = await request(app).post(URL).set('x-webhook-secret', SECRET).send(vapiBody);
    expect(res.status).toBe(401);
  });

  it('allows calls outside production when the secret is not configured', async () => {
    env.VAPI_TOOL_WEBHOOK_SECRET = undefined;
    env.NODE_ENV = 'development';
    const res = await request(app).post(URL).send(vapiBody);
    expect(res.status).toBe(200);
  });
});
