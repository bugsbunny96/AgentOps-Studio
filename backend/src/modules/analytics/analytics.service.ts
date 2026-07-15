/**
 * Analytics Service
 *
 * Three MongoDB aggregation pipelines, all scoped to the authenticated
 * owner's organization via MembershipModel lookup.
 *
 *   getOverview(userId)           → KPI cards (totals, today, avg, cost, resolution)
 *   getCallsPerDay(userId, days)  → [{date, count}] for the bar chart
 *   getTopCallers(userId, limit)  → [{callerNumber, count, lastCall}]
 */

import mongoose from 'mongoose';
import { MembershipModel, type IOrganization } from '../organization/organization.model';
import { CallModel, SummaryModel } from '../calls/call.model';
import { NotFound }                from '../../middleware/errorHandler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveOrgId(userId: string): Promise<mongoose.Types.ObjectId> {
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
    organizationId: IOrganization;
  }>('organizationId');
  if (!membership) throw NotFound('Organization');
  return (membership.organizationId as IOrganization)._id;
}

/** Return a Date representing the start of today in UTC. */
function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Return a Date N days before now. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── getOverview ──────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalCalls:      number;
  callsToday:      number;
  callsThisWeek:   number;
  activeCalls:     number;
  avgDurationSec:  number;   // average across all completed calls
  totalCostUsd:    number;
  resolutionRate:  number;   // 0–100 (percentage of completed calls that have a summary)
}

export async function getOverview(userId: string): Promise<AnalyticsOverview> {
  const orgId     = await resolveOrgId(userId);
  const todayDate = startOfToday();
  const weekDate  = daysAgo(6);  // last 7 days

  // Single $facet aggregation for efficiency
  const [result] = await CallModel.aggregate<{
    totals: Array<{ totalCalls: number; totalDuration: number; totalCost: number; completedCalls: number }>;
    today:  Array<{ count: number }>;
    week:   Array<{ count: number }>;
    active: Array<{ count: number }>;
  }>([
    { $match: { organizationId: orgId } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalCalls:     { $sum: 1 },
              totalDuration:  { $sum: '$duration' },
              totalCost:      { $sum: '$cost' },
              completedCalls: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            },
          },
        ],
        today: [
          { $match: { createdAt: { $gte: todayDate } } },
          { $count: 'count' },
        ],
        week: [
          { $match: { createdAt: { $gte: weekDate } } },
          { $count: 'count' },
        ],
        active: [
          { $match: { status: 'active' } },
          { $count: 'count' },
        ],
      },
    },
  ]);

  const totals        = result?.totals?.[0];
  const totalCalls    = totals?.totalCalls    ?? 0;
  const completedCalls = totals?.completedCalls ?? 0;
  const totalDuration  = totals?.totalDuration  ?? 0;

  // Resolution rate: count of summaries for org's completed calls / completedCalls
  let resolvedCount = 0;
  if (completedCalls > 0) {
    // Get IDs of completed calls for this org
    const completedCallIds = await CallModel.distinct('_id', {
      organizationId: orgId,
      status: 'completed',
    });

    resolvedCount = await SummaryModel.countDocuments({
      callId: { $in: completedCallIds },
    });
  }

  return {
    totalCalls,
    callsToday:     result?.today?.[0]?.count  ?? 0,
    callsThisWeek:  result?.week?.[0]?.count   ?? 0,
    activeCalls:    result?.active?.[0]?.count ?? 0,
    avgDurationSec: completedCalls > 0 ? Math.round(totalDuration / completedCalls) : 0,
    totalCostUsd:   Math.round((totals?.totalCost ?? 0) * 1000) / 1000,  // round to 3 decimal places
    resolutionRate: completedCalls > 0 ? Math.round((resolvedCount / completedCalls) * 100) : 0,
  };
}

// ─── getCallsPerDay ───────────────────────────────────────────────────────────

export interface CallsPerDayPoint {
  date:  string;   // YYYY-MM-DD
  count: number;
}

export async function getCallsPerDay(
  userId: string,
  days   = 30,
): Promise<CallsPerDayPoint[]> {
  const orgId   = await resolveOrgId(userId);
  const since   = daysAgo(days - 1);

  // Aggregate calls grouped by UTC date string
  const rows = await CallModel.aggregate<{ _id: string; count: number }>([
    { $match: { organizationId: orgId, createdAt: { $gte: since } } },
    {
      $group: {
        _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Build a map for fast lookup
  const byDate = new Map(rows.map((r) => [r._id, r.count]));

  // Fill every day in the range with 0 if no calls
  const result: CallsPerDayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);          // YYYY-MM-DD
    result.push({ date: key, count: byDate.get(key) ?? 0 });
  }

  return result;
}

// ─── getTopCallers ────────────────────────────────────────────────────────────

export interface TopCaller {
  callerNumber:  string;
  count:         number;
  lastCall:      Date;
  totalDuration: number;  // seconds
}

export async function getTopCallers(
  userId: string,
  limit  = 10,
): Promise<TopCaller[]> {
  const orgId = await resolveOrgId(userId);

  return CallModel.aggregate<TopCaller>([
    {
      $match: {
        organizationId: orgId,
        callerNumber: { $ne: 'Unknown', $exists: true },
      },
    },
    {
      $group: {
        _id:           '$callerNumber',
        count:         { $sum: 1 },
        lastCall:      { $max: '$createdAt' },
        totalDuration: { $sum: '$duration' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $project: {
        _id:           0,
        callerNumber:  '$_id',
        count:         1,
        lastCall:      1,
        totalDuration: 1,
      },
    },
  ]);
}
