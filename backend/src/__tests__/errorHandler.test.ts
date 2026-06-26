/**
 * 🟣 Test Engineer — Error Handler Tests
 * Tests: AppError factories, global error handler via Express
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import {
  AppError,
  BadRequest,
  Unauthorized,
  Forbidden,
  NotFound,
  Conflict,
  errorHandler,
} from '@/middleware/errorHandler';
import { ZodError, z } from 'zod';

// ── Helper: build a minimal Express app that throws a given error ────────────
function buildTestApp(thrower: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.use(express.json());
  app.get('/test', thrower);
  app.use(errorHandler);
  return app;
}

// ── AppError class unit tests ────────────────────────────────────────────────
describe('AppError', () => {
  it('sets statusCode, message, and code', () => {
    const err = new AppError(422, 'Unprocessable', 'UNPROCESSABLE_ENTITY');
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe('Unprocessable');
    expect(err.code).toBe('UNPROCESSABLE_ENTITY');
    expect(err.isOperational).toBe(true);
  });

  it('is instanceof Error', () => {
    expect(new AppError(400, 'bad')).toBeInstanceOf(Error);
  });
});

describe('AppError factories', () => {
  it('BadRequest returns 400 with BAD_REQUEST code', () => {
    const err = BadRequest('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('BadRequest accepts custom code', () => {
    const err = BadRequest('Invalid input', 'INVALID_EMAIL');
    expect(err.code).toBe('INVALID_EMAIL');
  });

  it('Unauthorized returns 401', () => {
    expect(Unauthorized().statusCode).toBe(401);
  });

  it('Forbidden returns 403', () => {
    expect(Forbidden().statusCode).toBe(403);
  });

  it('NotFound returns 404 with NOT_FOUND code', () => {
    const err = NotFound('User');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('User');
  });

  it('Conflict returns 409', () => {
    expect(Conflict('Already exists').statusCode).toBe(409);
  });
});

// ── Global error handler via HTTP ────────────────────────────────────────────
describe('errorHandler middleware', () => {
  it('handles AppError with correct status + body', async () => {
    const app = buildTestApp((_req, _res, next) => {
      next(Forbidden('Access denied', 'ORG_FORBIDDEN'));
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ORG_FORBIDDEN');
    expect(res.body.message).toBe('Access denied');
  });

  it('handles ZodError with 400 VALIDATION_ERROR', async () => {
    const schema = z.object({ email: z.string().email() });

    const app = buildTestApp((_req, _res, next) => {
      const result = schema.safeParse({ email: 'not-an-email' });
      if (!result.success) next(result.error);
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toBeDefined();
  });

  it('handles Mongoose CastError with 400 INVALID_ID', async () => {
    const castErr = new Error('Cast to ObjectId failed');
    castErr.name = 'CastError';

    const app = buildTestApp((_req, _res, next) => next(castErr));
    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ID');
  });

  it('handles Mongoose duplicate key (code 11000) with 409', async () => {
    const dupErr = Object.assign(new Error('Duplicate'), {
      code: 11000,
      keyValue: { email: 'test@example.com' },
    });

    const app = buildTestApp((_req, _res, next) => next(dupErr));
    const res = await request(app).get('/test');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_ERROR');
    expect(res.body.message).toContain('email');
  });

  it('handles unknown errors with 500', async () => {
    const app = buildTestApp((_req, _res, next) => {
      next(new Error('Something unexpected'));
    });

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.success).toBe(false);
  });
});
