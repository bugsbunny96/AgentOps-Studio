/**
 * Trial Scan Worker
 *
 * Consumes the daily trial-scan job.
 * Calls scanAndEnqueueTrialEmails() which identifies orgs nearing trial expiry
 * and adds individual email jobs to the trial-email queue.
 */

import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';
import { scanAndEnqueueTrialEmails } from '../modules/billing/trial.service';
import { logger } from '../utils/logger';
import type { TrialScanJobName } from './trialScan.queue';

export function startTrialScanWorker() {
  const worker = new Worker<Record<string, never>, void, TrialScanJobName>(
    'trial-scan',
    async (_job) => {
      logger.info('Trial scan worker: daily scan starting');
      const result = await scanAndEnqueueTrialEmails();
      logger.info('Trial scan worker: daily scan complete', result);
    },
    {
      connection:  bullmqConnection,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    logger.info('Trial scan job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Trial scan job failed', {
      jobId:   job?.id,
      attempt: job?.attemptsMade,
      error:   err.message,
    });
  });

  logger.info('✅  Trial scan worker started');
  return worker;
}
