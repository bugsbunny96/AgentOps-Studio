/** MKT-04 — founding client programme: IST quarters, spots, price lock (pure). */
import { describe, it, expect } from 'vitest';
import { foundingSpots, istQuarterBounds, priceLockUntil, FOUNDING_PER_QUARTER } from '../modules/founding/founding';

describe('istQuarterBounds', () => {
  it('returns the Oct–Dec quarter in IST', () => {
    const { start, end } = istQuarterBounds(new Date('2026-10-12T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-09-30T18:30:00.000Z'); // 1 Oct 00:00 IST
    expect(end.toISOString()).toBe('2026-12-31T18:30:00.000Z');   // 1 Jan 00:00 IST
  });

  it('puts 31 Dec 23:00 IST in Q4 and 1 Jan 00:30 IST in Q1', () => {
    expect(istQuarterBounds(new Date('2026-12-31T17:30:00Z')).start.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(istQuarterBounds(new Date('2026-12-31T19:00:00Z')).start.toISOString()).toBe('2026-12-31T18:30:00.000Z');
  });
});

describe('foundingSpots', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  it('counts remaining spots and never goes below zero', () => {
    expect(foundingSpots(0, now)).toMatchObject({ cap: FOUNDING_PER_QUARTER, taken: 0, remaining: 5 });
    expect(foundingSpots(3, now).remaining).toBe(2);
    expect(foundingSpots(7, now).remaining).toBe(0);
    expect(foundingSpots(0, now).quarterEndsAt).toBe('2026-12-31T18:30:00.000Z');
  });
});

describe('priceLockUntil', () => {
  it('locks the price for 12 months', () => {
    expect(priceLockUntil(new Date('2026-10-12T10:00:00Z')).toISOString()).toBe('2027-10-12T10:00:00.000Z');
  });
});
