import { describe, it, expect } from 'vitest';
import {
  PLAN_BY_ID, annualSaving, firstYearAnnualSaving, maxFirstYearAnnualSaving,
  monthlyEquivalent, setupTier, SETUP_INCLUDES,
} from '../../lib/pricing';

// MKT-02: annual saving shown on plan cards; MKT-05: setup deliverables per tier.
describe('annual savings', () => {
  it('equals 12 monthly payments minus the annual price', () => {
    expect(annualSaving(PLAN_BY_ID.lite)).toBe(9_998);
    expect(annualSaving(PLAN_BY_ID.starter)).toBe(19_998);
    expect(annualSaving(PLAN_BY_ID.growth)).toBe(35_998);
    expect(annualSaving(PLAN_BY_ID.enterprise)).toBe(59_998);
  });

  it('adds the waived setup fee in the first year', () => {
    expect(firstYearAnnualSaving(PLAN_BY_ID.lite)).toBe(9_998);
    expect(firstYearAnnualSaving(PLAN_BY_ID.starter)).toBe(24_997);
    expect(firstYearAnnualSaving(PLAN_BY_ID.enterprise)).toBe(74_997);
    expect(maxFirstYearAnnualSaving()).toBe(74_997);
  });

  it('shows the annual price per month', () => {
    expect(monthlyEquivalent(PLAN_BY_ID.growth, 'year')).toBe(14_999);
  });
});

describe('setup tiers', () => {
  it('maps plans to self-serve, guided and managed setup', () => {
    expect(setupTier(PLAN_BY_ID.lite)).toBe('selfServe');
    expect(setupTier(PLAN_BY_ID.starter)).toBe('guided');
    expect(setupTier(PLAN_BY_ID.growth)).toBe('guided');
    expect(setupTier(PLAN_BY_ID.enterprise)).toBe('managed');
    expect(SETUP_INCLUDES.guided.length).toBeGreaterThan(0);
  });
});
