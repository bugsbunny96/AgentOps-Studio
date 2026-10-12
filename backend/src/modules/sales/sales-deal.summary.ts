/**
 * Pure summary of the deal log (MKT-11): win rate, lost reasons, results per
 * source, and median price answers. No DB access — unit-tested directly.
 */
import type { DealSource, DealStage, LostReason, PriceAnswers } from './sales-deal.model';

export interface DealLike {
  stage:         DealStage;
  source:        DealSource;
  lostReason?:   LostReason | null;
  priceAnswers?: PriceAnswers | null;
}

export interface DealSummary {
  total:       number;
  open:        number;
  won:         number;
  lost:        number;
  /** won ÷ (won + lost); null until a deal is closed */
  winRate:     number | null;
  lostReasons: Array<{ reason: LostReason | 'unknown'; count: number }>;
  bySource:    Array<{ source: DealSource; total: number; won: number; lost: number; winRate: number | null }>;
  /** Median Van Westendorp answers (₹/month ex-GST) and how many deals answered each */
  priceAnswers: Record<keyof PriceAnswers, { median: number | null; n: number }>;
}

export function median(values: readonly number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}

const rate = (won: number, lost: number) => (won + lost > 0 ? won / (won + lost) : null);

const PRICE_KEYS: Array<keyof PriceAnswers> = ['tooCheapInr', 'bargainInr', 'expensiveInr', 'tooExpensiveInr'];

export function summarizeDeals(deals: readonly DealLike[]): DealSummary {
  let open = 0; let won = 0; let lost = 0;
  const reasons = new Map<LostReason | 'unknown', number>();
  const sources = new Map<DealSource, { total: number; won: number; lost: number }>();
  const prices: Record<keyof PriceAnswers, number[]> = {
    tooCheapInr: [], bargainInr: [], expensiveInr: [], tooExpensiveInr: [],
  };

  for (const d of deals) {
    if (d.stage === 'open') open += 1;
    if (d.stage === 'won')  won += 1;
    if (d.stage === 'lost') {
      lost += 1;
      const r = d.lostReason ?? 'unknown';
      reasons.set(r, (reasons.get(r) ?? 0) + 1);
    }
    const s = sources.get(d.source) ?? { total: 0, won: 0, lost: 0 };
    s.total += 1;
    if (d.stage === 'won')  s.won += 1;
    if (d.stage === 'lost') s.lost += 1;
    sources.set(d.source, s);
    for (const k of PRICE_KEYS) {
      const v = d.priceAnswers?.[k];
      if (typeof v === 'number' && v > 0) prices[k].push(v);
    }
  }

  return {
    total: deals.length,
    open, won, lost,
    winRate: rate(won, lost),
    lostReasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    bySource: [...sources.entries()]
      .map(([source, s]) => ({ source, ...s, winRate: rate(s.won, s.lost) }))
      .sort((a, b) => b.total - a.total),
    priceAnswers: Object.fromEntries(
      PRICE_KEYS.map((k) => [k, { median: median(prices[k]), n: prices[k].length }]),
    ) as DealSummary['priceAnswers'],
  };
}
