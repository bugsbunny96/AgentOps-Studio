import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { startCrawlWorker }      from './jobs/crawl.worker';
import { startKbWorker }         from './jobs/kb.worker';
import { startCallReportWorker } from './jobs/callReport.worker';
import { startChurnRiskWorker }  from './jobs/churnRisk.worker';
import { churnRiskQueue }        from './jobs/churnRisk.queue';
import { startTrialEmailWorker }       from './jobs/trialEmail.worker';
import { startTrialScanWorker }        from './jobs/trialScan.worker';
import { trialScanQueue }              from './jobs/trialScan.queue';
import { startCallMinutesResetWorker } from './jobs/callMinutesReset.worker';
import { callMinutesResetQueue }       from './jobs/callMinutesReset.queue';
import { startFollowUpAlertWorker }    from './jobs/followUpAlert.worker';
import http from 'http';

let server: http.Server;

async function bootstrap(): Promise<void> {
  logger.info('🚀  Starting AgentOps Studio Backend...');
  logger.info(`   Environment: ${env.NODE_ENV}`);

  // 1. Connect MongoDB
  await connectDatabase();

  // 2. Verify Redis
  await redis.ping();
  logger.info('✅  Redis ping OK');

  // 3. Start background workers
  startCrawlWorker();
  startKbWorker();
  startCallReportWorker();
  startChurnRiskWorker();
  startTrialEmailWorker();
  startTrialScanWorker();
  startCallMinutesResetWorker();
  startFollowUpAlertWorker();

  // 4. Schedule recurring background jobs (idempotent — BullMQ skips if already scheduled)
  await churnRiskQueue.upsertJobScheduler(
    'daily-churn-scan',          // scheduler key = job name in ChurnRiskJobName union
    { pattern: '0 2 * * *' },    // cron: 02:00 UTC every day
    { name: 'daily-churn-scan', data: {} },
  );

  // Trial email scan at 06:00 UTC daily — finds orgs at Day-5 / Day-7 and enqueues reminder emails
  await trialScanQueue.upsertJobScheduler(
    'daily-trial-scan',
    { pattern: '0 6 * * *' },    // cron: 06:00 UTC every day
    { name: 'daily-trial-scan', data: {} },
  );

  // Monthly call minutes reset — 00:00 UTC on the 1st of every month
  // Resets callMinutesUsed=0 on all orgs so the new billing month starts fresh.
  // The end-of-call-report handler also performs a per-org self-healing reset
  // (aggregation-pipeline update) so accuracy is maintained even if this job fires late.
  await callMinutesResetQueue.upsertJobScheduler(
    'monthly-minutes-reset',
    { pattern: '0 0 1 * *' },    // cron: 00:00 UTC on the 1st of every month
    { name: 'monthly-minutes-reset', data: {} },
  );

  // 4. Start HTTP server
  server = app.listen(env.PORT, () => {
    logger.info(`✅  HTTP server listening on port ${env.PORT}`);
    logger.info(`   Health: http://localhost:${env.PORT}/health`);
    logger.info(`   API:    http://localhost:${env.PORT}/api/v1`);
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully...`);

  // 1. Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      // 2. Close Redis
      await redis.quit();
      logger.info('Redis connection closed');

      // 3. Close MongoDB
      await disconnectDatabase();

      logger.info('Shutdown complete. Goodbye. 👋');
      process.exit(0);
    });
  }

  // Force exit after 30s if shutdown stalls
  setTimeout(() => {
    logger.error('Forced exit after 30s shutdown timeout');
    process.exit(1);
  }, 30_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap().catch((err: Error) => {
  logger.error('Failed to start server', { message: err.message, stack: err.stack });
  process.exit(1);
});
