/**
 * Outbound call lists (number automation, 2026-10-08).
 *
 * A list is dialled one number at a time. Before each call the same checks as
 * a single call run (plan, minutes + packs, simultaneous calls, calling hours):
 *   busy          → retry in BUSY_RETRY_MS
 *   outside hours → wait until the window opens (status 'waiting')
 *   no minutes / no plan → remaining numbers are skipped (status 'stopped')
 * Trial lists are capped at TRIAL_BATCH_MAX_NUMBERS, paid at PAID_BATCH_MAX_NUMBERS.
 */

import mongoose from 'mongoose';
import { MembershipModel, OrganizationModel, type IOrganization } from '../organization/organization.model';
import { VoiceAgentModel } from '../agents/agent.model';
import { CallBatchModel, type ICallBatch } from './call-batch.model';
import { checkCallCapacity, getPlanInfo } from './call-capacity';
import { parsePhoneList, placeOutboundCall, resolveCallerId, capacityError } from './outbound.service';
import { AppError, BadRequest, Conflict, NotFound, UnprocessableEntity } from '../../middleware/errorHandler';
import { membershipFilter } from '../../utils/requestContext';
import { enqueueBatchStep } from '../../jobs/outboundBatch.queue';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export const BUSY_RETRY_MS = 15_000;
export const NEXT_CALL_GAP_MS = 4_000;

async function resolveOrg(userId: string): Promise<IOrganization> {
  const membership = await MembershipModel.findOne(membershipFilter(userId)).populate<{
    organizationId: IOrganization;
  }>('organizationId');
  if (!membership) throw NotFound('Organization');
  return membership.organizationId as IOrganization;
}

export async function createBatch(
  userId: string,
  body: { agentId?: string; numbers?: string | string[] },
): Promise<{ batch: ICallBatch; invalid: string[] }> {
  const org = await resolveOrg(userId);

  if (!body.agentId) throw BadRequest('agentId is required', 'MISSING_AGENT_ID');
  const agent = await VoiceAgentModel.findOne({ _id: body.agentId, organizationId: org._id });
  if (!agent) throw NotFound('Agent');
  if (!agent.vapiAssistantId) {
    throw UnprocessableEntity('Agent is not yet provisioned in Vapi. Try saving the agent configuration again.', 'AGENT_NOT_PROVISIONED');
  }

  const { numbers, invalid } = parsePhoneList(body.numbers ?? '');
  if (numbers.length === 0) throw BadRequest('Add at least one valid phone number.', 'NO_VALID_NUMBERS');

  const plan = getPlanInfo(org);
  if (plan.state === 'none') throw new AppError(402, 'Your free trial has ended. Choose a plan to make calls.', 'PLAN_REQUIRED');
  const max = plan.state === 'trial' ? env.TRIAL_BATCH_MAX_NUMBERS : env.PAID_BATCH_MAX_NUMBERS;
  if (numbers.length > max) {
    throw BadRequest(
      plan.state === 'trial'
        ? `During the trial a list can have up to ${max} numbers.`
        : `A list can have up to ${max} numbers.`,
      'LIST_TOO_LONG',
    );
  }

  // Fail fast on things that won't fix themselves (no number on a paid plan, trial calling off)
  await resolveCallerId(org);
  const capacity = await checkCallCapacity(org, { direction: 'outbound' });
  if (!capacity.ok && (capacity.reason === 'plan' || capacity.reason === 'minutes')) throw capacityError(capacity);

  const active = await CallBatchModel.exists({ organizationId: org._id, status: { $in: ['running', 'waiting'] } });
  if (active) throw Conflict('A call list is already running. Wait for it to finish or cancel it.', 'BATCH_ALREADY_RUNNING');

  const batch = await CallBatchModel.create({
    organizationId: org._id,
    agentId:        agent._id,
    createdBy:      new mongoose.Types.ObjectId(userId),
    status:         'running',
    items:          numbers.map((number) => ({ number, status: 'pending' })),
  });
  await enqueueBatchStep(batch._id.toString(), 0);
  logger.info('Outbound call list created', { orgId: org._id.toString(), batchId: batch._id.toString(), size: numbers.length });
  return { batch, invalid };
}

export async function listBatches(userId: string) {
  const org = await resolveOrg(userId);
  return CallBatchModel.find({ organizationId: org._id }).sort({ createdAt: -1 }).limit(20);
}

