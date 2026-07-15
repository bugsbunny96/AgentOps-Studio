import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// ─── Custom App Error ────────────────────────────────────────────────────────
export class AppError extends Error {
  public readonly isOperational = true;

  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Convenience factories
export const BadRequest = (msg: string, code?: string): AppError =>
  new AppError(400, msg, code ?? 'BAD_REQUEST');

export const Unauthorized = (msg = 'Unauthorized', code?: string): AppError =>
  new AppError(401, msg, code ?? 'UNAUTHORIZED');

export const Forbidden = (msg = 'Forbidden', code?: string): AppError =>
  new AppError(403, msg, code ?? 'FORBIDDEN');

export const NotFound = (resource: string): AppError =>
  new AppError(404, `${resource} not found`, 'NOT_FOUND');

export const Conflict = (msg: string, code?: string): AppError =>
  new AppError(409, msg, code ?? 'CONFLICT');

// ─── Global Error Handler ────────────────────────────────────────────────────
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // 1. Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  // 2. Mongoose duplicate key (code 11000)
  if ((err as NodeJS.ErrnoException & { code?: number }).code === 11000) {
    const keyValue = (err as unknown as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const field = Object.keys(keyValue)[0] ?? 'field';
    res.status(409).json({
      success: false,
      code: 'DUPLICATE_ERROR',
      message: `${field} already exists`,
    });
    return;
  }

  // 3. Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      code: 'INVALID_ID',
      message: 'Invalid resource identifier',
    });
    return;
  }

  // 4. Operational AppError
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
    return;
  }

  // 5. Unknown / programmer error — log and return generic 500
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message:
      env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : err.message,
  });
}
