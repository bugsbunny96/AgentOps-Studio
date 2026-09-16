/**
 * 19.5 Voice Quality Monitoring
 *
 * Flags calls that indicate quality issues — the super admin can view these
 * to spot systemic problems (bad Vapi config, STT failures, networking issues).
 *
 * Flagging rules:
 *   • endedReason in BAD_ENDED_REASONS  → quality: 'poor'
 *   • duration < MIN_DURATION_SECS AND status === 'completed' → quality: 'short' (likely phantom call)
 *   • status === 'failed'               → quality: 'failed'
 *   • Otherwise                         → quality: 'ok'  (not returned by flagged-calls endpoint)
 */
import mongoose from 'mongoose';
import { CallModel } from '../calls/call.model';

export type CallQuality = 'poor' | 'short' | 'failed';

export interface FlaggedCall {
  callId:         string;
  orgId:          string;
  vapiCallId:     string;
  direction:      string;
  durationSecs:   number;
  status:         string;
  endedReason?:   string;
  quality:        CallQuality;
  qualityReason:  string;
  cost:           number;
  createdAt:      Date;
}

export interface VoiceQualitySummary {
  totalFlagged:   number;
  byQuality:      Record<CallQuality, number>;
  byEndedReason:  Record<string, number>;
  flaggedCalls:   FlaggedCall[];
}

/** endedReasons that indicate a quality problem */
const BAD_ENDED_REASONS = new Set([
  'silence-timed-out',
  'error',
  'pipeline-error',
  'call-hangup-restart',
  'assistant-error',
  'twilio-error',
  'vapi-error',
  'connection-error',
  'media-error',
  'transport-failure',
  'assistant-not-found',
  'phone-number-not-found',
  'assistant-request-failed',
  'assistant-request-returned-error',
  'assistant-request-returned-invalid-assistant',
]);

/** Any call under 8 seconds that completed is likely a phantom / junk call */
const MIN_DURATION_SECS = 8;

function classifyCall(
  status: string,
  endedReason: string | undefined,
  durationSecs: number,
): { quality: CallQuality | null; reason: string } {
  if (status === 'failed') return { quality: 'failed', reason: 'Call failed (status=failed)' };
  if (endedReason && BAD_ENDED_REASONS.has(endedReason))
    return { quality: 'poor', reason: `Bad endedReason: ${endedReason}` };
  if (status === 'completed' && durationSecs < MIN_DURATION_SECS)
    return { quality: 'short', reason: `Extremely short call (${durationSecs}s < ${MIN_DURATION_SECS}s)` };
  return { quality: null, reason: '' };
}

export async function getFlaggedCalls(opts: {
  orgId?:    string;
  days?:     number;
  limit?:    number;
  offset?:   number;
}): Promise<VoiceQualitySummary> {
  const { orgId, days = 30, limit = 50, offset = 0 } = opts;

  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const filter: Record<string, unknown> = { createdAt: { $gte: since } };
  if (orgId) filter.organizationId = new mongoose.Types.ObjectId(orgId);

  // Pull calls that are either failed OR have a bad endedReason OR are very short
  // We over-fetch a bit and classify in-process (simpler than a complex $or index query)
  const calls = await CallModel.find({
    ...filter,
    $or: [
      { status: 'failed' },
      { endedReason: { $in: Array.from(BAD_ENDED_REASONS) } },
      { status: 'completed', duration: { $lt: MIN_DURATION_SECS } },
    ],
  })
    .select('organizationId vapiCallId direction duration status endedReason cost createdAt')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const flagged: FlaggedCall[] = [];
  const byQuality: Record<CallQuality, number> = { poor: 0, short: 0, failed: 0 };
  const byEndedReason: Record<string, number> = {};

  for (const c of calls) {
    const { quality, reason } = classifyCall(c.status, c.endedReason, c.duration ?? 0);
    if (!quality) continue;

    flagged.push({
      callId:       c._id.toString(),
      orgId:        c.organizationId.toString(),
      vapiCallId:   c.vapiCallId,
      direction:    c.direction,
      durationSecs: c.duration ?? 0,
      status:       c.status,
      endedReason:  c.endedReason,
      quality,
      qualityReason: reason,
      cost:         c.cost ?? 0,
      createdAt:    c.createdAt,
    });
    byQuality[quality]++;
    if (c.endedReason) byEndedReason[c.endedReason] = (byEndedReason[c.endedReason] ?? 0) + 1;
  }

  return {
    totalFlagged: flagged.length,
    byQuality,
    byEndedReason,
    flaggedCalls: flagged,
  };
}
