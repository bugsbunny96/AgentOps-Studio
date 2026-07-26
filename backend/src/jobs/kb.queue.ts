/**
 * KB Ingestion Queue
 *
 * Processes newly created KbDocuments.
 * MVP: worker simply sets status = 'ready' (no embedding).
 * Future: worker will chunk + embed + store vectors in MongoDB Atlas.
 */

import { Queue } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';

export interface KbIngestJobData {
  docId:  string;
  orgId:  string;
}

export type KbIngestJobName = 'ingest';

export const kbQueue = new Queue<KbIngestJobData, void, KbIngestJobName>('kb-ingest', {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts:          3,
    backoff:           { type: 'exponential', delay: 3_000 },
    removeOnComplete:  { count: 200 },
    removeOnFail:      { count: 100 },
  },
});
