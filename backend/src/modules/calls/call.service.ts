/**
 * Call Service — list and detail queries for the authenticated dashboard.
 *
 * All queries are scoped to the caller's organizationId so data is
 * strictly isolated between tenants.
 */

import mongoose from 'mongoose';
import { MembershipModel } from '../organization/organization.model';
import type { IOrganization } from '../organization/organization.model';
import { VoiceAgentModel } from '../agents/agent.model';
import { vapiInitiateOutboundCall } from '../agents/vapi.service';
import { CallModel, TranscriptModel, SummaryModel } from './call.model';
import { BadRequest, NotFound, UnprocessableEntity } from '../../middleware/errorHandler';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListCallsQuery {
  page?: number;
  limit?: number;
  status?: 'active' | 'completed' | 'failed';
  direction?: 'Inbound' | 'Outbound';
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportCallsQuery {
  status?: 'active' | 'completed' | 'failed';
  direction?: 'Inbound' | 'Outbound';
  dateFrom?: string;
  dateTo?: string;
}

export interface InitiateCallPayload {
  /** Destination phone number in E.164 format (e.g. +919876543210) */
  phoneNumber: string;
  /** DB _id of the VoiceAgent to use for this call */
  agentId: string;
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

// ─── exportCalls ─────────────────────────────────────────────────────────────

/**
 * Serialises all calls matching the given filters to CSV string.
 * No pagination — exports every matching row (capped at 10 000 for safety).
 * Columns: id, caller_number, direction, status, duration_seconds,
 *          duration_formatted, cost_inr, ended_reason, date
 */

function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  // Wrap in double-quotes if the value contains a comma, double-quote, or newline
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export async function exportCalls(userId: string, query: ExportCallsQuery): Promise<string> {
  const orgId = await getOrgId(userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = { organizationId: orgId };
  if (query.status)    filter['status']    = query.status;
  if (query.direction) filter['direction'] = query.direction;
  if (query.dateFrom || query.dateTo) {
    filter['createdAt'] = {};
    if (query.dateFrom) filter['createdAt']['$gte'] = new Date(query.dateFrom);
    if (query.dateTo)   filter['createdAt']['$lte'] = new Date(query.dateTo);
  }

  const calls = await CallModel
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(10_000);

  const HEADER = [
    'id',
    'caller_number',
    'direction',
    'status',
    'duration_seconds',
    'duration_formatted',
    'cost_inr',
    'ended_reason',
    'date',
  ].join(',');

  const rows = calls.map((c) =>
    [
      csvEscape(c._id.toString()),
      csvEscape(c.callerNumber),
      csvEscape(c.direction),
      csvEscape(c.status),
      csvEscape(c.duration),
      csvEscape(formatDurationSeconds(c.duration)),
      csvEscape(c.cost.toFixed(2)),
      csvEscape(c.endedReason ?? ''),
      csvEscape(c.createdAt.toISOString()),
    ].join(','),
  );

  return [HEADER, ...rows].join('\n');
}

// ─── initiateCall ─────────────────────────────────────────────────────────────

/** Strict E.164: + followed by 2–15 digits, total 2–16 chars */
const E164_RE = /^\+[1-9]\d{1,14}$/;

/**
 * Initiates an outbound phone call via Vapi.
 *
 * Flow:
 *   1. Validate phone number format (E.164)
 *   2. Resolve caller's org from userId (any membership)
 *   3. Verify org has a vapiPhoneNumberId (the Vapi caller-ID number)
 *   4. Look up the agent by agentId — must belong to this org
 *   5. Verify the agent has a vapiAssistantId provisioned
 *   6. Call Vapi POST /call/phone
 *   7. Pre-create a Call record (webhook will upsert the same vapiCallId)
 */
export async function initiateCall(userId: string, payload: InitiateCallPayload) {
  const { phoneNumber, agentId } = payload;

  // 1. Validate E.164 format
  if (!phoneNumber || !E164_RE.test(phoneNumber)) {
    throw BadRequest(
      'Phone number must be in E.164 format (e.g. +919876543210)',
      'INVALID_PHONE_FORMAT',
    );
  }

  // 2. Resolve org
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');
  if (!membership) throw NotFound('Organization');
  const org = membership.organizationId as IOrganization;

  // 3. Org must have a connected Vapi phone number to use as caller ID
  if (!org.vapiPhoneNumberId) {
    throw UnprocessableEntity(
      'No phone number connected to your account. Go to Settings → Phone Number to connect one.',
      'NO_PHONE_NUMBER',
    );
  }

  // 4. Agent must belong to this org
  if (!agentId) throw BadRequest('agentId is required', 'MISSING_AGENT_ID');
  const agent = await VoiceAgentModel.findOne({ _id: agentId, organizationId: org._id });
  if (!agent) throw NotFound('Agent');

  // 5. Agent must be provisioned in Vapi
  if (!agent.vapiAssistantId) {
    throw UnprocessableEntity(
      'Agent is not yet provisioned in Vapi. Try saving the agent configuration again.',
      'AGENT_NOT_PROVISIONED',
    );
  }

  // 6. Initiate Vapi outbound call
  const vapiCall = await vapiInitiateOutboundCall({
    assistantId:   agent.vapiAssistantId,
    phoneNumberId: org.vapiPhoneNumberId,
    customer:      { number: phoneNumber },
  });

  // 7. Pre-create a Call record so it appears in the dashboard immediately.
  //    The Vapi `call-started` webhook will upsert the same vapiCallId (idempotent).
  const call = await CallModel.create({
    organizationId: org._id,
    agentId:        agent._id,
    vapiCallId:     vapiCall.id,
    direction:      'Outbound',
    callerNumber:   phoneNumber,
    status:         'active',
    duration:       0,
    cost:           0,
  });

  return { call: call.toJSON(), vapiCallId: vapiCall.id };
}

// ─── getCallStats ─────────────────────────────────────────────────────────────

/**
 * Returns aggregate statistics for the authenticated org's calls:
 *   total         — all-time call count
 *   today         — calls since midnight (local UTC-0 day)
 *   avgDuration   — mean duration in seconds (completed calls only)
 *   completionRate — % of calls that reached status="completed"
 */
export async function getCallStats(userId: string) {
  const orgId = await getOrgId(userId);
  const oid   = new mongoose.Types.ObjectId(orgId);

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [total, today, completedAgg, completedCount] = await Promise.all([
    CallModel.countDocuments({ organizationId: orgId }),
    CallModel.countDocuments({ organizationId: orgId, createdAt: { $gte: todayStart } }),
    CallModel.aggregate<{ avgDuration: number }>([
      { $match: { organizationId: oid, status: 'completed' } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
    ]),
    CallModel.countDocuments({ organizationId: orgId, status: 'completed' }),
  ]);

  return {
    total,
    today,
    avgDuration:    Math.round(completedAgg[0]?.avgDuration ?? 0),
    completionRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
  };
}

// ─── getCallsByDay ────────────────────────────────────────────────────────────

/**
 * Returns call counts for each of the past 14 days (including today).
 * Result is always 14 entries, oldest-first, with 0-count gaps filled in.
 */
export async function getCallsByDay(userId: string): Promise<{ date: string; count: number }[]> {
  const orgId = await getOrgId(userId);
  const oid   = new mongoose.Types.ObjectId(orgId);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 13);
  startDate.setUTCHours(0, 0, 0, 0);

  const results = await CallModel.aggregate<{ _id: { y: number; m: number; d: number }; count: number }>([
    {
      $match: {
        organizationId: oid,
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          y: { $year:       '$createdAt' },
          m: { $month:      '$createdAt' },
          d: { $dayOfMonth: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
  ]);

  // Build lookup map: "YYYY-MM-DD" → count
  const map = new Map<string, number>();
  for (const r of results) {
    const key = `${r._id.y}-${String(r._id.m).padStart(2, '0')}-${String(r._id.d).padStart(2, '0')}`;
    map.set(key, r.count);
  }

  // Emit 14 consecutive day entries (oldest → newest, gaps = 0)
  const days: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: map.get(key) ?? 0 });
  }

  return days;
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
