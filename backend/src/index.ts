import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
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

  // 3. Start HTTP server
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
