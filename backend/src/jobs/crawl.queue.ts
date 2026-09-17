import { Queue, type ConnectionOptions } from 'bullmq';
import { getSharedQueueClient } from '../config/bullmq-connection';

export interface CrawlJobData {
  orgId: string;
  websiteUrl: string;
}

export type CrawlJobName = 'crawl';

export const crawlQueue = new Queue<CrawlJobData, void, string>('website-crawl', {
  connection: getSharedQueueClient() as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
