/**
 * 🟣 Test Engineer — Health Endpoint Tests
 * Tests: GET /health
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '@/app';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns correct service name', async () => {
    const res = await request(app).get('/health');

    expect(res.body.service).toBe('agentops-studio-backend');
  });

  it('returns environment field', async () => {
    const res = await request(app).get('/health');

    expect(res.body).toHaveProperty('environment');
    expect(['development', 'test', 'production']).toContain(res.body.environment);
  });

  it('returns a valid ISO timestamp', async () => {
    const res = await request(app).get('/health');

    expect(res.body).toHaveProperty('timestamp');
    expect(() => new Date(res.body.timestamp)).not.toThrow();
    expect(isNaN(new Date(res.body.timestamp).getTime())).toBe(false);
  });

  it('returns JSON content type', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /unknown-route', () => {
  it('returns 404 for unregistered routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });
});
