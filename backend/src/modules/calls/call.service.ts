/**
 * Call Service — list and detail queries for the authenticated dashboard.
 *
 * All queries are scoped to the caller's organizationId so data is
 * strictly isolated between tenants.
 */

import { MembershipModel } from '../organization/organization.model';
import type { IOrganization } from '../organization/organization.model';
import { CallModel, TranscriptModel, SummaryModel } from './call.model';
import { NotFound } from '../../middleware/errorHandler';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListCallsQuery {
  page?: number;
  limit?: number;
  status?: 'active' | 'completed' | 'failed';
  direction?: 'Inbound' | 'Outbound';
  dateFrom?: string;
  dateTo?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrgId(userId: string): Promise<string> {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');
  if (!membership) throw NotFound('Organization');
  return (membership.organizationId as IOrganization)._id.toString();
}

// ─── listCalls ────────────────────────────────────────────────────────────────

/**
 * Returns a paginated list of calls for the authenticated user's org.
 * Supports filtering by status, direction, and date range.
 */
export async function listCalls(userId: string, query: ListCallsQuery) {
  const orgId = await getOrgId(userId);

  const page  = Math.max(1, query.page  ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip  = (page - 1) * limit;

  // Build filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { organizationId: orgId };
  if (query.status)    filter['status']    = query.status;
  if (query.direction) filter['direction'] = query.direction;
  if (query.dateFrom || query.dateTo) {
    filter['createdAt'] = {};
    if (query.dateFrom) filter['createdAt']['$gte'] = new Date(query.dateFrom);
    if (query.dateTo)   filter['createdAt']['$lte'] = new Date(query.dateTo);
  }

  const [calls, total] = await Promise.all([
    CallModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    CallModel.countDocuments(filter),
  ]);

  return {
    calls: calls.map((c) => c.toJSON()),
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── getCallById ─────────────────────────────────────────────────────────────

/**
 * Returns a single call with its transcript and AI summary.
 * 404 if the call doesn't belong to the authenticated user's org.
 */
export async function getCallById(userId: string, callId: string) {
  const orgId = await getOrgId(userId);

  const call = await CallModel.findOne({ _id: callId, organizationId: orgId });
  if (!call) throw NotFound('Call');

  const [transcript, summary] = await Promise.all([
    TranscriptModel.findOne({ callId: call._id }),
    SummaryModel.findOne({ callId: call._id }),
  ]);

  return {
    call:       call.toJSON(),
    transcript: transcript?.toJSON() ?? null,
    summary:    summary?.toJSON()    ?? null,
  };
}
