/**
 * KB Ingestion Worker
 *
 * Consumes jobs from the 'kb-ingest' BullMQ queue.
 *
 * MVP behaviour:
 *   - Find the KbDocument by docId
 *   - Compute a rough token estimate (content.length / 4)
 *   - Set status = 'ready'
 *
 * Future v2 (when vector search is added):
 *   - Chunk content into ~300-token segments
 *   - Embed each chunk via OpenAI text-embedding-3-small
 *   - Store vectors in MongoDB Atlas Vector Search
 */

import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';
import { KbDocumentModel } from '../modules/knowledge-base/kb.model';
import { syncKbToVapi } from '../modules/knowledge-base/kb.service';
import { logger } from '../utils/logger';
import type { KbIngestJobData, KbIngestJobName } from './kb.queue';

export function startKbWorker() {
  const worker = new Worker<KbIngestJobData, void, KbIngestJobName>(
    'kb-ingest',
    async (job) => {
      const { docId, orgId } = job.data;
      logger.info('KB ingest worker picked up job', { jobId: job.id, docId, orgId });

      const doc = await KbDocumentModel.findById(docId);
      if (!doc) {
        logger.warn('KB doc not found — may have been deleted', { docId });
        return;
      }

      // Rough token estimate (1 token ≈ 4 chars for English text)
      const tokenEstimate = Math.ceil(doc.content.length / 4);

      await KbDocumentModel.findByIdAndUpdate(docId, {
        $set: {
          status:        'ready',
          tokenEstimate,
          errorMessage:  undefined,
        },
      });

      logger.info('KB doc ingested successfully', {
        docId,
        orgId,
        tokens: tokenEstimate,
        sourceType: doc.sourceType,
      });

      // DRIFT-1 fix: push updated KB context to Vapi after every successful ingestion.
      // Without this, manual and uploaded docs are stored in MongoDB but never reach
      // the Vapi assistant's system prompt.
      // Fire-and-forget — non-fatal; KB is already 'ready' in DB regardless.
      syncKbToVapi(orgId).catch((err) => {
        logger.error('syncKbToVapi after ingest failed', {
          docId,
          orgId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    },
    {
      connection:  bullmqConnection,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    logger.info('KB ingest job completed', { jobId: job.id, docId: job.data.docId });
  });

  worker.on('failed', async (job, err) => {
    logger.error('KB ingest job failed', {
      jobId:  job?.id,
      docId:  job?.data?.docId,
      error:  err.message,
    });
    // Mark doc as failed so the UI can surface the error
    if (job?.data?.docId) {
      await KbDocumentModel.findByIdAndUpdate(job.data.docId, {
        $set: { status: 'failed', errorMessage: err.message.slice(0, 200) },
      }).catch(() => { /* swallow — doc may not exist */ });
    }
  });

  logger.info('✅  KB ingest worker started (concurrency=5)');
  return worker;
}
