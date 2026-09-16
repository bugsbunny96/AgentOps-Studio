import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { startCallReportWorker } from './jobs/callReport.worker';
// ── Workers disabled for POC to stay inside Redis Cloud free-tier connection limit ──
// Redis Cloud free tier: 30 max connections.
// Each BullMQ Worker uses 3 Redis connections (blocking + non-blocking + subscriber).
// 8 workers × 3 = 24, plus shared queue client + main Redis = 26 — leaves no headroom
// for Render instance overlap during redeploys, causing "ERR max number of clients".
//
// Active:   callReport (3 conns) + shared queue (1) + main (1) = 5 total ✅
// Disabled: crawl, kb, churnRisk, trialEmail, trialScan, callMinutesReset, followUpAlert
//           Re-enable each when you upgrade Redis Cloud or move to a paid Render plan.
//
// import { startCrawlWorker }            from './jobs/crawl.worker';
// import { startKbWorker }               from './jobs/kb.worker';
// import { startChurnRiskWorker }        from './jobs/churnRisk.worker';
// import { churnRiskQueue }              from './jobs/churnRisk.queue';
// import { startTrialEmailWorker }       from './jobs/trialEmail.worker';
// import { startTrialScanWorker }        from './jobs/trialScan.worker';
// import { trialScanQueue }              from './jobs/trialScan.queue';
// import { startCallMinutesResetWorker } from './jobs/callMinutesReset.worker';
// import { callMinutesResetQueue }       from './jobs/callMinutesReset.queue';
// import { startFollowUpAlertWorker }    from './jobs/followUpAlert.worker';
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

  // 3. Start background workers (POC: callReport only — see import block above)
  startCallReportWorker();
  // startCrawlWorker();
  // startKbWorker();
  // startChurnRiskWorker();
  // startTrialEmailWorker();
  // startTrialScanWorker();
  // startCallMinutesResetWorker();
  // startFollowUpAlertWorker();

  // 4. Schedule recurring background jobs — disabled for POC alongside their workers
  // await churnRiskQueue.upsertJobScheduler('daily-churn-scan', { pattern: '0 2 * * *' }, { name: 'daily-churn-scan', data: {} });
  // await trialScanQueue.upsertJobScheduler('daily-trial-scan', { pattern: '0 6 * * *' }, { name: 'daily-trial-scan', data: {} });
  // await callMinutesResetQueue.upsertJobScheduler('monthly-minutes-reset', { pattern: '0 0 1 * *' }, { name: 'monthly-minutes-reset', data: {} });

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
