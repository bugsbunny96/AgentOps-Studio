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
 * Connection budget (CORE-02, see getSharedWorkerClient below):
 *   1  shared queue client
 *   1  shared worker client
 *   8  workers × 1 blocking connection = 8
 *   1  main app Redis client (config/redis.ts)
 *   ─────────────────────────────────────────
 *   11 per instance (~22 while Render overlaps two instances on deploy)
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

/**
 * Plain worker options (each Worker would open 2 connections from these).
 * Workers now use getSharedWorkerClient() instead — kept for scripts/tests.
 */
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

// ── Shared Worker client (CORE-02) ──────────────────────────────────────────────
//
// BullMQ 5: a Worker given an IORedis *instance* reuses it for normal commands
// and duplicates it once for its blocking connection (Worker constructor:
// `opts.connection.duplicate()`). Given plain options it opens two. So with one
// shared instance each Worker costs 1 connection instead of 2:
//
//   8 workers × 1 blocking + 1 shared worker client + 1 shared queue client
//   + 1 app client (config/redis.ts) = 11 per instance, ~22 during a Render
//   redeploy overlap — inside the Redis Cloud free tier's 30.

let _sharedWorkerClient: Redis | null = null;

/**
 * Typed as ConnectionOptions because BullMQ bundles its own ioredis copy; the
 * instance is detected at runtime by duck-typing (same cast the queues use).
 */
export function getSharedWorkerClient(): ConnectionOptions {
  if (!_sharedWorkerClient) {
    _sharedWorkerClient = new Redis({ ...(parseWorkerOptions() as RedisOptions), connectionName: 'aos:workers' });
  }
  return _sharedWorkerClient as unknown as ConnectionOptions;
}

/** Quit the shared clients (call after all Workers are closed). */
export async function closeSharedBullmqClients(): Promise<void> {
  await Promise.allSettled([
    _sharedWorkerClient?.quit(),
    _sharedQueueClient?.quit(),
  ]);
  _sharedWorkerClient = null;
  _sharedQueueClient = null;
}
