/**
 * Analytics Controller
 *
 * Three thin handler functions — one per aggregation endpoint.
 * All require authentication (authenticate middleware applied in routes).
 * userId is injected by the JWT middleware as req.userId.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  getOverview,
  getCallsPerDay,
  getTopCallers,
} from './analytics.service';

// GET /api/v1/analytics/overview
export async function overviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getOverview(req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/analytics/calls-per-day?days=30
export async function callsPerDayHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const days = Math.min(Math.max(parseInt(req.query['days'] as string ?? '30', 10) || 30, 1), 90);
    const data = await getCallsPerDay(req.userId!, days);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/analytics/top-callers?limit=10
export async function topCallersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const limit = Math.min(Math.max(parseInt(req.query['limit'] as string ?? '10', 10) || 10, 1), 50);
    const data  = await getTopCallers(req.userId!, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
