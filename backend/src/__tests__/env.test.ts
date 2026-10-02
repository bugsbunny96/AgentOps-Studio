/**
 * 🟣 Test Engineer — Environment Config Tests
 * Tests: Zod env schema shape and required fields
 */
import { describe, it, expect } from 'vitest';
import { env, productionEnvProblems, DEV_SA_JWT_SECRET } from '@/config/env';

describe('env config', () => {
  it('exports an env object', () => {
    expect(env).toBeDefined();
    expect(typeof env).toBe('object');
  });

  it('has NODE_ENV set', () => {
    expect(env.NODE_ENV).toBeDefined();
    expect(['development', 'test', 'production']).toContain(env.NODE_ENV);
  });

  it('has PORT as a number', () => {
    expect(typeof env.PORT).toBe('number');
    expect(env.PORT).toBeGreaterThan(0);
  });

  it('has MONGODB_URI as a non-empty string', () => {
    expect(typeof env.MONGODB_URI).toBe('string');
    expect(env.MONGODB_URI.length).toBeGreaterThan(0);
  });

  it('has REDIS_URL as a non-empty string', () => {
    expect(typeof env.REDIS_URL).toBe('string');
    expect(env.REDIS_URL.length).toBeGreaterThan(0);
  });

  it('has JWT_ACCESS_SECRET and JWT_REFRESH_SECRET', () => {
    expect(typeof env.JWT_ACCESS_SECRET).toBe('string');
    expect(typeof env.JWT_REFRESH_SECRET).toBe('string');
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThan(0);
    expect(env.JWT_REFRESH_SECRET.length).toBeGreaterThan(0);
  });

  it('has CLIENT_URL set', () => {
    expect(typeof env.CLIENT_URL).toBe('string');
    expect(env.CLIENT_URL.length).toBeGreaterThan(0);
  });

  describe('SEC-04 — production secrets', () => {
    const strong = 'x'.repeat(48);
    const access = 'a'.repeat(48);

    it('rejects the dev SA_JWT_SECRET default in production', () => {
      expect(productionEnvProblems({ NODE_ENV: 'production', SA_JWT_SECRET: DEV_SA_JWT_SECRET, JWT_ACCESS_SECRET: access }))
        .toEqual([expect.stringContaining('SA_JWT_SECRET')]);
    });

    it('rejects reusing JWT_ACCESS_SECRET as SA_JWT_SECRET in production', () => {
      expect(productionEnvProblems({ NODE_ENV: 'production', SA_JWT_SECRET: access, JWT_ACCESS_SECRET: access }))
        .toHaveLength(1);
    });

    it('accepts a real secret in production', () => {
      expect(productionEnvProblems({ NODE_ENV: 'production', SA_JWT_SECRET: strong, JWT_ACCESS_SECRET: access })).toEqual([]);
    });

    it('allows the dev default outside production', () => {
      expect(productionEnvProblems({ NODE_ENV: 'development', SA_JWT_SECRET: DEV_SA_JWT_SECRET, JWT_ACCESS_SECRET: access })).toEqual([]);
      expect(productionEnvProblems({ NODE_ENV: 'test', SA_JWT_SECRET: DEV_SA_JWT_SECRET, JWT_ACCESS_SECRET: access })).toEqual([]);
    });
  });
});
