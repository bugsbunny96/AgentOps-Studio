/**
 * BullMQ Connection Options
 *
 * BullMQ bundles its own ioredis version (different from the app's top-level ioredis),
 * so passing the shared `redis` instance causes a TypeScript class-identity mismatch.
 *
 * Solution: parse REDIS_URL into plain connection options and let BullMQ
 * create its own internal ioredis client.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ workers.
 */

import type { ConnectionOptions } from 'bullmq';
import { env } from './env';

function parseConnectionOptions(): ConnectionOptions {
  try {
    const url = new URL(env.REDIS_URL);
    const opts: ConnectionOptions = {
      host: url.hostname || 'localhost',
      port: url.port ? parseInt(url.port, 10) : 6379,
      maxRetriesPerRequest: null,   // required by BullMQ
    };
    if (url.password) opts.password = decodeURIComponent(url.password);
    if (url.username && url.username !== 'default') opts.username = decodeURIComponent(url.username);
    const dbNum = parseInt(url.pathname?.replace('/', '') ?? '0', 10);
    if (!isNaN(dbNum) && dbNum > 0) (opts as Record<string, unknown>).db = dbNum;
    return opts;
  } catch {
    // Fallback for non-URL formats (plain "host:port")
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

export const bullmqConnection: ConnectionOptions = parseConnectionOptions();
