import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export async function connectDatabase(retries = MAX_RETRIES): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: 'agentops_studio',
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    logger.info('✅  MongoDB Atlas connected');

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
