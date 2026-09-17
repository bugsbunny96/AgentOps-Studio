/**
 * Call Report Worker
 *
 * Consumes jobs from the `call-report` BullMQ queue.
 * Each job contains the full end-of-call-report payload from Vapi.
 * The worker reconstructs the VapiEndOfCallReportEvent shape and
 * delegates to handleEndOfCallReport() — the same function that was
 * previously called inline in the webhook fire-and-forget path.
 *
 * Benefits over inline processing:
 *   - Automatic retry with exponential backoff on DB / OpenAI timeouts
 *   - Jobs persist in Redis — survives a process restart mid-call
 *   - Concurrency controlled independently of HTTP worker pool
 *   - Dead-letter visibility in BullMQ dashboard
 *
 * Started once during app bootstrap (see index.ts).
 */

import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';
import { handleEndOfCallReport } from '../modules/calls/webhook.service';
import { logger } from '../utils/logger';
import type { CallReportJobData, CallReportJobName } from './callReport.queue';
import type { VapiEndOfCallReportEvent } from '../modules/calls/webhook.service';

export function startCallReportWorker() {
  const worker = new Worker<CallReportJobData, void, CallReportJobName>(
    'call-report',
    async (job) => {
      const data = job.data;
      logger.info('Call report worker processing job', {
        jobId:      job.id,
        vapiCallId: data.vapiCallId,
        assistantId: data.assistantId,
      });

      // Reconstruct the VapiEndOfCallReportEvent shape from flat job data
      const event: VapiEndOfCallReportEvent = {
        type: 'end-of-call-report',
        call: {
          id:           data.vapiCallId,
          assistantId:  data.assistantId,
          type:         data.callType as VapiEndOfCallReportEvent['call']['type'],
          customer:     data.callerNumber ? { number: data.callerNumber } : undefined,
          endedReason:  data.endedReason,
        },
        durationSeconds: data.durationSeconds,
        recordingUrl:    data.recordingUrl,
        transcript:      data.transcript,
        messages:        data.messages as VapiEndOfCallReportEvent['messages'],
        summary:         data.summary,
        cost:            data.cost,
      };

      await handleEndOfCallReport(event);
    },
    {
      connection:  bullmqConnection,
      concurrency: 5,   // process up to 5 call reports in parallel
    },
  );

  worker.on('completed', (job) => {
    logger.info('Call report job completed', {
      jobId:      job.id,
      vapiCallId: job.data.vapiCallId,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Call report job failed', {
      jobId:       job?.id,
      vapiCallId:  job?.data?.vapiCallId,
      attempt:     job?.attemptsMade,
      error:       err.message,
    });
  });

  logger.info('✅  Call report worker started (concurrency=5)');
  return worker;
}
