/**
 * BullMQ Connection Helpers
 *
 * Redis Cloud free tier caps at 30 concurrent connections.
 * BullMQ creates 2 connections per Worker (blocking + subscriber) and 1 per Queue.
 * With 8 workers + 8 queues + 1 main client = ~25 connections at baseline;
 * during Render redeploys (old + new instance overlap) this spikes above 30.
 *
 * Fix: all Queues share ONE IORedis instance (`sharedQueueClient`).
 *      Workers keep their own `ConnectionOptions` — blocking commands require
 *      a dedicated connection and `maxRetriesPerRequest: null`.
 *
 * Connection budget post-fix:
 *   1  shared queue client
 *   8  workers × 2 connections each = 16
 *   1  main app Redis client (config/redis.ts)
 *   ─────────────────────────────────────────
 *   18 total (well under the 30-connection limit)
 */

import Redis from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { env } from './env';

// ── Worker connection options (each Worker must create its own IORedis client) ─

function parseWorkerOptions(): ConnectionOptions {
  try {
    const url = new URL(env.REDIS_URL);
    const opts: ConnectionOptions = {
      host:                 url.hostname || 'localhost',
      port:                 url.port ? parseInt(url.port, 10) : 6379,
      maxRetriesPerRequest: null,   // required by BullMQ workers
      enableOfflineQueue:   false,  // don't queue commands during disconnects (prevents pile-up)
      connectTimeout:       10_000,
    };
    if (url.password) opts.password = decodeURIComponent(url.password);
    if (url.username && url.username !== 'default') opts.username = decodeURIComponent(url.username);
    const dbNum = parseInt(url.pathname?.replace('/', '') ?? '0', 10);
    if (!isNaN(dbNum) && dbNum > 0) (opts as Record<string, unknown>).db = dbNum;
    return opts;
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

/** Pass to every Worker constructor — each Worker creates its own IORedis from these options. */
export const bullmqConnection: ConnectionOptions = parseWorkerOptions();

// ── Shared Queue client (all Queues reuse the same IORedis connection) ──────────

let _sharedQueueClient: Redis | null = null;

/**
 * Returns a singleton IORedis instance shared by ALL Queue constructors.
 * Queues use only non-blocking Redis commands, so one connection is sufficient.
 * Call this lazily (inside the module that creates the Queue) so env vars are ready.
 */
export function getSharedQueueClient(): Redis {
  if (!_sharedQueueClient) {
    try {
      const url   = new URL(env.REDIS_URL);
      const opts: ConstructorParameters<typeof Redis>[0] = {
        host:                url.hostname || 'localhost',
        port:                url.port ? parseInt(url.port, 10) : 6379,
        maxRetriesPerRequest: 3,
        enableReadyCheck:    false,
        enableOfflineQueue:  true,
        connectTimeout:      10_000,
        lazyConnect:         true,
      };
      if (url.password) (opts as Record<string, unknown>).password = decodeURIComponent(url.password);
      if (url.username && url.username !== 'default') {
        (opts as Record<string, unknown>).username = decodeURIComponent(url.username);
      }
      _sharedQueueClient = new Redis(opts as never);
    } catch {
      _sharedQueueClient = new Redis({ host: 'localhost', port: 6379 });
    }
  }
  return _sharedQueueClient;
}
