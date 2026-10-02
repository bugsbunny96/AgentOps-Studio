import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { startBackgroundWorkers, stopBackgroundWorkers } from './jobs/registry';
import { closeSharedBullmqClients } from './config/bullmq-connection';
import type { Worker } from 'bullmq';
import { startKeepAlive, stopKeepAlive } from './utils/keepAlive';
import http from 'http';

let server: http.Server;
let workers: Worker[] = [];

async function bootstrap(): Promise<void> {
  logger.info('🚀  Starting AgentOps Studio Backend...');
  logger.info(`   Environment: ${env.NODE_ENV}`);

  // 1. Connect MongoDB
  await connectDatabase();

  // 2. Verify Redis
  await redis.ping();
  logger.info('✅  Redis ping OK');

  // 3. Start background workers (CORE-02: all 8 on one shared Redis client;
  //    turn any off with WORKERS_DISABLED) + recurring schedules
  workers = await startBackgroundWorkers(env.WORKERS_DISABLED);

  // 4. Start HTTP server
  server = app.listen(env.PORT, () => {
    logger.info(`✅  HTTP server listening on port ${env.PORT}`);
    logger.info(`   Health: http://localhost:${env.PORT}/health`);
    logger.info(`   API:    http://localhost:${env.PORT}/api/v1`);
    startKeepAlive();
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully...`);

  stopKeepAlive();

  // 1. Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      // 2. Stop workers (finish in-flight jobs), then close Redis
      await stopBackgroundWorkers(workers);
      await closeSharedBullmqClients();
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
