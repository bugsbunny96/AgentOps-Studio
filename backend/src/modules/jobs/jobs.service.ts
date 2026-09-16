/**
 * Jobs Service — BullMQ Queue Inspector
 *
 * Provides read/write access to the three BullMQ queues:
 *   • website-crawl (crawlQueue)
 *   • kb-ingest     (kbQueue)
 *   • call-report   (callReportQueue)
 *
 * Operations: get counts, retry failed, clean completed, pause/resume.
 */
import { Queue } from 'bullmq';
import { crawlQueue }       from '../../jobs/crawl.queue';
import { kbQueue }          from '../../jobs/kb.queue';
import { callReportQueue }  from '../../jobs/callReport.queue';

// ─── Queue registry ───────────────────────────────────────────────────────────

interface QueueEntry {
  id:    string;
  label: string;
  queue: Queue;
}

const QUEUE_REGISTRY: QueueEntry[] = [
  { id: 'website-crawl', label: 'Website Crawl', queue: crawlQueue       },
  { id: 'kb-ingest',     label: 'KB Ingest',     queue: kbQueue          },
  { id: 'call-report',   label: 'Call Report',   queue: callReportQueue  },
];

function findQueue(queueId: string): QueueEntry {
  const entry = QUEUE_REGISTRY.find(q => q.id === queueId);
  if (!entry) throw new Error(`Queue '${queueId}' not found`);
  return entry;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface QueueStats {
  id:        string;
  label:     string;
  waiting:   number;
  active:    number;
  completed: number;
  failed:    number;
  delayed:   number;
  paused:    number;
  isPaused:  boolean;
}

export async function getAllQueueStats(): Promise<QueueStats[]> {
  return Promise.all(
    QUEUE_REGISTRY.map(async ({ id, label, queue }) => {
      const counts = await queue.getJobCounts(
        'waiting', 'active', 'completed', 'failed', 'delayed', 'paused',
      );
      const isPaused = await queue.isPaused();
      return {
        id, label,
        waiting:   counts.waiting   ?? 0,
        active:    counts.active    ?? 0,
        completed: counts.completed ?? 0,
        failed:    counts.failed    ?? 0,
        delayed:   counts.delayed   ?? 0,
        paused:    counts.paused    ?? 0,
        isPaused,
      };
    }),
  );
}

export async function getQueueStats(queueId: string): Promise<QueueStats> {
  const { id, label, queue } = findQueue(queueId);
  const counts   = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
  const isPaused = await queue.isPaused();
  return {
    id, label,
    waiting:   counts.waiting   ?? 0,
    active:    counts.active    ?? 0,
    completed: counts.completed ?? 0,
    failed:    counts.failed    ?? 0,
    delayed:   counts.delayed   ?? 0,
    paused:    counts.paused    ?? 0,
    isPaused,
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/** Retry all failed jobs in a queue. Returns count retried. */
export async function retryFailedJobs(queueId: string): Promise<number> {
  const { queue } = findQueue(queueId);
  const failed = await queue.getFailed(0, 999);
  await Promise.all(failed.map(job => job.retry()));
  return failed.length;
}

/** Remove all completed jobs from a queue. */
export async function cleanCompletedJobs(queueId: string): Promise<void> {
  const { queue } = findQueue(queueId);
  // grace=0ms, limit=10_000 entries, status='completed'
  await queue.clean(0, 10_000, 'completed');
}

/** Remove all failed jobs from a queue. */
export async function cleanFailedJobs(queueId: string): Promise<void> {
  const { queue } = findQueue(queueId);
  await queue.clean(0, 10_000, 'failed');
}

/** Pause a queue — active jobs finish but no new jobs are dequeued. */
export async function pauseQueue(queueId: string): Promise<void> {
  const { queue } = findQueue(queueId);
  await queue.pause();
}

/** Resume a paused queue. */
export async function resumeQueue(queueId: string): Promise<void> {
  const { queue } = findQueue(queueId);
  await queue.resume();
}

/** Get recent failed job details (up to 50) for a queue. */
export interface FailedJobSummary {
  id:          string | undefined;
  name:        string;
  failedReason: string | undefined;
  attemptsMade: number;
  timestamp:   number;
}

export async function getFailedJobs(queueId: string): Promise<FailedJobSummary[]> {
  const { queue } = findQueue(queueId);
  const failed = await queue.getFailed(0, 49);
  return failed.map(job => ({
    id:           job.id,
    name:         job.name,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp:    job.timestamp,
  }));
}
