import type { Request, Response, NextFunction } from 'express';
import { listCalls, getCallById, type ListCallsQuery } from './call.service';

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
