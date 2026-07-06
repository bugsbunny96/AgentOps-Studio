import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { listCallsHandler, getCallByIdHandler } from './call.controller';

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
 * GET /api/v1/calls/:id
 * Call detail with transcript and AI summary.
 */
callsRouter.get('/:id', getCallByIdHandler);
