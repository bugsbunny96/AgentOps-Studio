import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

/**
 * One-time index migrations — run after every connect.
 * Each migration is idempotent: silently no-ops if the target no longer exists.
 */
async function runMigrations(): Promise<void> {
  // Migration M001 — drop the legacy unique-sourceUrl index on kbdocuments.
  // It was replaced by the urlHash sparse-unique index in crawler v3.
  // Without this drop, re-syncing sites causes E11000 on sourceUrl: null
  // whenever more than one KB doc has no sourceUrl (website_crawl categories,
  // faq_import docs, etc.).
  try {
    await mongoose.connection.collection('kbdocuments')
      .dropIndex('organizationId_1_sourceUrl_1');
    logger.info('DB migration M001: dropped stale kbdocuments sourceUrl unique index');
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 27) {
      // code 27 = IndexNotFound — already dropped or never existed; both fine.
      logger.warn('DB migration M001: unexpected error dropping sourceUrl index', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Migration M002 — drop the sparse urlHash index and let Mongoose recreate
  // it with partialFilterExpression { urlHash: { $type: 'string' } }.
  //
  // Root cause: MongoDB compound sparse indexes include a document when ANY
  // indexed field is non-null.  Because organizationId is always present,
  // website_crawl / faq_import docs (which have no urlHash) are included in
  // the index, causing E11000 on { organizationId, urlHash: null } when more
  // than one such doc exists per org.
  //
  // The partial-filter definition in kb.model.ts fixes this permanently —
  // but first we must drop the old sparse version so Mongoose can rebuild it.
  try {
    await mongoose.connection.collection('kbdocuments')
      .dropIndex('organizationId_1_urlHash_1');
    logger.info('DB migration M002: dropped sparse urlHash index (partial-filter rebuild pending)');
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 27) {
      logger.warn('DB migration M002: unexpected error dropping urlHash index', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function connectDatabase(retries = MAX_RETRIES): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: 'agentops_studio',
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    logger.info('✅  MongoDB Atlas connected');
    await runMigrations();

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected — attempting to reconnect...');
    });

    mongoose.connection.on('error', (err: Error) => {
      logger.error('MongoDB connection error:', { message: err.message });
    });
  } catch (err) {
    if (retries > 0) {
      logger.warn(
        `MongoDB connection failed — retrying in ${RETRY_DELAY_MS / 1000}s ` +
          `(${retries} attempt${retries > 1 ? 's' : ''} left)`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDatabase(retries - 1);
    }
    logger.error('❌  MongoDB: max retries reached. Exiting.');
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected cleanly');
}
