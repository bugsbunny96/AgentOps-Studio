import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  listCallsHandler,
  getCallByIdHandler,
  exportCallsHandler,
  initiateCallHandler,
  getCallStatsHandler,
  getCallsByDayHandler,
  searchTranscriptsHandler,
} from './call.controller';

export const callsRouter = Router();

// All call routes require authentication
callsRouter.use(authenticate);

/**
 * GET /api/v1/calls
 * Paginated call list for the authenticated user's org.
 * Query: page, limit, status, direction, dateFrom, dateTo
 */
callsRouter.get('/', listCallsHandler);

/**
 * GET /api/v1/calls/export
 * CSV export — same filter params as list but no pagination.
 * MUST be registered before /:id so "export" isn't treated as an ID param.
 */
callsRouter.get('/export', exportCallsHandler);

/**
 * POST /api/v1/calls/initiate
 * Initiate an outbound call to a target phone number.
 * Body: { phoneNumber: string (E.164), agentId: string }
 * MUST be registered before /:id.
 */
callsRouter.post('/initiate', initiateCallHandler);

/**
 * GET /api/v1/calls/stats
 * Aggregate KPIs: total, today, avgDuration, completionRate.
 * MUST be registered before /:id to avoid param shadowing.
 */
callsRouter.get('/stats', getCallStatsHandler);

/**
 * GET /api/v1/calls/stats/by-day
 * Last 14 days of call counts (oldest-first, zero-filled gaps).
 * MUST be registered before /:id.
 */
callsRouter.get('/stats/by-day', getCallsByDayHandler);

/**
 * GET /api/v1/calls/search
 * Full-text search across transcript content for the authenticated org.
 * Query: q (required, min 2 chars), page, limit (max 50)
 * MUST be registered before /:id to prevent "search" being treated as an ObjectId.
 *
 * Example: GET /api/v1/calls/search?q=appointment+booking&page=1&limit=10
 * Example: GET /api/v1/calls/search?q="I want to cancel"&limit=5
 */
callsRouter.get('/search', searchTranscriptsHandler);

/**
 * GET /api/v1/calls/:id
 * Call detail with transcript and AI summary.
 */
callsRouter.get('/:id', getCallByIdHandler);
