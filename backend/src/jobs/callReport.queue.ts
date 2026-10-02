/**
 * Call Report Queue
 *
 * Processes Vapi end-of-call-report webhook events asynchronously.
 * The webhook controller pushes a job here and returns 200 immediately —
 * so Vapi never times out waiting for transcript/summary DB writes.
 *
 * Retry policy: 3 attempts, exponential backoff starting at 5 s.
 * Jobs are retained (200 completed, 100 failed) for observability.
 */

import { Queue, type ConnectionOptions } from 'bullmq';
import { getSharedQueueClient } from '../config/bullmq-connection';
// Type-only imports are erased at build time, so they add no runtime cycle.
import type { VapiEndOfCallReportEvent } from '../modules/calls/webhook.service';

// Mirrors the relevant fields of VapiEndOfCallReportEvent without
// creating a cross-package import (avoids circular dep through webhook.service).
export interface CallReportJobData {
  vapiCallId:     string;
  assistantId:    string;
  callType:       string;
  callerNumber?:  string;
  endedReason?:   string;
  durationSeconds?: number;
  recordingUrl?:  string;
  transcript?:    string;
  messages?: Array<{
    role:      'assistant' | 'user' | 'system' | 'tool';
    content?:  string;
    message?:  string;
    time?:     number;
  }>;
  summary?: string;
  cost?:    number;
  /** Cost Vapi reported on the call object (older payloads) — CORE-01 */
  callCost?:      number;
  /** Per-component cost breakdown — CORE-01 (was dropped before the worker) */
  costBreakdown?: VapiEndOfCallReportEvent['costBreakdown'];
  /** Recording URL + structured output (intent, order, follow-up) — CORE-01 */
  artifact?:      VapiEndOfCallReportEvent['artifact'];
}

export type CallReportJobName = 'process-end-of-call';

export const callReportQueue = new Queue<CallReportJobData, void, string>(
  'call-report',
  {
    connection: getSharedQueueClient() as unknown as ConnectionOptions,
    defaultJobOptions: {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 200 },
      removeOnFail:     { count: 100 },
    },
  },
);
