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

// ─── Helper: start of current UTC month ──────────────────────────────────────
function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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
  };
  durationSeconds?: number;
  recordingUrl?: string;
  transcript?: string;
  messages?: VapiMessage[];
  summary?: string;
  cost?: number;
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

// ─── buildMinutesLimitAssistant ───────────────────────────────────────────────

/**
 * Returns an inline Vapi assistant payload that plays a "minutes limit reached"
 * message and ends the call immediately.
 *
 * Returned when the org has consumed its monthly call-minute quota.
 * This prevents any Vapi cost from accruing on over-limit calls — Vapi
 * connects the inline assistant (which is our cost), but the conversation is
 * a single short message, not the full live assistant.
 */
function buildMinutesLimitAssistant(
  orgName:      string,
  limitMinutes: number,
): object {
  const message =
    `Thank you for calling ${orgName}. ` +
    `We've reached our monthly call limit of ${limitMinutes} minutes. ` +
    `Please contact us via email or call back next month. ` +
    `We apologize for the inconvenience. Goodbye!`;

  return {
    assistant: {
      name: `${orgName} — Limit Reached`,
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
  let org = phoneNumberId
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
    const minutesUsed   = org.callMinutesUsed ?? 0;

    if (minutesLimit !== Infinity && minutesUsed >= minutesLimit) {
      logger.warn('assistant-request: call minutes limit exceeded — blocking call', {
        orgId:        org._id.toString(),
        effectivePlan,
        minutesUsed,
        minutesLimit,
        callId:       event.call.id,
      });
      return buildMinutesLimitAssistant(org.name, minutesLimit);
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

// ─── handleEndOfCallReport ────────────────────────────────────────────────────

export async function handleEndOfCallReport(event: VapiEndOfCallReportEvent): Promise<void> {
  const ctx = await lookupByAssistantId(event.call.assistantId);
  if (!ctx) {
    logger.warn('end-of-call-report: unknown assistantId', { assistantId: event.call.assistantId });
    return;
  }

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
        cost:           event.cost ?? 0,
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

    await OrganizationModel.findByIdAndUpdate(
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
    );

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
