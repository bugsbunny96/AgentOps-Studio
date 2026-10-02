/**
 * CORE-02 — background workers on one shared Redis client
 *
 * Measured against a real Redis with bullmq 5.79.1: 8 workers built from
 * options open 16 connections; built from one shared instance they open 9
 * (8 blocking + the shared one). These tests guard the wiring that gets us
 * there: every worker receives the SAME shared client, WORKERS_DISABLED is
 * honoured, and the three recurring jobs are scheduled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { workerOpts, schedulers, SHARED } = vi.hoisted(() => ({
  workerOpts: [] as Array<{ name: string; connection: unknown }>,
  schedulers: [] as string[],
  SHARED: { __shared: 'worker-client' },
}));

vi.mock('bullmq', () => {
  class Worker {
    constructor(name: string, _p: unknown, opts: { connection: unknown }) { workerOpts.push({ name, connection: opts.connection }); }
    on() { return this; }
    close() { return Promise.resolve(); }
  }
  class Queue {
    name: string;
    constructor(name: string) { this.name = name; }
    add() { return Promise.resolve({ id: '1' }); }
    upsertJobScheduler(id: string) { schedulers.push(id); return Promise.resolve(); }
    on() { return this; }
  }
  return { Worker, Queue, QueueEvents: class { on() { return this; } } };
});

vi.mock('@/config/bullmq-connection', () => ({
  getSharedWorkerClient: () => SHARED,
  getSharedQueueClient: () => ({}),
  closeSharedBullmqClients: () => Promise.resolve(),
  bullmqConnection: {},
}));

vi.mock('@/config/redis', () => ({ redis: { get: vi.fn(), setex: vi.fn(), del: vi.fn() } }));

import { startBackgroundWorkers, enabledWorkers, redisConnectionBudget, WORKER_NAMES } from '@/jobs/registry';

beforeEach(() => {
  workerOpts.length = 0;
  schedulers.length = 0;
});

describe('CORE-02 — worker registry', () => {
  it('starts all 8 workers, each on the same shared client', async () => {
    const workers = await startBackgroundWorkers('');
    expect(workers).toHaveLength(8);
    expect(workerOpts).toHaveLength(8);
    for (const w of workerOpts) expect(w.connection).toBe(SHARED);
    expect(new Set(workerOpts.map((w) => w.name)).size).toBe(8);
  });

  it('schedules the monthly reset, daily trial scan and daily churn scan', async () => {
    await startBackgroundWorkers('');
    expect(schedulers.sort()).toEqual(['daily-churn-scan', 'daily-trial-scan', 'monthly-minutes-reset']);
  });

  it('honours WORKERS_DISABLED (and skips their schedules)', async () => {
    const workers = await startBackgroundWorkers(' churnRisk, trialScan ,nonsense');
    expect(workers).toHaveLength(6);
    expect(schedulers).toEqual(['monthly-minutes-reset']);
  });

  it('enabledWorkers keeps callReport unless explicitly disabled', () => {
    expect(enabledWorkers('')).toEqual([...WORKER_NAMES]);
    expect(enabledWorkers('crawl')).not.toContain('crawl');
    expect(enabledWorkers('crawl')).toContain('callReport');
  });

  it('stays inside the free tier (30) even with two instances during a deploy', () => {
    expect(redisConnectionBudget(8)).toBe(11);
    expect(redisConnectionBudget(8) * 2).toBeLessThanOrEqual(30);
  });
});
