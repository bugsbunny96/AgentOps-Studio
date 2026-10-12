/** MKT-11 — deal-log summary and validation (pure, no DB). */
import { describe, it, expect } from 'vitest';
import { summarizeDeals, median } from '../modules/sales/sales-deal.summary';
import { createDealSchema, updateDealSchema } from '../modules/sales/sales-deal.validation';

describe('median', () => {
  it('handles empty, odd and even lists', () => {
    expect(median([])).toBeNull();
    expect(median([5_000, 1_000, 3_000])).toBe(3_000);
    expect(median([4_000, 2_000])).toBe(3_000);
  });
});

describe('summarizeDeals', () => {
  it('returns zeros and a null win rate for no deals', () => {
    const s = summarizeDeals([]);
    expect(s.total).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.priceAnswers.bargainInr).toEqual({ median: null, n: 0 });
  });

  it('counts stages, win rate, lost reasons and sources', () => {
    const s = summarizeDeals([
      { stage: 'won',  source: 'outbound' },
      { stage: 'lost', source: 'outbound', lostReason: 'price' },
      { stage: 'lost', source: 'referral', lostReason: 'price' },
      { stage: 'lost', source: 'referral', lostReason: 'timing' },
      { stage: 'open', source: 'website' },
    ]);
    expect(s).toMatchObject({ total: 5, open: 1, won: 1, lost: 3 });
    expect(s.winRate).toBeCloseTo(0.25);
    expect(s.lostReasons[0]).toEqual({ reason: 'price', count: 2 });
    const outbound = s.bySource.find((x) => x.source === 'outbound')!;
    expect(outbound).toMatchObject({ total: 2, won: 1, lost: 1, winRate: 0.5 });
    expect(s.bySource.find((x) => x.source === 'website')!.winRate).toBeNull();
  });

  it('takes medians of the price answers that were given', () => {
    const s = summarizeDeals([
      { stage: 'open', source: 'outbound', priceAnswers: { bargainInr: 5_000, tooExpensiveInr: 20_000 } },
      { stage: 'open', source: 'outbound', priceAnswers: { bargainInr: 7_000 } },
      { stage: 'open', source: 'outbound', priceAnswers: { bargainInr: 9_000, tooCheapInr: 0 } },
    ]);
    expect(s.priceAnswers.bargainInr).toEqual({ median: 7_000, n: 3 });
    expect(s.priceAnswers.tooExpensiveInr).toEqual({ median: 20_000, n: 1 });
    expect(s.priceAnswers.tooCheapInr).toEqual({ median: null, n: 0 }); // 0 = not answered
  });
});

describe('deal validation', () => {
  it('requires a business name', () => {
    expect(createDealSchema.safeParse({}).success).toBe(false);
    expect(createDealSchema.safeParse({ businessName: 'Sharma Electricals' }).success).toBe(true);
  });

  it('requires a lost reason when a new deal is lost', () => {
    expect(createDealSchema.safeParse({ businessName: 'X', stage: 'lost' }).success).toBe(false);
    expect(createDealSchema.safeParse({ businessName: 'X', stage: 'lost', lostReason: 'price' }).success).toBe(true);
  });

  it('rejects unknown fields and bad values', () => {
    expect(createDealSchema.safeParse({ businessName: 'X', createdBy: 'me' }).success).toBe(false);
    expect(createDealSchema.safeParse({ businessName: 'X', source: 'carrier pigeon' }).success).toBe(false);
    expect(createDealSchema.safeParse({ businessName: 'X', priceAnswers: { bargainInr: -1 } }).success).toBe(false);
  });

  it('allows partial updates', () => {
    expect(updateDealSchema.safeParse({ stage: 'won' }).success).toBe(true);
    expect(updateDealSchema.safeParse({ nextStepAt: '2026-10-15' }).success).toBe(true);
  });
});
