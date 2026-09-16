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

import { Queue } from 'bullmq';
import { getSharedQueueClient } from '../config/bullmq-connection';

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
}

export type CallReportJobName = 'process-end-of-call';

export const callReportQueue = new Queue<CallReportJobData, void, CallReportJobName>(
  'call-report',
  {
    connection: getSharedQueueClient(),
    defaultJobOptions: {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 200 },
      removeOnFail:     { count: 100 },
    },
  },
);
