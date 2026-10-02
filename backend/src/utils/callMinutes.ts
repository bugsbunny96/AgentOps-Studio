/**
 * Monthly call-minute helpers (BIZ-01)
 *
 * `callMinutesUsed` counts minutes for the month that starts at
 * `callMinutesResetAt`. If that month is over, the stored counter is stale and
 * the org has used 0 minutes this month — even when the reset worker is off and
 * no call has ended yet to self-heal the counter.
 */

/** UTC midnight on the 1st of the month containing `now`. */
export function startOfMonthUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Minutes used in the current month, treating a stale counter as 0. */
export function currentMonthMinutesUsed(
  org: { callMinutesUsed?: number | null; callMinutesResetAt?: Date | string | null },
  now: Date = new Date(),
): number {
  const used = org.callMinutesUsed ?? 0;
  if (!org.callMinutesResetAt) return used;
  const resetAt = new Date(org.callMinutesResetAt);
  if (Number.isNaN(resetAt.getTime())) return used;
  return resetAt < startOfMonthUTC(now) ? 0 : used;
}
