/**
 * Churn Risk Queue — 19.6
 *
 * A single repeating job runs every day at 02:00 UTC to score all orgs.
 * The score is stored in ChurnRiskModel (30-day TTL).
 *
 * SA can also trigger an on-demand scan via POST /superadmin/churn-risk/scan.
 */

import { Queue } from 'bullmq';
import { getSharedQueueClient } from '../config/bullmq-connection';

export interface ChurnRiskJobData {
  /** undefined = score all orgs; present = score a single org on demand */
  orgId?: string;
}

export type ChurnRiskJobName = 'daily-churn-scan' | 'single-org-scan';

export const churnRiskQueue = new Queue<ChurnRiskJobData, void, ChurnRiskJobName>(
  'churn-risk',
  {
    connection: getSharedQueueClient(),
    defaultJobOptions: {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 10_000 },
      removeOnComplete: { count: 10 },
      removeOnFail:     { count: 50 },
    },
  },
);
