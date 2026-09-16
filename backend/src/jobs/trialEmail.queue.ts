/**
 * Trial Email Queue
 *
 * Sends Day-5 and Day-7 trial reminder emails.
 * Jobs are enqueued by trial.service.ts which runs daily via a BullMQ scheduler.
 *
 * Job names:
 *   'send-trial-day5'  — 2 days remain on trial
 *   'send-trial-day7'  — trial expires today
 */

import { Queue } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';

export interface TrialEmailJobData {
  orgId:    string;
  orgName:  string;
  /** Owner's name for the email greeting */
  ownerName: string;
  /** Owner's email address */
  ownerEmail: string;
}

export type TrialEmailJobName = 'send-trial-day5' | 'send-trial-day7';

export const trialEmailQueue = new Queue<TrialEmailJobData, void, TrialEmailJobName>(
  'trial-email',
  {
    connection: bullmqConnection,
    defaultJobOptions: {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 50 },
      removeOnFail:     { count: 100 },
    },
  },
);
