/**
 * Removes MongoDB operator keys (any key starting with "$") from req.body,
 * req.query and req.params, at any depth (NoSQL-injection guard).
 *
 * Without it, a body such as { "email": { "$ne": "" } } that reaches a
 * Mongoose filter unvalidated would match any document. No legitimate field in
 * this API starts with "$". The Stripe webhook is mounted before express.json()
 * and receives a raw Buffer, which this middleware leaves untouched.
 */
import type { Request, Response, NextFunction } from 'express';

const MAX_DEPTH = 20;

export function stripOperatorKeys(value: unknown, depth = 0): number {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object' || Buffer.isBuffer(value)) return 0;
  let removed = 0;
  if (Array.isArray(value)) {
    for (const item of value) removed += stripOperatorKeys(item, depth + 1);
    return removed;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) {
      delete obj[key];
      removed += 1;
    } else {
      removed += stripOperatorKeys(obj[key], depth + 1);
    }
  }
  return removed;
}

export function stripMongoOperators(req: Request, _res: Response, next: NextFunction): void {
  stripOperatorKeys(req.body);
  stripOperatorKeys(req.query);
  stripOperatorKeys(req.params);
  next();
}
