import type { Request, Response, NextFunction } from 'express';
import {
  listCalls,
  getCallById,
  exportCalls,
  initiateCall,
  getCallStats,
  getCallsByDay,
  type ListCallsQuery,
  type ExportCallsQuery,
  type InitiateCallPayload,
} from './call.service';

/**
 * GET /api/v1/calls
 *
 * Query params: page, limit, status, direction, dateFrom, dateTo
 */
export async function listCallsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query: ListCallsQuery = {
      page:      req.query['page']      ? Number(req.query['page'])  : undefined,
      limit:     req.query['limit']     ? Number(req.query['limit']) : undefined,
      status:    req.query['status']    as ListCallsQuery['status']    ?? undefined,
      direction: req.query['direction'] as ListCallsQuery['direction'] ?? undefined,
      dateFrom:  req.query['dateFrom']  as string ?? undefined,
      dateTo:    req.query['dateTo']    as string ?? undefined,
    };

    const result = await listCalls(req.userId!, query);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/calls/export
 *
 * Streams a CSV file containing all calls matching the filter params.
 * Query params: status, direction, dateFrom, dateTo  (all optional)
 */
export async function exportCallsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query: ExportCallsQuery = {
      status:    req.query['status']    as ExportCallsQuery['status']    ?? undefined,
      direction: req.query['direction'] as ExportCallsQuery['direction'] ?? undefined,
      dateFrom:  req.query['dateFrom']  as string ?? undefined,
      dateTo:    req.query['dateTo']    as string ?? undefined,
    };

    const csv = await exportCalls(req.userId!, query);

    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="calls-export-${timestamp}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/calls/initiate
 *
 * Body: { phoneNumber: string, agentId: string }
 */
export async function initiateCallHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload: InitiateCallPayload = {
      phoneNumber: req.body.phoneNumber as string,
      agentId:     req.body.agentId     as string,
    };
    const result = await initiateCall(req.userId!, payload);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/calls/stats
 * Aggregate KPIs: total, today, avgDuration, completionRate
 */
export async function getCallStatsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stats = await getCallStats(req.userId!);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/calls/stats/by-day
 * Last 14 days of call counts — oldest-first array with zero-filled gaps.
 */
export async function getCallsByDayHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const days = await getCallsByDay(req.userId!);
    res.status(200).json({ success: true, data: days });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/calls/:id
 */
export async function getCallByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const callId = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    const result = await getCallById(req.userId!, callId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
