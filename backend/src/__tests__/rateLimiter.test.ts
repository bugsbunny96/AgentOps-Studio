/**
 * 🟣 Test Engineer — Rate Limiter Tests
 * Tests: auth rate limit (10/15min), crawl rate limit (3/60min)
 * Note: Standard 100/15min limit not tested here (too many requests to exhaust in unit test)
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '@/app';

describe('Auth rate limiter — POST /api/v1/auth/*', () => {
  /**
   * The auth limiter is set to 10 requests per 15 min.
   * We send 11 requests. The 11th must return 429.
   * Note: each test run starts fresh because the limiter uses in-memory store by default.
   */
  it('blocks after 10 requests with 429', async () => {
    // Send 10 requests (all will 404 since auth routes aren't wired yet, but the limiter fires first...
    // actually the limiter runs before route matching so it counts them)
    // We need to exhaust the limit
    const requests = Array.from({ length: 10 }, () =>
      request(app).post('/api/v1/auth/login').send({ email: 'test@test.com', password: 'pass' })
    );
    await Promise.all(requests);

    // 11th should be rate-limited
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com', password: 'pass' });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });
});

describe('Crawl rate limiter — POST /api/v1/onboarding/website/crawl', () => {
  it('blocks after 3 requests with 429', async () => {
    const requests = Array.from({ length: 3 }, () =>
      request(app).post('/api/v1/onboarding/website/crawl').send({})
    );
    await Promise.all(requests);

    const res = await request(app).post('/api/v1/onboarding/website/crawl').send({});

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });
});
