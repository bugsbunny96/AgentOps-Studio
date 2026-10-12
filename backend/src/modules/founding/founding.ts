/**
 * Founding client programme (MKT-04, founder decision D8, 2026-10-12).
 *
 *   - 5 founding clients per calendar quarter (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec, IST).
 *   - Founding clients keep today's plan price for 12 months and pay no setup fee,
 *     in return for consent to a case study with real numbers.
 *   - The super-admin marks an org as a founding client; the public Pricing page
 *     shows the real number of spots left this quarter (no fake scarcity).
 * Pure helpers — no DB access.
 */

export const FOUNDING_PER_QUARTER  = 5;
export const FOUNDING_PRICE_LOCK_MONTHS = 12;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Start (inclusive) and end (exclusive) of the IST calendar quarter containing `now`, as UTC instants. */
export function istQuarterBounds(now: Date = new Date()): { start: Date; end: Date } {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const q   = Math.floor(ist.getUTCMonth() / 3);
  const startIst = Date.UTC(ist.getUTCFullYear(), q * 3, 1);
  const endIst   = Date.UTC(ist.getUTCFullYear(), q * 3 + 3, 1);
  return { start: new Date(startIst - IST_OFFSET_MS), end: new Date(endIst - IST_OFFSET_MS) };
}

export interface FoundingSpots {
  cap:           number;
  taken:         number;
  remaining:     number;
  quarterEndsAt: string; // ISO
  priceLockMonths: number;
}

export function foundingSpots(takenThisQuarter: number, now: Date = new Date()): FoundingSpots {
  const { end } = istQuarterBounds(now);
  const taken = Math.max(0, takenThisQuarter);
  return {
    cap:             FOUNDING_PER_QUARTER,
    taken,
    remaining:       Math.max(0, FOUNDING_PER_QUARTER - taken),
    quarterEndsAt:   end.toISOString(),
    priceLockMonths: FOUNDING_PRICE_LOCK_MONTHS,
  };
}

export function priceLockUntil(since: Date): Date {
  const d = new Date(since);
  d.setUTCMonth(d.getUTCMonth() + FOUNDING_PRICE_LOCK_MONTHS);
  return d;
}
