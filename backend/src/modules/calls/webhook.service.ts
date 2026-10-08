/**
 * Vapi Webhook Service
 *
 * Handles Vapi call lifecycle events:
 *
 *   assistant-request   → SYNCHRONOUS — business hours gate.
 *                         Returns live assistant config if within hours,
 *                         or an after-hours inline assistant if closed.
 *
 *   call-started        → Creates Call record (status: active).
 *
 *   end-of-call-report  → Updates Call + creates Transcript + Summary.
 *
 * Verification: Vapi sends the configured secret in the `x-vapi-secret` header.
 * We compare it with env.VAPI_WEBHOOK_SECRET using timingSafeEqual.
 */

import { timingSafeEqual } from 'crypto';
import { OrganizationModel }  from '../organization/organization.model';
import { VoiceAgentModel }    from '../agents/agent.model';
import { CallModel, TranscriptModel, SummaryModel } from './call.model';
import { isWithinBusinessHours, formatBusinessHours } from '../../utils/businessHours';
import { PLAN_LIMITS, getEffectiveCallMinutesLimit } from '../billing/billing.service';
import { computeTrialState }  from '../billing/trial.service';
import { env }    from '../../config/env';
import { logger } from '../../utils/logger';
import { enqueueFollowUpAlert } from '../../jobs/followUpAlert.queue';
import type { VapiCostBreakdown } from '../agents/vapi.service';
import { currentMonthMinutesUsed, startOfMonthUTC } from '../../utils/callMinutes';
import { validPackBalance, overflowMinutes, allocatePackConsumption } from '../../utils/minutePacks';
import { USAGE_ALERT_THRESHOLDS, PLAN_DISPLAY_NAME } from '../billing/plan-catalog';
import { UserModel } from '../auth/auth.model';
import { MembershipModel, type IOrganization } from '../organization/organization.model';
import { sendUsageAlertEmail } from '../../utils/email';

// ─── Helper: start of current UTC month ──────────────────────────────────────
function startOfCurrentMonthUTC(): Date {
  return startOfMonthUTC();
}

// ─── Shared-secret verification ───────────────────────────────────────────────

