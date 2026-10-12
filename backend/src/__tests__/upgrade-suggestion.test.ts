/** MKT-08 — upgrade nudge for orgs that buy top-up packs most months (pure, no DB). */
import { describe, it, expect } from 'vitest';
import { suggestUpgrade, nextPlan } from '../utils/upgradeSuggestion';

const NOW = new Date('2026-10-12T10:00:00Z');
const pack = (packId: string, iso: string) => ({ packId, purchasedAt: new Date(iso) });

describe('nextPlan', () => {
  it('walks up the paid plans and stops at Pro', () => {
    expect(nextPlan('lite')).toBe('starter');
    expect(nextPlan('starter')).toBe('growth');
    expect(nextPlan('growth')).toBe('enterprise');
    expect(nextPlan('enterprise')).toBeNull();
    expect(nextPlan('free')).toBeNull();
    expect(nextPlan(undefined)).toBeNull();
  });
});

describe('suggestUpgrade', () => {
  it('returns null on Pro and on free', () => {
    expect(suggestUpgrade('enterprise', [pack('topup_500', '2026-10-01')], NOW)).toBeNull();
    expect(suggestUpgrade('free', [], NOW)).toBeNull();
  });

  it('is not "regular" with packs in only one month', () => {
    const s = suggestUpgrade('starter', [pack('topup_100', '2026-10-02'), pack('topup_100', '2026-10-09')], NOW);
    expect(s).not.toBeNull();
    expect(s!.regular).toBe(false);
    expect(s!.packMonths).toBe(1);
    expect(s!.packSpendInr).toBe(4_000);
    expect(s!.toPlanName).toBe('Standard');
    expect(s!.extraMinutes).toBe(500);
    expect(s!.monthlyDiffInr).toBe(8_000);
  });

  it('is "regular" with packs in 2 of the last 3 months', () => {
    const s = suggestUpgrade('starter', [pack('topup_100', '2026-08-20'), pack('topup_500', '2026-10-03')], NOW);
    expect(s!.regular).toBe(true);
    expect(s!.packMonths).toBe(2);
    expect(s!.packSpendInr).toBe(11_000);
  });

  it('ignores packs older than the 3-month window and in the future', () => {
    const s = suggestUpgrade('lite', [pack('topup_100', '2026-07-31T23:59:00Z'), pack('topup_100', '2026-10-05'), pack('topup_100', '2026-11-01')], NOW);
    expect(s!.packMonths).toBe(1);
    expect(s!.regular).toBe(false);
    expect(s!.toPlanName).toBe('Basic');
  });

  it('handles missing pack lists', () => {
    expect(suggestUpgrade('growth', undefined, NOW)!.regular).toBe(false);
  });
});
