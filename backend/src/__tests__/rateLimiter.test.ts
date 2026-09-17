/**
 * 🟣 Test Engineer — Rate Limiter Tests
 * Tests: auth rate limit (10/15min), crawl rate limit (3/60min)
 * Note: Standard 100/15min limit not tested here (too many requests to exhaust in unit test)
 *
 * Uses a dedicated Express app WITHOUT the NODE_ENV === 'test' skip so that
 * rate limiting actually fires. The production app skips rate limiting in tests
 * (to avoid flaky integration tests) — these tests need a separate app that
 * exercises the rate limiting middleware directly.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { rateLimit } from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' };
const AUTH_RATE_LIMIT_MESSAGE = { success: false, code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again in 15 minutes.' };
const CRAWL_RATE_LIMIT_MESSAGE = { success: false, code: 'RATE_LIMITED', message: 'Crawl limit reached. Wait 1 hour before re-crawling.' };

/**
 * Build a minimal test app that mirrors the rate limiters in app.ts
 * but without the skip condition, so the limiter actually fires.
 */
function buildRateLimitTestApp() {
  const app = express();
  app.use(express.json());

  // Auth limiter — 10 per 15 min (mirrors app.ts)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: AUTH_RATE_LIMIT_MESSAGE,
  });

  // Crawl limiter — 3 per hour (mirrors app.ts)
  const crawlLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: CRAWL_RATE_LIMIT_MESSAGE,
  });

  app.post('/api/v1/auth/login', authLimiter, (_req, res) => {
    res.status(200).json({ success: true });
  });

  app.post('/api/v1/onboarding/website/crawl', crawlLimiter, (_req, res) => {
    res.status(200).json({ success: true });
  });

  return app;
}

const rateLimitApp = buildRateLimitTestApp();

describe('Auth rate limiter — POST /api/v1/auth/*', () => {
  /**
   * The auth limiter is set to 10 requests per 15 min.
   * We send 10 requests (exhausting the limit), then the 11th must return 429.
   */
  it('blocks after 10 requests with 429', async () => {
    const requests = Array.from({ length: 10 }, () =>
      request(rateLimitApp).post('/api/v1/auth/login').send({ email: 'test@test.com', password: 'pass' }),
    );
    await Promise.all(requests);

    // 11th should be rate-limited
    const res = await request(rateLimitApp)
      .post('/api/v1/auth/login')
      .send({ email: 'test@test.com', password: 'pass' });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });
});

describe('Crawl rate limiter — POST /api/v1/onboarding/website/crawl', () => {
  it('blocks after 3 requests with 429', async () => {
    const requests = Array.from({ length: 3 }, () =>
      request(rateLimitApp).post('/api/v1/onboarding/website/crawl').send({}),
    );
    await Promise.all(requests);

    const res = await request(rateLimitApp).post('/api/v1/onboarding/website/crawl').send({});

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });
});

// Dummy reference to suppress the unused-import warning for RATE_LIMIT_MESSAGE
void RATE_LIMIT_MESSAGE;
