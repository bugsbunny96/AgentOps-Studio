import { Worker } from 'bullmq';
import { bullmqConnection } from '../config/bullmq-connection';
import { crawlWebsite } from '../modules/onboarding/crawler.service';
import { logger } from '../utils/logger';
import type { CrawlJobData, CrawlJobName } from './crawl.queue';

/**
 * Starts the BullMQ worker that processes website crawl jobs.
 * Called once during app bootstrap (index.ts).
 * Concurrency = 3: allows up to 3 crawls running in parallel.
 */
export function startCrawlWorker() {
  const worker = new Worker<CrawlJobData, void, CrawlJobName>(
    'website-crawl',
    async (job) => {
      const { orgId, websiteUrl } = job.data;
      logger.info('Crawl worker picked up job', { jobId: job.id, orgId, websiteUrl });
      await crawlWebsite(orgId, websiteUrl);
    },
    {
      connection: bullmqConnection,
      concurrency: 3,
    },
  );

  worker.on('completed', (job) => {
    logger.info('Crawl job completed', { jobId: job.id, orgId: job.data.orgId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Crawl job permanently failed', {
      jobId: job?.id,
      orgId: job?.data?.orgId,
      error: err.message,
    });
  });

  logger.info('✅  Crawl worker started (concurrency=3)');
  return worker;
}