export async function getBatch(userId: string, batchId: string) {
  const org = await resolveOrg(userId);
  if (!mongoose.isValidObjectId(batchId)) throw NotFound('Call list');
  const batch = await CallBatchModel.findOne({ _id: batchId, organizationId: org._id });
  if (!batch) throw NotFound('Call list');
  return batch;
}

export async function cancelBatch(userId: string, batchId: string) {
  const batch = await getBatch(userId, batchId);
  if (batch.status === 'completed' || batch.status === 'cancelled') return batch;
  for (const item of batch.items) if (item.status === 'pending') { item.status = 'skipped'; item.error = 'Cancelled'; }
  batch.status = 'cancelled';
  batch.note = 'Cancelled';
  await batch.save();
  return batch;
}

/**
 * Runs one step of a list. Returns the delay (ms) before the next step, or
 * null when the list is finished, stopped or cancelled.
 */
export async function processBatchStep(batchId: string, now: Date = new Date()): Promise<number | null> {
  const batch = await CallBatchModel.findById(batchId);
  if (!batch || ['completed', 'cancelled', 'stopped'].includes(batch.status)) return null;

  const [org, agent] = await Promise.all([
    OrganizationModel.findById(batch.organizationId),
    VoiceAgentModel.findById(batch.agentId),
  ]);
  if (!org || !agent?.vapiAssistantId) {
    await stopBatch(batch._id, 'The agent or workspace is no longer available.');
    return null;
  }

  if (!batch.items.some((i) => i.status === 'pending')) {
    await CallBatchModel.updateOne({ _id: batch._id, status: { $in: ['running', 'waiting'] } }, { $set: { status: 'completed' }, $unset: { nextRunAt: 1, note: 1 } });
    return null;
  }

  const capacity = await checkCallCapacity(org, { direction: 'outbound', now });
  if (!capacity.ok) {
    if (capacity.reason === 'busy') return BUSY_RETRY_MS;
    if (capacity.reason === 'hours' && capacity.retryAt) {
      await CallBatchModel.updateOne({ _id: batch._id }, { $set: { status: 'waiting', note: capacity.message, nextRunAt: capacity.retryAt } });
      return capacity.retryAt.getTime() - now.getTime();
    }
    await stopBatch(batch._id, capacity.message);
    return null;
  }

  // Claim the next pending number atomically (positional $ = first match)
  const claimed = await CallBatchModel.findOneAndUpdate(
    { _id: batch._id, status: { $in: ['running', 'waiting'] }, 'items.status': 'pending' },
    { $set: { 'items.$.status': 'dialing', 'items.$.at': now, status: 'running' }, $unset: { nextRunAt: 1, note: 1 } },
    { new: true },
  );
  if (!claimed) return null;
  const item = claimed.items.find((i) => i.status === 'dialing' && i.at?.getTime() === now.getTime());
  if (!item) return NEXT_CALL_GAP_MS;

  try {
    const { vapiCallId } = await placeOutboundCall(org, agent, item.number, { batchId: batch._id });
    await setItem(batch._id, item.number, { status: 'called', vapiCallId });
  } catch (err) {
    const e = err as AppError;
    if (e?.code === 'LINES_BUSY') {
      await setItem(batch._id, item.number, { status: 'pending' });
      return BUSY_RETRY_MS;
    }
    await setItem(batch._id, item.number, { status: 'failed', error: (e?.message ?? 'Call failed').slice(0, 200) });
    if (e?.code === 'MINUTES_EXHAUSTED' || e?.code === 'PLAN_REQUIRED' || e?.code === 'NO_PHONE_NUMBER' || e?.code === 'TRIAL_CALLING_UNAVAILABLE') {
      await stopBatch(batch._id, e.message);
      return null;
    }
  }
  return NEXT_CALL_GAP_MS;
}

async function setItem(batchId: mongoose.Types.ObjectId, number: string, fields: { status: string; vapiCallId?: string; error?: string }) {
  const set: Record<string, unknown> = { 'items.$[it].status': fields.status };
  if (fields.vapiCallId) set['items.$[it].vapiCallId'] = fields.vapiCallId;
  if (fields.error) set['items.$[it].error'] = fields.error;
  await CallBatchModel.updateOne({ _id: batchId }, { $set: set }, { arrayFilters: [{ 'it.number': number }] });
}

async function stopBatch(batchId: mongoose.Types.ObjectId, note: string) {
  await CallBatchModel.updateOne(
    { _id: batchId },
    { $set: { status: 'stopped', note, 'items.$[p].status': 'skipped', 'items.$[p].error': note }, $unset: { nextRunAt: 1 } },
    { arrayFilters: [{ 'p.status': 'pending' }] },
  );
}
