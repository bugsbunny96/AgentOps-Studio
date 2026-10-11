/**
 * Call capacity — one place that decides whether an org may start a call now.
 *
 * Used by the inbound assistant-request gate (webhook.service.ts) and by
 * outbound calls (outbound.service.ts, single calls and lists).
 *
 *   minutes      plan allowance (trial: TRIAL_CALL_MINUTES) + unexpired top-up packs
 *   concurrency  plan's simultaneous-call limit (trial: 1), counting 'active'
 *                Call records younger than ACTIVE_CALL_WINDOW_MS
 *   hours        outbound only: OUTBOUND_CALLING_HOURS in IST (TRAI calling hours)
 *   plan         outbound only: needs an active trial or a paid plan
 */

import type { IOrganization, Plan } from '../organization/organization.model';
import { CallModel } from './call.model';
import { PLAN_LIMITS, getEffectiveCallMinutesLimit } from '../billing/billing.service';
import { computeTrialState } from '../billing/trial.service';
import { isPaidPlan } from '../billing/plan-catalog';
import { currentMonthMinutesUsed } from '../../utils/callMinutes';
import { validPackBalance } from '../../utils/minutePacks';
import { env } from '../../config/env';

/** A Call stuck in 'active' (missed end-of-call report) stops counting after this. */
export const ACTIVE_CALL_WINDOW_MS = 20 * 60 * 1000; // > the 15-min per-call cap

/** Trial accounts handle one call at a time. */
export const TRIAL_CONCURRENT_CALLS = 1;

export type PlanState = 'paid' | 'trial' | 'none';

type OrgLike = Pick<IOrganization, '_id' | 'plan' | 'planOverride' | 'trialUsed' | 'trialEndsAt' | 'callMinutesUsed' | 'callMinutesResetAt' | 'minutePacks'>;

export interface PlanInfo {
  state:         PlanState;
  basePlan:      Plan;
  /** Plan that governs limits (an active trial counts as Basic, minutes capped separately) */
  effectivePlan: Plan;
  isInTrial:     boolean;
}

export function getPlanInfo(org: Pick<OrgLike, 'plan' | 'planOverride' | 'trialUsed' | 'trialEndsAt'>): PlanInfo {
  const basePlan = ((org.planOverride ?? org.plan) || 'free') as Plan;
  const trial    = computeTrialState(basePlan, org.trialUsed ?? false, org.trialEndsAt);
  const state: PlanState = isPaidPlan(basePlan) ? 'paid' : trial.isInTrial ? 'trial' : 'none';
  return { state, basePlan, effectivePlan: trial.isInTrial ? 'starter' : basePlan, isInTrial: trial.isInTrial };
}

export type CapacityResult =
  | { ok: true; plan: PlanInfo; minutesLeft: number; activeCalls: number; maxConcurrent: number }
  | { ok: false; reason: 'minutes' | 'busy' | 'plan' | 'hours'; plan: PlanInfo; message: string; retryAt?: Date };

/** Parses "HH:MM-HH:MM" into minutes after midnight. Falls back to 09:00–21:00. */
export function parseHoursWindow(raw: string): { start: number; end: number } {
  const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!m) return { start: 9 * 60, end: 21 * 60 };
  return { start: +m[1] * 60 + +m[2], end: +m[3] * 60 + +m[4] };
}

const IST_OFFSET_MIN = 330;

/** Minutes after IST midnight for a given instant. */
function istMinutes(now: Date): number {
  return Math.floor(((now.getTime() / 60_000) + IST_OFFSET_MIN) % (24 * 60));
}

/** Null when `now` is inside the outbound window, else the next window opening. */
export function nextOutboundWindow(now: Date = new Date(), raw: string = env.OUTBOUND_CALLING_HOURS): Date | null {
  const { start, end } = parseHoursWindow(raw);
  const cur = istMinutes(now);
  if (cur >= start && cur < end) return null;
  const wait = cur < start ? start - cur : 24 * 60 - cur + start;
  const next = new Date(now.getTime() + wait * 60_000);
  next.setUTCSeconds(0, 0);
  return next;
}

export async function checkCallCapacity(
  org: OrgLike,
  opts: { direction: 'inbound' | 'outbound'; excludeVapiCallId?: string; now?: Date },
): Promise<CapacityResult> {
  const now  = opts.now ?? new Date();
  const plan = getPlanInfo(org);

  if (opts.direction === 'outbound') {
    if (plan.state === 'none') {
      return { ok: false, reason: 'plan', plan, message: 'Your free trial has ended. Choose a plan to make calls.' };
    }
    const retryAt = nextOutboundWindow(now);
    if (retryAt) {
      return { ok: false, reason: 'hours', plan, retryAt, message: `Outbound calls can be made between ${env.OUTBOUND_CALLING_HOURS} IST.` };
    }
  }

  // Minutes: allowance + top-up packs (packs only count on paid plans)
  const minutesLimit = getEffectiveCallMinutesLimit(plan.basePlan, plan.isInTrial);
  const minutesUsed  = currentMonthMinutesUsed(org, now);
  const packBalance  = plan.isInTrial ? 0 : validPackBalance(org.minutePacks, now);
  const minutesLeft  = minutesLimit === Infinity ? Infinity : minutesLimit + packBalance - minutesUsed;
  if (minutesLeft <= 0) {
    return {
      ok: false, reason: 'minutes', plan,
      message: plan.isInTrial
        ? 'Your trial minutes are used up. Choose a plan to keep calling.'
        : 'Your call minutes for this month are used up. Buy a top-up pack or upgrade to keep calling.',
    };
  }

  // Simultaneous calls
  const maxConcurrent = plan.isInTrial
    ? TRIAL_CONCURRENT_CALLS
    : (PLAN_LIMITS[plan.effectivePlan as keyof typeof PLAN_LIMITS]?.concurrentCalls ?? 1);
  const activeCalls = await CallModel.countDocuments({
    organizationId: org._id,
    status:         'active',
    createdAt:      { $gte: new Date(now.getTime() - ACTIVE_CALL_WINDOW_MS) },
    ...(opts.excludeVapiCallId ? { vapiCallId: { $ne: opts.excludeVapiCallId } } : {}),
  });
  if (activeCalls >= maxConcurrent) {
    return {
      ok: false, reason: 'busy', plan,
      message: `Your plan allows ${maxConcurrent} call${maxConcurrent > 1 ? 's' : ''} at a time. Try again when a call ends.`,
    };
  }

  return { ok: true, plan, minutesLeft, activeCalls, maxConcurrent };
}
