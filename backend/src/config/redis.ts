import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times: number): number | null {
    if (times > 5) {
      logger.error('Redis: max retries reached');
      return null;
    }
    const delay = Math.min(times * 1000, 5000);
    logger.warn(`Redis: retrying in ${delay}ms (attempt ${times})`);
    return delay;
  },
});

redis.on('connect', () => logger.info('✅  Redis connected'));
redis.on('ready', () => logger.debug('Redis ready'));
redis.on('error', (err: Error) => logger.error('Redis error:', { message: err.message }));
redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));
redis.on('close', () => logger.warn('Redis connection closed'));
