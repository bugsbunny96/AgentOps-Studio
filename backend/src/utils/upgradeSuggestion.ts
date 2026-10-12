/**
 * Upgrade suggestion (MKT-08, 2026-10-12).
 *
 * Customers who keep buying top-up packs pay ₹18–20/min for minutes the next
 * plan would include for less. When an org bought packs in at least
 * REGULAR_TOPUP_MONTHS of the last 3 calendar months (UTC, current month
 * included), we suggest the next plan in the usage emails and on Billing.
 * Pure function — no DB access.
 */
import {
  PAID_PLANS, PLAN_CATALOG, TOPUP_PACKS, isPaidPlan, isTopupPackId,
  type PaidPlan,
} from '../modules/billing/plan-catalog';
import type { Plan } from '../modules/organization/organization.model';

export const REGULAR_TOPUP_MONTHS = 2;
const LOOKBACK_MONTHS = 3;

export interface PackPurchaseLike {
  packId:      string;
  purchasedAt: Date | string;
}

export interface UpgradeSuggestion {
  fromPlan:       PaidPlan;
  toPlan:         PaidPlan;
  toPlanName:     string;
  /** Extra minutes included every month on the next plan */
  extraMinutes:   number;
  /** Extra ₹/month (ex-GST) on monthly billing */
  monthlyDiffInr: number;
  /** Distinct months with a pack purchase in the lookback window */
  packMonths:     number;
  /** ₹ spent on packs (ex-GST) in the lookback window */
  packSpendInr:   number;
  /** true → the org tops up regularly; show the prominent nudge */
  regular:        boolean;
}

/** Next paid plan up, or null on the top plan / non-paid plans. */
export function nextPlan(plan: Plan | undefined | null): PaidPlan | null {
  if (!isPaidPlan(plan)) return null;
  const i = PAID_PLANS.indexOf(plan);
  return PAID_PLANS[i + 1] ?? null;
}

export function suggestUpgrade(
  plan: Plan | undefined | null,
  packs: readonly PackPurchaseLike[] | undefined | null,
  now: Date = new Date(),
): UpgradeSuggestion | null {
  const to = nextPlan(plan);
  if (!to || !isPaidPlan(plan)) return null;

  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (LOOKBACK_MONTHS - 1), 1));
  const months = new Set<string>();
  let spend = 0;
  for (const p of packs ?? []) {
    const at = new Date(p.purchasedAt);
    if (Number.isNaN(at.getTime()) || at < windowStart || at > now) continue;
    months.add(`${at.getUTCFullYear()}-${at.getUTCMonth()}`);
    if (isTopupPackId(p.packId)) spend += TOPUP_PACKS[p.packId].priceInr;
  }

  const from = PLAN_CATALOG[plan];
  const next = PLAN_CATALOG[to];
  return {
    fromPlan:       plan,
    toPlan:         to,
    toPlanName:     next.name,
    extraMinutes:   next.includedMinutes - from.includedMinutes,
    monthlyDiffInr: next.monthlyInr - from.monthlyInr,
    packMonths:     months.size,
    packSpendInr:   spend,
    regular:        months.size >= REGULAR_TOPUP_MONTHS,
  };
}
