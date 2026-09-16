/**
 * Error Log Service
 *
 * Read-only access to the ErrorLog collection (writes come from errorHandler).
 * Provides: paginated list (filterable) + grouped stats by error code.
 */
import { ErrorLogModel, IErrorLog } from './error-log.model';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ErrorLogFilter {
  code?:       string;
  orgId?:      string;
  statusCode?: number;
  since?:      Date;
}

export interface ErrorLogPage {
  logs:  IErrorLog[];
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface ErrorCodeStat {
  code:     string | null;
  count:    number;
  lastSeen: Date;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listErrorLogs(
  page:   number,
  limit:  number,
  filter: ErrorLogFilter = {},
): Promise<ErrorLogPage> {
  const query: Record<string, unknown> = {};
  if (filter.code)       query.code       = filter.code;
  if (filter.orgId)      query.orgId      = filter.orgId;
  if (filter.statusCode) query.statusCode = filter.statusCode;
  if (filter.since)      query.createdAt  = { $gte: filter.since };

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    ErrorLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ErrorLogModel.countDocuments(query),
  ]);

  return {
    logs:  logs as unknown as IErrorLog[],
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function getErrorStats(): Promise<ErrorCodeStat[]> {
  const stats = await ErrorLogModel.aggregate<{ _id: string | null; count: number; lastSeen: Date }>([
    {
      $group: {
        _id:      '$code',
        count:    { $sum: 1 },
        lastSeen: { $max: '$createdAt' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 30 },
  ]);

  return stats.map(s => ({ code: s._id, count: s.count, lastSeen: s.lastSeen }));
}

export async function getTotalErrorCount(): Promise<number> {
  return ErrorLogModel.countDocuments();
}

/**
 * Write a single error log entry.
 * Called by the global error handler (fire-and-forget — never throws).
 */
export async function writeErrorLog(data: {
  message:    string;
  code?:      string;
  statusCode?: number;
  stack?:     string;
  path?:      string;
  method?:    string;
  orgId?:     string;
  userId?:    string;
}): Promise<void> {
  try {
    await ErrorLogModel.create({
      ...data,
      // Trim stack to 4 KB to avoid oversized documents
      stack: data.stack ? data.stack.slice(0, 4096) : undefined,
    });
  } catch {
    // Silently swallow — we must never throw inside an error handler
  }
}
