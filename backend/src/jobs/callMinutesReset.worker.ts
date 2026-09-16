/**
 * Call Minutes Reset Worker
 *
 * Consumes jobs from the `call-minutes-reset` BullMQ queue.
 * On each job run, it bulk-resets every organization's monthly call counter:
 *
 *   callMinutesUsed    → 0
 *   callMinutesResetAt → start of the current UTC month
 *
 * This job runs once per month (cron: '0 0 1 * *'), scheduled by index.ts
 * via upsertJobScheduler.
 *
 * The end-of-call-report handler in webhook.service.ts also performs a
 * self-healing per-org reset using a MongoDB aggregation-pipeline update,
 * so the system stays correct even if this monthly job is missed.
 */

import { Worker } from 'bullmq';
import { bullmqConnection }  from '../config/bullmq-connection';
import { OrganizationModel } from '../modules/organization/organization.model';
import { logger }            from '../utils/logger';
import type { CallMinutesResetJobData, CallMinutesResetJobName } from './callMinutesReset.queue';

export function startCallMinutesResetWorker() {
  const worker = new Worker<CallMinutesResetJobData, void, CallMinutesResetJobName>(
    'call-minutes-reset',
    async () => {
      const now         = new Date();
      const monthStart  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      logger.info('Call minutes reset worker: starting monthly reset', {
        monthStart: monthStart.toISOString(),
      });

      const result = await OrganizationModel.updateMany(
        {},
        {
          $set: {
            callMinutesUsed:    0,
            callMinutesResetAt: monthStart,
          },
        },
      );

      logger.info('Call minutes reset worker: monthly reset complete', {
        matched:  result.matchedCount,
        modified: result.modifiedCount,
        month:    monthStart.toISOString().slice(0, 7), // e.g. "2026-07"
      });
    },
    {
      connection:  bullmqConnection,
      concurrency: 1, // one job at a time — updateMany is already a bulk op
    },
  );

  worker.on('completed', (job) => {
    logger.info('Call minutes reset job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Call minutes reset job failed', {
      jobId:   job?.id,
      attempt: job?.attemptsMade,
      error:   err.message,
    });
  });

  logger.info('✅  Call minutes reset worker started');
  return worker;
}
