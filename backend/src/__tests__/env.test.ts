/**
 * 🟣 Test Engineer — Environment Config Tests
 * Tests: Zod env schema shape and required fields
 */
import { describe, it, expect } from 'vitest';
import { env } from '@/config/env';

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
});
