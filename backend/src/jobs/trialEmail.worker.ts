/**
 * Trial Email Worker
 *
 * Consumes jobs from the `trial-email` BullMQ queue.
 * Dispatches the appropriate Resend email based on job name.
 */

import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';
import { sendTrialDay5Email, sendTrialDay7Email } from '../utils/email';
import { logger } from '../utils/logger';
import type { TrialEmailJobData, TrialEmailJobName } from './trialEmail.queue';

export function startTrialEmailWorker() {
  const worker = new Worker<TrialEmailJobData, void, TrialEmailJobName>(
    'trial-email',
    async (job) => {
      const { orgId, orgName, ownerName, ownerEmail } = job.data;

      logger.info('Trial email worker: processing job', {
        jobName: job.name,
        orgId,
        ownerEmail,
      });

      if (job.name === 'send-trial-day5') {
        await sendTrialDay5Email(ownerEmail, ownerName, orgName);
        logger.info('Trial Day-5 reminder sent', { orgId, ownerEmail });
      } else if (job.name === 'send-trial-day7') {
        await sendTrialDay7Email(ownerEmail, ownerName, orgName);
        logger.info('Trial Day-7 expiry email sent', { orgId, ownerEmail });
      } else {
        logger.warn('Trial email worker: unknown job name', { jobName: job.name });
      }
    },
    {
      connection:  bullmqConnection,
      concurrency: 5,   // email sending is I/O-bound; allow parallelism
    },
  );

  worker.on('completed', (job) => {
    logger.info('Trial email job completed', { jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, err) => {
    logger.error('Trial email job failed', {
      jobId:   job?.id,
      name:    job?.name,
      attempt: job?.attemptsMade,
      error:   err.message,
    });
  });

  logger.info('✅  Trial email worker started');
  return worker;
}
