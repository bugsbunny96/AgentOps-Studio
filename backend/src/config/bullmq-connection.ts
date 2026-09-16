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

import Redis, { type RedisOptions } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { env } from './env';

// ── Worker connection options (each Worker must create its own IORedis client) ─

function parseRedisUrl(): RedisOptions {
  try {
    const url = new URL(env.REDIS_URL);
    const isTls = url.protocol === 'rediss:';
    const opts: RedisOptions = {
      host:            url.hostname || 'localhost',
      port:            url.port ? parseInt(url.port, 10) : 6379,
      connectTimeout:  10_000,
    };
    if (url.password) opts.password = decodeURIComponent(url.password);
    // Always set username — Redis Cloud ACL requires it even for 'default'
    if (url.username) opts.username = decodeURIComponent(url.username);
    const dbNum = parseInt(url.pathname?.replace('/', '') ?? '0', 10);
    if (!isNaN(dbNum) && dbNum > 0) opts.db = dbNum;
    // Enable TLS for rediss:// URLs (Redis Cloud TLS endpoint)
    if (isTls) opts.tls = {};
    return opts;
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

function parseWorkerOptions(): ConnectionOptions {
  const base = parseRedisUrl();
  return {
    ...base,
    maxRetriesPerRequest: null,   // required by BullMQ workers
    enableOfflineQueue:   false,  // don't queue commands during disconnects (prevents pile-up)
    keepAlive:            10_000, // send keepalive every 10s — prevents cloud Redis from closing idle connections
    retryStrategy(times: number): number | null {
      if (times > 10) return null; // stop after 10 retries
      return Math.min(times * 500, 5_000);
    },
  };
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
    const base = parseRedisUrl();
    const opts: RedisOptions = {
      ...base,
      maxRetriesPerRequest: 3,
      enableReadyCheck:     false,
      enableOfflineQueue:   true,
      lazyConnect:          true,
    };
    _sharedQueueClient = new Redis(opts);
  }
  return _sharedQueueClient;
}
