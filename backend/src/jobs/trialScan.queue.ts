/**
 * Trial Scan Queue
 *
 * A single repeating job fires every day at 06:00 UTC.
 * The worker calls scanAndEnqueueTrialEmails() which finds orgs nearing
 * trial expiry and adds Day-5 / Day-7 jobs to the trial-email queue.
 */

import { Queue } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';

export type TrialScanJobName = 'daily-trial-scan';

export const trialScanQueue = new Queue<Record<string, never>, void, TrialScanJobName>(
  'trial-scan',
  {
    connection: bullmqConnection,
    defaultJobOptions: {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 60_000 },
      removeOnComplete: { count: 7 },
      removeOnFail:     { count: 30 },
    },
  },
);
