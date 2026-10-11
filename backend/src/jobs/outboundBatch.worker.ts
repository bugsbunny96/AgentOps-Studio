/**
 * Outbound Batch Worker — dials outbound call lists one number at a time.
 * Each job runs one step (processBatchStep) and schedules the next.
 */
import { Worker } from 'bullmq';
import { getSharedWorkerClient } from '../config/bullmq-connection';
import { logger } from '../utils/logger';
import { processBatchStep } from '../modules/calls/call-batch.service';
import { enqueueBatchStep, type OutboundBatchJobData, type OutboundBatchJobName } from './outboundBatch.queue';

export function startOutboundBatchWorker() {
  const worker = new Worker<OutboundBatchJobData, void, OutboundBatchJobName>(
    'outbound-batch',
    async (job) => {
      const next = await processBatchStep(job.data.batchId);
      if (next !== null) await enqueueBatchStep(job.data.batchId, next);
    },
    {
      connection:  getSharedWorkerClient(),   // CORE-02: 1 Redis connection per worker
      concurrency: 2,                         // different lists in parallel; one step per list at a time
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('[outboundBatch] Job failed', { jobId: job?.id, batchId: job?.data.batchId, error: err.message });
  });

  logger.info('✅  Outbound batch worker started');
  return worker;
}
