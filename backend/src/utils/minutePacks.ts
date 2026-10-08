/**
 * Prepaid top-up pack helpers (pricing v2, 2026-10-08).
 *
 * Plan minutes are used first; pack minutes only cover usage beyond the plan's
 * monthly allowance. Packs are consumed FIFO by expiry and expire
 * TOPUP_VALIDITY_DAYS after purchase. Pure functions — easy to unit-test.
 */

export interface PackLike {
  remaining:       number;
  expiresAt:       Date | string;
  stripeSessionId: string;
}

/** Minutes left across packs that have not expired. */
export function validPackBalance(packs: readonly PackLike[] | undefined | null, now: Date = new Date()): number {
  return (packs ?? []).reduce(
    (sum, p) => (new Date(p.expiresAt) > now && p.remaining > 0 ? sum + p.remaining : sum),
    0,
  );
}

/** Earliest expiry among packs that still have minutes, or null. */
export function nextPackExpiry(packs: readonly PackLike[] | undefined | null, now: Date = new Date()): Date | null {
  const dates = (packs ?? [])
    .filter((p) => new Date(p.expiresAt) > now && p.remaining > 0)
    .map((p) => new Date(p.expiresAt))
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] ?? null;
}

/**
 * Minutes of one call that fall beyond the plan allowance.
 * `usedBefore` / `usedAfter` are the month's plan-counter values around the call.
 */
export function overflowMinutes(usedBefore: number, usedAfter: number, planLimit: number): number {
  if (!Number.isFinite(planLimit)) return 0;
  return Math.max(0, usedAfter - planLimit) - Math.max(0, usedBefore - planLimit);
}

/**
 * Decides how many minutes to take from each pack (soonest expiry first).
 * Returns the takes and any minutes no pack could cover.
 */
export function allocatePackConsumption(
  packs: readonly PackLike[] | undefined | null,
  minutes: number,
  now: Date = new Date(),
): { takes: Array<{ stripeSessionId: string; take: number }>; uncovered: number } {
  let left = Math.max(0, Math.ceil(minutes));
  const takes: Array<{ stripeSessionId: string; take: number }> = [];
  const usable = (packs ?? [])
    .filter((p) => new Date(p.expiresAt) > now && p.remaining > 0)
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  for (const p of usable) {
    if (left <= 0) break;
    const take = Math.min(p.remaining, left);
    takes.push({ stripeSessionId: p.stripeSessionId, take });
    left -= take;
  }
  return { takes, uncovered: left };
}