export function verifyVapiSecret(incomingSecret: string | undefined): boolean {
  const expected = env.VAPI_WEBHOOK_SECRET;
  if (!expected) {
    if (env.NODE_ENV === 'production') {
      logger.warn('VAPI_WEBHOOK_SECRET not configured — rejecting webhook in production');
      return false;
    }
    logger.warn('VAPI_WEBHOOK_SECRET not set — skipping verification in dev mode');
    return true;
  }
  if (!incomingSecret) return false;

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(incomingSecret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Vapi event type definitions ─────────────────────────────────────────────

/**
 * assistant-request — fires BEFORE the call connects.
 * We respond synchronously with either:
 *   { assistantId: "<id>" }         — open for business
 *   { assistant: { ... inline } }   — after-hours message bot
 *
 * The call object includes the Vapi phone number ID used to look up the org.
 */
export interface VapiAssistantRequestEvent {
  type: 'assistant-request';
  call: {
    id: string;
    type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
    phoneNumberId?: string;
    customer?: { number?: string };
    phoneNumber?: { id: string; number?: string; name?: string };
  };
}

export interface VapiCallStartedEvent {
  type: 'call-started';
  call: {
    id: string;
    assistantId: string;
    type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
    customer?: { number?: string };
  };
}

interface VapiMessage {
  role: 'assistant' | 'user' | 'system' | 'tool';
  content?: string;
  message?: string;
  time?: number;
}

/** Structured output from the electrical-shop-call-summary Vapi schema */
interface CallStructuredOutput {
  language_used?:              Array<'hi' | 'en' | 'mixed'>;
  intent?:                     'product_inquiry' | 'order' | 'order_status_check' | 'complaint' | 'other';
  products_discussed?:         Array<{
    category:         string;
    item:             string;
    qty:              number | null;
    unit_price_quoted: number | null;
  }>;
  order?: {
    order_requested?:              boolean;
    fulfillment_type?:             'pickup' | 'delivery' | 'not_applicable';
    delivery_address?: {
      line1:   string | null;
      city:    string | null;
      pincode: string | null;
    } | null;
    preferred_delivery_window?:    string | null;
    total_amount?:                 number | null;
    customer_confirmed_readback?:  boolean;
  };
  follow_up_needed?:  boolean;
  follow_up_reason?:  string | null;
  call_summary?:      string;
}

export interface VapiEndOfCallReportEvent {
  type: 'end-of-call-report';
  call: {
    id: string;
    assistantId: string;
    type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
    customer?: { number?: string };
    endedReason?: string;
    /** Some Vapi payload versions carry the cost on the call object instead */
    cost?: number;
  };
  durationSeconds?: number;
  recordingUrl?: string;
  transcript?: string;
  messages?: VapiMessage[];
  summary?: string;
  /** Vapi's total call cost in USD */
  cost?: number;
  /** Per-component cost (stt, llm, tts, vapi platform, transport) + token counts */
  costBreakdown?: VapiCostBreakdown;
  /** Vapi artifact: recording URL + structured output from artifactPlan schema */
  artifact?: {
    recordingUrl?:        string;
    structuredDataOutput?: CallStructuredOutput;
  };
}

export type VapiWebhookEvent =
  | { message: VapiAssistantRequestEvent }
  | { message: VapiCallStartedEvent }
  | { message: VapiEndOfCallReportEvent }
  | { message: { type: string } };          // catch-all for unknown events

// ─── After-hours inline assistant ────────────────────────────────────────────

/**
 * Build a minimal Vapi assistant payload that plays a "we're closed" message
 * and ends the call immediately. Returned when the org is outside business hours.
 */
function buildAfterHoursAssistant(
  orgName: string,
  hoursLabel: string,
): object {
  const message =
    `Thank you for calling ${orgName}. ` +
    `We are currently closed. ` +
    `Our business hours are ${hoursLabel}. ` +
    `Please call us back during business hours. Goodbye!`;

  return {
    assistant: {
      name: `${orgName} — After Hours`,
      model: {
        provider: 'openai',
        model:    'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              `You are an after-hours answering service. ` +
              `When the call starts, say exactly this message and then end the call: "${message}"`,
          },
        ],
        temperature: 0,
        maxTokens:   100,
      },
      voice: {
        provider: 'openai',
        voiceId:  'nova',
      },
      firstMessage: message,
      firstMessageMode: 'assistant-speaks-first',
      endCallPhrases:   ['goodbye', 'bye'],
      maxDurationSeconds: 45,   // hard cap — should end in <20 s
      backgroundSound: 'off',
    },
  };
}

// ─── Unavailable responses (minutes used up / all lines busy) ─────────────────

/** Normalises the org's fallback number to E.164 (10-digit Indian numbers get +91). Null if unusable. */
export function toE164(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s()-]/g, '');
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  if (/^0?\d{10}$/.test(digits)) return `+91${digits.slice(-10)}`;
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

/**
 * Inline Vapi assistant that plays one short message and ends the call.
 * The caller never hears about plan limits — only that the line is unavailable.
 */
function buildUnavailableAssistant(orgName: string, reason: 'minutes' | 'busy'): object {
  const message = reason === 'busy'
    ? `Thank you for calling ${orgName}. All our lines are busy right now. Please call back in a few minutes. Goodbye!`
    : `Thank you for calling ${orgName}. We are unable to take your call right now. Please call back later. Goodbye!`;

  return {
    assistant: {
      name: `${orgName} — ${reason === 'busy' ? 'Lines Busy' : 'Unavailable'}`,
      model: {
        provider:    'openai',
        model:       'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              `You are a polite answering service. ` +
              `Say exactly this message and then end the call: "${message}"`,
          },
        ],
        temperature: 0,
        maxTokens:   150,
      },
      voice: {
        provider: 'openai',
        voiceId:  'nova',
      },
      firstMessage:     message,
      firstMessageMode: 'assistant-speaks-first',
      endCallPhrases:   ['goodbye', 'bye', 'thank you'],
      maxDurationSeconds: 45,
      backgroundSound: 'off',
    },
  };
}

