/**
 * Outbound Batch Queue — one job = dial the next number of a CallBatch.
 * The worker re-enqueues itself (with a delay) until the list is done.
 *
 * Queue: 'outbound-batch' · Job name: 'dial-next'
 */
import { Queue, type ConnectionOptions } from 'bullmq';
import { getSharedQueueClient } from '../config/bullmq-connection';

export interface OutboundBatchJobData { batchId: string }
export type OutboundBatchJobName = 'dial-next';

export const outboundBatchQueue = new Queue<OutboundBatchJobData, void, string>('outbound-batch', {
  connection: getSharedQueueClient() as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts:         2,
    backoff:          { type: 'fixed', delay: 15_000 },
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 100 },
  },
});

export async function enqueueBatchStep(batchId: string, delayMs = 0): Promise<void> {
  await outboundBatchQueue.add('dial-next', { batchId }, {
    delay: Math.max(0, Math.round(delayMs)),
    jobId: `batch-${batchId}-${Date.now()}`,
  });
}
