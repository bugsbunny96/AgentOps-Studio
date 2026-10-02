/**
 * CORE-05 — API behind the Vercel /api rewrite
 *
 * - trust proxy = 2 → req.ip is the real client both via Vercel (2 hops) and
 *   for direct callers like Vapi (1 hop)
 * - login / forgot-password are also limited per account, so rotating a
 *   spoofed X-Forwarded-For can't bypass brute-force protection
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { authAccountKey } from '@/middleware/rateLimitExempt';

function ipEcho() {
  const app = express();
  app.set('trust proxy', 2);
  app.get('/ip', (req, res) => { res.json({ ip: req.ip }); });
  return app;
}

describe('trust proxy = 2', () => {
  it('resolves the browser IP through Vercel + Render', async () => {
    // supertest's socket is "Render's proxy"; XFF = client, Vercel edge
    const res = await request(ipEcho()).get('/ip').set('X-Forwarded-For', '203.0.113.7, 76.76.21.21');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  it('resolves the caller IP for direct (1-hop) requests', async () => {
    const res = await request(ipEcho()).get('/ip').set('X-Forwarded-For', '198.51.100.9');
    expect(res.body.ip).toBe('198.51.100.9');
  });
});

describe('authAccountKey', () => {
  it('normalises the email', () => {
    expect(authAccountKey({ body: { email: '  Owner@Example.COM ' } })).toBe('acct:owner@example.com');
  });
  it('is undefined without an email', () => {
    expect(authAccountKey({ body: {} })).toBeUndefined();
    expect(authAccountKey({ body: { email: 42 } })).toBeUndefined();
    expect(authAccountKey({})).toBeUndefined();
  });

  it('limits one account even when the IP changes on every attempt', async () => {
    const app = express();
    app.set('trust proxy', 2);
    app.use(express.json());
    app.use('/login', rateLimit({
      windowMs: 60_000, max: 3,
      skip: (req) => !authAccountKey(req),
      keyGenerator: (req) => authAccountKey(req) ?? 'none',
    }));
    app.post('/login', (_req, res) => { res.sendStatus(401); });

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/login')
        .set('X-Forwarded-For', `10.0.0.${i}, 76.76.21.21`)
        .send({ email: 'victim@example.com', password: 'guess' + i });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 429]);

    // a different account is unaffected
    const other = await request(app).post('/login').send({ email: 'someone@example.com', password: 'x' });
    expect(other.status).toBe(401);
  });
});
