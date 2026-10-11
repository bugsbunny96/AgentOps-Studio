/**
 * Outbound calling (number automation + H4.4 / BIZ-06, 2026-10-08).
 *
 * Who can call, and from which number:
 *   - Paid plan with its own number      → calls from the org's number
 *   - Active trial (no own number)       → calls from a shared trial number
 *                                           (VAPI_TRIAL_PHONE_NUMBER_IDS, least busy first)
 *   - Paid plan without a number yet     → must choose a number first
 *   - Trial ended / free                 → must choose a plan
 * Every call passes checkCallCapacity (minutes + packs, simultaneous calls,
 * OUTBOUND_CALLING_HOURS). Lists are dialled one by one by the outbound-batch
 * worker (outboundBatch.worker.ts) through the same path.
 */

import mongoose from 'mongoose';
import type { IOrganization } from '../organization/organization.model';
import type { IVoiceAgent } from '../agents/agent.model';
import { vapiInitiateOutboundCall } from '../agents/vapi.service';
import { CallModel } from './call.model';
import { AppError, UnprocessableEntity } from '../../middleware/errorHandler';
import { checkCallCapacity, getPlanInfo, type CapacityResult } from './call-capacity';
import { trialPhoneNumberIds } from './webhook.service';
import { logger } from '../../utils/logger';

/** Strict E.164: + followed by 2–15 digits */
export const E164_RE = /^\+[1-9]\d{1,14}$/;

/** Turns what people type ("98765 43210", "09876543210", "+91-98765-43210") into E.164, or null. */
export function normalizePhone(raw: string): string | null {
  const s = (raw ?? '').replace(/[\s()-]/g, '');
  if (/^\+\d{8,15}$/.test(s)) return E164_RE.test(s) ? s : null;
  if (/^0?[6-9]\d{9}$/.test(s)) return `+91${s.slice(-10)}`;   // Indian mobile
  if (/^0\d{10}$/.test(s)) return `+91${s.slice(1)}`;            // Indian landline with 0
  if (/^91\d{10}$/.test(s)) return `+${s}`;
  return null;
}

/** Splits a pasted list (newlines, commas, semicolons, tabs) into unique E.164 numbers + rejects. */
export function parsePhoneList(input: string | string[]): { numbers: string[]; invalid: string[] } {
  const parts = (Array.isArray(input) ? input : String(input ?? '').split(/[\n,;\t]+/))
    .map((p) => String(p).trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const numbers: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    const n = normalizePhone(p);
    if (!n) { invalid.push(p); continue; }
    if (!seen.has(n)) { seen.add(n); numbers.push(n); }
  }
  return { numbers, invalid };
}

/** Maps a failed capacity check to an HTTP error. */
export function capacityError(c: Extract<CapacityResult, { ok: false }>): AppError {
  switch (c.reason) {
    case 'plan':    return new AppError(402, c.message, 'PLAN_REQUIRED');
    case 'minutes': return new AppError(402, c.message, 'MINUTES_EXHAUSTED');
    case 'busy':    return new AppError(429, c.message, 'LINES_BUSY');
    case 'hours':   return new AppError(422, c.message, 'OUTSIDE_CALLING_HOURS');
  }
}

/** Shared trial number with the fewest active outbound calls right now. */
export async function pickSharedTrialNumber(): Promise<string | null> {
  const ids = trialPhoneNumberIds();
  if (ids.length === 0) return null;
  const busy = await CallModel.aggregate<{ _id: string; n: number }>([
    { $match: { fromPhoneNumberId: { $in: ids }, status: 'active', createdAt: { $gte: new Date(Date.now() - 20 * 60 * 1000) } } },
    { $group: { _id: '$fromPhoneNumberId', n: { $sum: 1 } } },
  ]);
  const load = new Map(busy.map((b) => [b._id, b.n]));
  return [...ids].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0];
}

/** Which Vapi phone number this org's outbound call goes out from. */
export async function resolveCallerId(org: IOrganization): Promise<{ phoneNumberId: string; shared: boolean }> {
  const plan = getPlanInfo(org);
  if (org.vapiPhoneNumberId) return { phoneNumberId: org.vapiPhoneNumberId, shared: false };
  if (plan.state === 'paid') {
    throw UnprocessableEntity(
      'Choose your business phone number first (Settings → Phone number). It is included in your plan.',
      'NO_PHONE_NUMBER',
    );
  }
  if (plan.state === 'trial') {
    const shared = await pickSharedTrialNumber();
    if (!shared) {
      throw new AppError(503, 'Trial calling is not available right now. Please try again later.', 'TRIAL_CALLING_UNAVAILABLE');
    }
    return { phoneNumberId: shared, shared: true };
  }
  throw new AppError(402, 'Your free trial has ended. Choose a plan to make calls.', 'PLAN_REQUIRED');
}

/**
 * Places one outbound call after every check. Throws AppError on refusal.
 * The Call record is created right away (webhooks upsert the same vapiCallId).
 */
export async function placeOutboundCall(
  org: IOrganization,
  agent: Pick<IVoiceAgent, '_id' | 'vapiAssistantId'>,
  number: string,
  opts: { batchId?: mongoose.Types.ObjectId } = {},
) {
  const capacity = await checkCallCapacity(org, { direction: 'outbound' });
  if (!capacity.ok) throw capacityError(capacity);

  const { phoneNumberId, shared } = await resolveCallerId(org);

  const vapiCall = await vapiInitiateOutboundCall({
    assistantId:   agent.vapiAssistantId,
    phoneNumberId,
    customer:      { number },
  });

  const call = await CallModel.create({
    organizationId:    org._id,
    agentId:           agent._id,
    vapiCallId:        vapiCall.id,
    direction:         'Outbound',
    callerNumber:      number,
    status:            'active',
    duration:          0,
    cost:              0,
    fromPhoneNumberId: phoneNumberId,
    ...(opts.batchId ? { batchId: opts.batchId } : {}),
  });

  logger.info('Outbound call placed', { orgId: org._id.toString(), vapiCallId: vapiCall.id, shared, batchId: opts.batchId?.toString() });
  return { call, vapiCallId: vapiCall.id, shared };
}
