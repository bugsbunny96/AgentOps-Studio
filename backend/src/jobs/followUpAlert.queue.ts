/**
 * Follow-Up Alert Queue
 *
 * Enqueued by the end-of-call webhook handler whenever structured output
 * indicates `followUpNeeded: true`. The worker sends an email notification
 * to the org owner so they can manually follow up with the caller.
 *
 * Queue: 'follow-up-alert'
 * Job name: 'send-follow-up-alert'
 *
 * Retry policy: 3 attempts, exponential backoff starting at 5 s.
 * Jobs are retained (100 completed, 50 failed) for observability.
 */

import { Queue } from 'bullmq';
import { getSharedQueueClient } from '../config/bullmq-connection';

// ─── Job Data ─────────────────────────────────────────────────────────────────

export interface FollowUpAlertJobData {
  /** Internal MongoDB call document _id (hex string). */
  callId: string;
  /** Vapi call ID (vapiCallId on the call doc). */
  vapiCallId: string;
  /** Organization MongoDB _id — used to look up the owner's email. */
  orgId: string;
  /** Free-text follow-up reason from structured output (may be null). */
  followUpReason: string | null;
  /** Caller's phone number (may be redacted). */
  callerNumber?: string;
  /** ISO timestamp of when the call ended. */
  callEndedAt: string;
  /** Short call summary for context in the email. */
  callSummary?: string | null;
}

export type FollowUpAlertJobName = 'send-follow-up-alert';

// ─── Queue ───────────────────────────────────────────────────────────────────

export const followUpAlertQueue = new Queue<FollowUpAlertJobData, void, FollowUpAlertJobName>(
  'follow-up-alert',
  {
    connection: getSharedQueueClient(),
    defaultJobOptions: {
      attempts:    3,
      backoff: {
        type:  'exponential',
        delay: 5_000, // 5 s initial
      },
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50  },
    },
  },
);

/**
 * Helper — enqueue a follow-up alert.
 * Called from the end-of-call webhook handler when followUpNeeded is true.
 */
export async function enqueueFollowUpAlert(data: FollowUpAlertJobData): Promise<void> {
  await followUpAlertQueue.add('send-follow-up-alert', data, {
    // Deduplicate alerts for the same Vapi call — if the webhook fires twice,
    // only one alert goes out.
    jobId: `follow-up-${data.vapiCallId}`,
  });
}
