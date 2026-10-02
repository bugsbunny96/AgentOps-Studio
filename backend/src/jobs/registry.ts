/**
 * Background worker registry (CORE-02)
 *
 * One place that starts every BullMQ worker and schedules the recurring jobs.
 * All workers share one Redis client (config/bullmq-connection.ts), so the
 * whole set costs ~11 Redis connections — inside the free tier.
 *
 * Turn individual workers off without a deploy via WORKERS_DISABLED.
 */
import type { Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { startCallReportWorker } from './callReport.worker';
import { startCrawlWorker } from './crawl.worker';
import { startKbWorker } from './kb.worker';
import { startFollowUpAlertWorker } from './followUpAlert.worker';
import { startCallMinutesResetWorker } from './callMinutesReset.worker';
import { startTrialEmailWorker } from './trialEmail.worker';
import { startTrialScanWorker } from './trialScan.worker';
import { startChurnRiskWorker } from './churnRisk.worker';
import { callMinutesResetQueue } from './callMinutesReset.queue';
import { trialScanQueue } from './trialScan.queue';
import { churnRiskQueue } from './churnRisk.queue';

export const WORKER_NAMES = [
  'callReport',        // end-of-call reports (must always run)
  'crawl',             // website crawl → KB
  'kb',                // KB doc ingest → Vapi sync
  'followUpAlert',     // follow-up emails to the owner
  'callMinutesReset',  // monthly minutes reset (1st, 00:00 UTC)
  'trialEmail',        // trial day-5 / day-7 emails
  'trialScan',         // daily trial scan (06:00 UTC)
  'churnRisk',         // daily churn scan (02:00 UTC)
] as const;
export type WorkerName = (typeof WORKER_NAMES)[number];

const STARTERS: Record<WorkerName, () => Worker> = {
  callReport:       startCallReportWorker as () => Worker,
  crawl:            startCrawlWorker as () => Worker,
  kb:               startKbWorker as () => Worker,
  followUpAlert:    startFollowUpAlertWorker as () => Worker,
  callMinutesReset: startCallMinutesResetWorker as () => Worker,
  trialEmail:       startTrialEmailWorker as () => Worker,
  trialScan:        startTrialScanWorker as () => Worker,
  churnRisk:        startChurnRiskWorker as () => Worker,
};

/** Which workers to start, given WORKERS_DISABLED ("a,b"). Unknown names are ignored. */
export function enabledWorkers(disabledCsv: string): WorkerName[] {
  const off = new Set(disabledCsv.split(',').map((s) => s.trim()).filter(Boolean));
  return WORKER_NAMES.filter((n) => !off.has(n));
}

/** Redis connections this instance will hold: app + queue client + worker client + 1 per worker. */
export function redisConnectionBudget(workerCount: number): number {
  return 3 + workerCount;
}

export async function startBackgroundWorkers(disabledCsv: string): Promise<Worker[]> {
  const names = enabledWorkers(disabledCsv);
  const workers = names.map((n) => STARTERS[n]());

  // Recurring jobs — upsert is idempotent across restarts/instances
  const schedules: Array<[WorkerName, () => Promise<unknown>]> = [
    ['callMinutesReset', () => callMinutesResetQueue.upsertJobScheduler('monthly-minutes-reset', { pattern: '0 0 1 * *' }, { name: 'monthly-minutes-reset', data: {} })],
    ['trialScan',        () => trialScanQueue.upsertJobScheduler('daily-trial-scan', { pattern: '0 6 * * *' }, { name: 'daily-trial-scan', data: {} })],
    ['churnRisk',        () => churnRiskQueue.upsertJobScheduler('daily-churn-scan', { pattern: '0 2 * * *' }, { name: 'daily-churn-scan', data: {} })],
  ];
  for (const [name, schedule] of schedules) {
    if (!names.includes(name)) continue;
    try {
      await schedule();
    } catch (err) {
      logger.error(`Failed to schedule ${name}`, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  logger.info(`✅  ${workers.length}/${WORKER_NAMES.length} background workers started`, {
    workers: names,
    disabled: WORKER_NAMES.filter((n) => !names.includes(n)),
    redisConnections: redisConnectionBudget(workers.length),
  });
  return workers;
}

export async function stopBackgroundWorkers(workers: Worker[]): Promise<void> {
  await Promise.allSettled(workers.map((w) => w.close()));
}