/**
 * Response when the AI agent can't take the call (minutes used up, or the
 * plan's simultaneous-call limit reached). With a usable fallback number the
 * call is transferred straight to the business (no dead line, no AI minutes);
 * otherwise a short message plays.
 * Vapi accepts `{ destination }` in the assistant-request response to transfer
 * without an assistant — verify on the first live occurrence.
 */
export function buildUnavailableResponse(
  org: { name: string; fallbackNumber?: string },
  reason: 'minutes' | 'busy',
): object {
  const number = toE164(org.fallbackNumber);
  if (number) {
    return { destination: { type: 'number', number, message: '' } };
  }
  return buildUnavailableAssistant(org.name, reason);
}

/** A Call stuck in 'active' (missed end-of-call report) stops counting after this. */
const ACTIVE_CALL_WINDOW_MS = 20 * 60 * 1000; // > the 15-min per-call cap

// ─── handleAssistantRequest (SYNCHRONOUS) ─────────────────────────────────────

/**
 * Determines which assistant to connect based on business hours.
 *
 * Lookup chain:
 *   vapiPhoneNumberId from event → org → businessHours → decision
 *
 * Returns a Vapi-ready response object (caller is responsible for res.json()).
 */
export async function handleAssistantRequest(
  event: VapiAssistantRequestEvent,
): Promise<object> {
  const phoneNumberId =
    event.call.phoneNumberId ?? event.call.phoneNumber?.id;

  // ── Look up org by Vapi phone number ID ───────────────────────────────────
  const org = phoneNumberId
    ? await OrganizationModel.findOne({ vapiPhoneNumberId: phoneNumberId })
    : null;

  // Fallback: if phone number not yet linked, try matching by assistantId
  // (works during test calls where assistantId is set but no phone number)
  if (!org) {
    logger.warn('assistant-request: phoneNumberId not found, checking for test call', {
      phoneNumberId,
      callId: event.call.id,
    });
    // For web/test calls with no phone number, pass through to Vapi default
    return { message: 'No matching organization found for this phone number' };
  }

  // ── Call minutes quota gate ───────────────────────────────────────────────
  // Must be checked BEFORE Vapi connects any assistant to prevent cost exposure.
  // Trial orgs get the 30-min trial cap (not the full plan allocation);
  // planOverride takes precedence over plan.
  {
    const basePlan   = ((org.planOverride ?? org.plan) || 'free') as keyof typeof PLAN_LIMITS;
    const trialState = computeTrialState(
      basePlan,
      org.trialUsed  ?? false,
      org.trialEndsAt,
    );
    const effectivePlan = trialState.isInTrial ? 'starter' : basePlan;
    const minutesLimit  = getEffectiveCallMinutesLimit(basePlan, trialState.isInTrial);
    // BIZ-01: a counter from a previous month counts as 0 (reset worker may be off)
    const minutesUsed   = currentMonthMinutesUsed(org);
    // Pricing v2: prepaid top-up minutes extend the allowance (paid plans only)
    const packBalance   = trialState.isInTrial ? 0 : validPackBalance(org.minutePacks);

    if (minutesLimit !== Infinity && minutesUsed >= minutesLimit + packBalance) {
      logger.warn('assistant-request: call minutes and top-up packs used up — not connecting the agent', {
        orgId:        org._id.toString(),
        effectivePlan,
        minutesUsed,
        minutesLimit,
        packBalance,
        callId:       event.call.id,
      });
      return buildUnavailableResponse(org, 'minutes');
    }

    // Pricing v2: simultaneous-call limit per plan
    const maxConcurrent = PLAN_LIMITS[effectivePlan as keyof typeof PLAN_LIMITS]?.concurrentCalls ?? 1;
    const activeCalls   = await CallModel.countDocuments({
      organizationId: org._id,
      status:         'active',
      createdAt:      { $gte: new Date(Date.now() - ACTIVE_CALL_WINDOW_MS) },
      ...(event.call.id ? { vapiCallId: { $ne: event.call.id } } : {}),
    });
    if (activeCalls >= maxConcurrent) {
      logger.warn('assistant-request: simultaneous-call limit reached', {
        orgId: org._id.toString(), effectivePlan, activeCalls, maxConcurrent, callId: event.call.id,
      });
      return buildUnavailableResponse(org, 'busy');
    }
  }

  const hoursLabel = formatBusinessHours(
    org.businessHours?.start ?? '09:00',
    org.businessHours?.end   ?? '18:00',
    org.timezone ?? 'Asia/Kolkata',
  );

  const isOpen = isWithinBusinessHours(
    org.businessHours?.start ?? '09:00',
    org.businessHours?.end   ?? '18:00',
    org.timezone ?? 'Asia/Kolkata',
  );

  logger.info('assistant-request: business hours check', {
    orgId:   org._id.toString(),
    isOpen,
    hours:   hoursLabel,
    callId:  event.call.id,
  });

  // ── Outside hours: return after-hours assistant ────────────────────────────
  if (!isOpen) {
    logger.info('assistant-request: outside hours — routing to after-hours assistant', {
      orgId: org._id.toString(),
    });
    return buildAfterHoursAssistant(org.name, hoursLabel);
  }

  // ── Within hours: return the provisioned assistant ─────────────────────────
  if (!org.vapiAssistantId) {
    logger.warn('assistant-request: org has no vapiAssistantId yet', {
      orgId: org._id.toString(),
    });
    // No assistant provisioned — play a friendly holding message
    return buildAfterHoursAssistant(
      org.name,
      'not yet configured — please contact the administrator',
    );
  }

  logger.info('assistant-request: routing to live assistant', {
    orgId:           org._id.toString(),
    vapiAssistantId: org.vapiAssistantId,
  });

  return { assistantId: org.vapiAssistantId };
}

