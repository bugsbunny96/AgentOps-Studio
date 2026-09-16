/**
 * Call Minutes Reset Queue
 *
 * A single repeating job fires at 00:00 UTC on the 1st of every month.
 * The worker resets callMinutesUsed = 0 on ALL organizations so every
 * org starts the new billing month with a clean counter.
 *
 * The end-of-call-report handler also performs a self-healing reset
 * (via aggregation-pipeline update) whenever it detects that
 * callMinutesResetAt is behind the current month — this makes the system
 * correct even if the monthly job is missed (e.g. server was down on the 1st).
 */

import { Queue } from 'bullmq';
import { getSharedQueueClient } from '../config/bullmq-connection';

export type CallMinutesResetJobName = 'monthly-minutes-reset';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CallMinutesResetJobData {}

export const callMinutesResetQueue = new Queue<
  CallMinutesResetJobData,
  void,
  CallMinutesResetJobName
>('call-minutes-reset', {
  connection: getSharedQueueClient(),
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: 'exponential', delay: 60_000 }, // 1 min → 2 min → 4 min
    removeOnComplete: { count: 5  },
    removeOnFail:     { count: 20 },
  },
});
