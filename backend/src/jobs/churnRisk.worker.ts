/**
 * Churn Risk Worker — 19.6
 *
 * Consumes jobs from the `churn-risk` BullMQ queue.
 * Runs the full org scan daily (02:00 UTC via scheduler) or
 * a single-org scan on demand.
 *
 * Bootstrapped in index.ts alongside other workers.
 */

import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';
import { scoreAllOrgsChurnRisk, scoreOrgChurnRisk } from '../modules/superadmin/churn-risk.service';
import { logger } from '../utils/logger';
import type { ChurnRiskJobData, ChurnRiskJobName } from './churnRisk.queue';

export function startChurnRiskWorker() {
  const worker = new Worker<ChurnRiskJobData, void, ChurnRiskJobName>(
    'churn-risk',
    async (job) => {
      if (job.name === 'single-org-scan') {
        if (!job.data.orgId) throw new Error('single-org-scan requires orgId');
        logger.info('Churn risk worker: scoring single org', { orgId: job.data.orgId });
        const result = await scoreOrgChurnRisk(job.data.orgId);
        logger.info('Churn risk scored', { orgId: job.data.orgId, score: result.score, tier: result.tier });
      } else {
        // daily-churn-scan — score everything
        logger.info('Churn risk worker: daily scan starting');
        const { scored, errors } = await scoreAllOrgsChurnRisk();
        logger.info('Churn risk daily scan complete', { scored, errors });
      }
    },
    {
      connection:  bullmqConnection,
      concurrency: 1,  // sequential — avoids DB hammering
    },
  );

  worker.on('completed', (job) => {
    logger.info('Churn risk job completed', { jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, err) => {
    logger.error('Churn risk job failed', {
      jobId:   job?.id,
      name:    job?.name,
      attempt: job?.attemptsMade,
      error:   err.message,
    });
  });

  logger.info('✅  Churn risk worker started');
  return worker;
}