// ─── Helpers (shared with call-started / end-of-call-report) ─────────────────

/** First finite cost Vapi reported: message.cost → call.cost → costBreakdown.total. */
export function resolveReportedCost(event: Pick<VapiEndOfCallReportEvent, 'cost' | 'call' | 'costBreakdown'>): number | undefined {
  const candidates = [event.cost, event.call?.cost, event.costBreakdown?.total];
  return candidates.find((c): c is number => typeof c === 'number' && Number.isFinite(c) && c >= 0);
}

/** Keeps only the numeric fields we store (Vapi adds analysis/voicemail fields we don't need). */
export function pickCostBreakdown(b: VapiCostBreakdown): VapiCostBreakdown {
  const keys: Array<keyof VapiCostBreakdown> = [
    'transport', 'stt', 'llm', 'tts', 'vapi', 'total',
    'llmPromptTokens', 'llmCompletionTokens', 'ttsCharacters',
  ];
  const out: VapiCostBreakdown = {};
  for (const k of keys) {
    const v = b[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

async function lookupByAssistantId(vapiAssistantId: string) {
  const agent = await VoiceAgentModel.findOne({ vapiAssistantId });
  if (!agent) return null;
  const org = await OrganizationModel.findById(agent.organizationId);
  if (!org) return null;
  return { org, agent };
}

function callerNumber(
  callObj: VapiCallStartedEvent['call'] | VapiEndOfCallReportEvent['call'],
): string {
  return callObj.customer?.number ?? 'Unknown';
}

function direction(callType: string): 'Inbound' | 'Outbound' {
  return callType === 'outboundPhoneCall' ? 'Outbound' : 'Inbound';
}

// ─── handleCallStarted ────────────────────────────────────────────────────────

export async function handleCallStarted(event: VapiCallStartedEvent): Promise<void> {
  const ctx = await lookupByAssistantId(event.call.assistantId);
  if (!ctx) {
    logger.warn('call-started: unknown assistantId', { assistantId: event.call.assistantId });
    return;
  }

  await CallModel.findOneAndUpdate(
    { vapiCallId: event.call.id },
    {
      $setOnInsert: {
        organizationId: ctx.org._id,
        agentId:        ctx.agent._id,
        vapiCallId:     event.call.id,
        direction:      direction(event.call.type),
        callerNumber:   callerNumber(event.call),
        status:         'active',
        duration:       0,
        cost:           0,
      },
    },
    { upsert: true, new: true },
  );

  logger.info('call-started recorded', {
    vapiCallId: event.call.id,
    orgId: ctx.org._id.toString(),
  });
}

// ─── Top-up packs + usage alerts (pricing v2) ─────────────────────────────────

type OrgDoc = IOrganization;

/**
 * After a call's minutes are added to the monthly counter:
 *   1. Minutes beyond the plan allowance are deducted from top-up packs (FIFO by expiry).
 *   2. The Owner gets one email per month at 80% and at 100% of the plan allowance.
 * Trial orgs are skipped (30-min trial cap, no packs, trial emails cover them).
 */
export async function applyPackUsageAndAlerts(org: OrgDoc, minutesThisCall: number, monthStart: Date): Promise<void> {
  const basePlan = ((org.planOverride ?? org.plan) || 'free') as keyof typeof PLAN_LIMITS;
  const trial    = computeTrialState(basePlan, org.trialUsed ?? false, org.trialEndsAt);
  if (trial.isInTrial) return;

  const limit      = PLAN_LIMITS[basePlan]?.callMinutes ?? Infinity;
  const usedAfter  = org.callMinutesUsed ?? 0;
  const usedBefore = Math.max(0, usedAfter - minutesThisCall);

  // 1. Pack consumption
  const overflow = overflowMinutes(usedBefore, usedAfter, limit);
  if (overflow > 0) {
    const { takes, uncovered } = allocatePackConsumption(org.minutePacks, overflow);
    for (const t of takes) {
      await OrganizationModel.updateOne(
        { _id: org._id, minutePacks: { $elemMatch: { stripeSessionId: t.stripeSessionId, remaining: { $gte: t.take } } } },
        { $inc: { 'minutePacks.$.remaining': -t.take } },
      );
    }
    logger.info('Top-up minutes used', { orgId: org._id.toString(), overflow, takes, uncovered });
  }

  // 2. Usage alerts (plan allowance only; free plan gets none)
  if (!Number.isFinite(limit) || basePlan === 'free' || limit <= 0) return;
  for (const threshold of USAGE_ALERT_THRESHOLDS) {
    const field   = threshold >= 1 ? 'usageAlert100At' : 'usageAlert80At';
    const crossed = usedBefore < limit * threshold && usedAfter >= limit * threshold;
    if (!crossed) continue;
    // Claim the alert for this month atomically so concurrent call-ends send it once
    const claimed = await OrganizationModel.updateOne(
      { _id: org._id, $or: [{ [field]: { $exists: false } }, { [field]: { $lt: monthStart } }] },
      { $set: { [field]: monthStart } },
    );
    if (claimed.modifiedCount !== 1) continue;
    await sendUsageAlertSafe(org, Math.round(threshold * 100), usedAfter, limit);
  }
}

async function sendUsageAlertSafe(org: OrgDoc, percent: number, used: number, limit: number): Promise<void> {
  try {
    const owner = await MembershipModel.findOne({ organizationId: org._id, role: 'Owner' }).lean();
    const user  = owner ? await UserModel.findById(owner.userId).lean() : null;
    if (!user?.email) return;
    const plan = ((org.planOverride ?? org.plan) || 'free') as keyof typeof PLAN_DISPLAY_NAME;
    await sendUsageAlertEmail({
      email:         user.email,
      name:          (user as { name?: string }).name ?? 'there',
      orgName:       org.name,
      planName:      PLAN_DISPLAY_NAME[plan],
      percent,
      used,
      limit,
      packBalance:   validPackBalance(org.minutePacks),
    });
  } catch (err) {
    logger.error('Usage alert email failed', {
      orgId: org._id.toString(), percent, error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── handleEndOfCallReport ────────────────────────────────────────────────────

export async function handleEndOfCallReport(event: VapiEndOfCallReportEvent): Promise<void> {
  const ctx = await lookupByAssistantId(event.call.assistantId);
  if (!ctx) {
    logger.warn('end-of-call-report: unknown assistantId', { assistantId: event.call.assistantId });
    return;
  }

  // Real per-call cost from Vapi (USD). Undefined → not reported; the call is
  // stored with costSource 'none' and can be filled by scripts/backfill-call-costs.ts.
  const reportedCost = resolveReportedCost(event);

  // Vapi puts recordingUrl in both the top-level field and artifact.recordingUrl.
  // artifact.recordingUrl is the authoritative source in newer Vapi payloads.
  const resolvedRecordingUrl =
    event.artifact?.recordingUrl ?? event.recordingUrl;

  // Extract structured output (may be absent if the call ended before Vapi generated it)
  const so = event.artifact?.structuredDataOutput;
  const structuredFields = so
    ? {
        languageUsed:              so.language_used ?? [],
        intent:                    so.intent,
        productsDiscussed: (so.products_discussed ?? []).map((p) => ({
          category:        p.category,
          item:            p.item,
          qty:             p.qty ?? null,
          unitPriceQuoted: p.unit_price_quoted ?? null,
        })),
        orderRequested:            so.order?.order_requested ?? false,
        fulfillmentType:           so.order?.fulfillment_type,
        deliveryAddress:           so.order?.delivery_address ?? null,
        preferredDeliveryWindow:   so.order?.preferred_delivery_window ?? null,
        totalAmount:               so.order?.total_amount ?? null,
        customerConfirmedReadback: so.order?.customer_confirmed_readback ?? false,
        followUpNeeded:            so.follow_up_needed ?? false,
        followUpReason:            so.follow_up_reason ?? null,
        callSummaryStructured:     so.call_summary,
      }
    : {};

  const call = await CallModel.findOneAndUpdate(
    { vapiCallId: event.call.id },
    {
      $set: {
        organizationId: ctx.org._id,
        agentId:        ctx.agent._id,
        direction:      direction(event.call.type),
        callerNumber:   callerNumber(event.call),
        status:         'completed',
        duration:       Math.round(event.durationSeconds ?? 0),
        recordingUrl:   resolvedRecordingUrl,
        cost:           reportedCost ?? 0,
        costSource:     reportedCost !== undefined ? 'vapi' : 'none',
        ...(event.costBreakdown ? { costBreakdown: pickCostBreakdown(event.costBreakdown) } : {}),
        endedReason:    event.call.endedReason,
        // Spread structured output fields (empty object if not present)
        ...structuredFields,
      },
    },
    { upsert: true, new: true },
  );

  if (!call) {
    logger.error('end-of-call-report: failed to upsert call', { vapiCallId: event.call.id });
    return;
  }

  // ── Increment monthly call-minute counter on the org (atomic, self-healing) ─
  // Uses an aggregation-pipeline update so the reset check + increment happen in
  // a single round-trip — no race conditions between concurrent call completions.
  if (event.durationSeconds && event.durationSeconds > 0) {
    const minutesThisCall = Math.max(1, Math.ceil(event.durationSeconds / 60));
    const monthStart      = startOfCurrentMonthUTC();

    const updatedOrg = await OrganizationModel.findByIdAndUpdate(
      ctx.org._id,
      [
        {
          $set: {
            // Self-healing: if stored reset date is before this month, start fresh.
            callMinutesUsed: {
              $cond: {
                if:   { $lt: ['$callMinutesResetAt', monthStart] },
                then: minutesThisCall,
                else: { $add: ['$callMinutesUsed', minutesThisCall] },
              },
            },
            callMinutesResetAt: {
              $cond: {
                if:   { $lt: ['$callMinutesResetAt', monthStart] },
                then: monthStart,
                else: '$callMinutesResetAt',
              },
            },
          },
        },
      ],
      { new: true },
    );

    if (updatedOrg) {
      try {
        await applyPackUsageAndAlerts(updatedOrg, minutesThisCall, monthStart);
      } catch (err) {
        logger.error('end-of-call-report: pack/alert bookkeeping failed', {
          orgId: ctx.org._id.toString(), error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('end-of-call-report: call minutes incremented', {
      orgId:         ctx.org._id.toString(),
      minutesThisCall,
      durationSeconds: event.durationSeconds,
    });
  }

  // Build transcript turns
  const turns: Array<{ speaker: 'agent' | 'user'; text: string; timestamp: Date }> = [];

  if (event.messages && event.messages.length > 0) {
    const now = new Date();
    for (const msg of event.messages) {
      const text = (msg.content ?? msg.message ?? '').trim();
      if (!text) continue;
      if (msg.role === 'assistant') {
        turns.push({ speaker: 'agent', text, timestamp: now });
      } else if (msg.role === 'user') {
        turns.push({ speaker: 'user', text, timestamp: now });
      }
    }
  } else if (event.transcript) {
    const lines = event.transcript.split('\n').filter(Boolean);
    const now   = new Date();
    for (const line of lines) {
      if (line.startsWith('AI:')) {
        turns.push({ speaker: 'agent', text: line.replace(/^AI:\s*/, '').trim(), timestamp: now });
      } else if (line.startsWith('User:')) {
        turns.push({ speaker: 'user',  text: line.replace(/^User:\s*/, '').trim(), timestamp: now });
      }
    }
  }

  if (turns.length > 0) {
    // Build the denormalised fullText string for MongoDB text-search indexing.
    // Format: "AGENT: <text>\nUSER: <text>\n..." — one line per turn.
    // Speaker prefix makes phrase searches like "user said: appointment" work.
    const fullText = turns
      .map((t) => `${t.speaker === 'agent' ? 'AGENT' : 'USER'}: ${t.text}`)
      .join('\n');

    await TranscriptModel.findOneAndUpdate(
      { callId: call._id },
      {
        $set: {
          callId:         call._id,
          organizationId: ctx.org._id,  // required for tenant-scoped text search
          turns,
          fullText,                      // indexed by transcript_fulltext_idx
        },
      },
      { upsert: true },
    );
  }

  // Prefer structured output summary; fall back to Vapi's built-in summary (may be
  // empty when analysisPlan.summaryPlan.enabled is false — which is the case for
  // electrical-shop agents that use structuredDataOutput instead).
  const summaryText = so?.call_summary ?? event.summary;
  if (summaryText) {
    const resolutionState =
      so?.follow_up_needed === true   ? 'Needs_Followup' :
      event.call.endedReason === 'transfer' ? 'Transferred' :
      'Resolved';

    await SummaryModel.findOneAndUpdate(
      { callId: call._id },
      {
        $set: {
          callId:          call._id,
          summaryText,
          intentDetected:  so?.intent ? [so.intent] : [],
          actionItems:     so?.follow_up_reason ? [so.follow_up_reason] : [],
          resolutionState,
        },
      },
      { upsert: true },
    );
  }

  // ── Enqueue follow-up alert when structured output flags it ─────────────
  if (so?.follow_up_needed === true) {
    try {
      await enqueueFollowUpAlert({
        callId:        call._id.toString(),
        vapiCallId:    event.call.id,
        orgId:         ctx.org._id.toString(),
        followUpReason: so.follow_up_reason ?? null,
        callerNumber:  event.call.customer?.number,
        callEndedAt:   new Date().toISOString(),
        callSummary:   so.call_summary ?? null,
      });
    } catch (alertErr) {
      // Non-fatal — log but don't fail the webhook handler
      logger.error('Failed to enqueue follow-up alert', { vapiCallId: event.call.id, err: alertErr });
    }
  }

  logger.info('end-of-call-report processed', {
    vapiCallId:       event.call.id,
    orgId:            ctx.org._id.toString(),
    duration:         event.durationSeconds,
    turns:            turns.length,
    hasSummary:       Boolean(summaryText),
    hasStructured:    Boolean(so),
    intent:           so?.intent,
    followUpNeeded:   so?.follow_up_needed ?? false,
    orderRequested:   so?.order?.order_requested ?? false,
  });
}

// ─── dispatchWebhookEvent (async fire-and-forget for non-assistant-request) ───

export async function dispatchWebhookEvent(
  body: VapiWebhookEvent,
): Promise<void> {
  const msg = body.message;
  if (!msg) return;

  switch (msg.type) {
    case 'call-started':
      await handleCallStarted(msg as VapiCallStartedEvent);
      break;
    case 'end-of-call-report':
      await handleEndOfCallReport(msg as VapiEndOfCallReportEvent);
      break;
    default:
      logger.debug('Unhandled Vapi event type', { type: (msg as { type: string }).type });
  }
}
