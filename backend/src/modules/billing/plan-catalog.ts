/**
 * Plan catalog — prices, allowances and add-ons (pricing v2, 2026-10-08).
 *
 * Source of truth: main-project-docs/Pricing-Redesign-2026-10.md (§ 5) and the
 * pricing doc § 12. Display prices live here; Stripe prices are what is actually
 * charged — change both together (scripts/create-pricing-v2-prices.ts).
 *
 * Internal plan IDs predate the customer-facing names and are kept to avoid a
 * data migration:
 *   lite → "Starter" (new) · starter → "Basic" · growth → "Standard" · enterprise → "Pro"
 *
 * All amounts are ₹ per month, exclusive of 18% GST.
 */

import type { Plan } from '../organization/organization.model';

export type PaidPlan = Exclude<Plan, 'free'>;
export type BillingInterval = 'month' | 'year';

export interface PlanDef {
  /** Customer-facing name */
  name:              string;
  /** ₹/month, ex-GST */
  monthlyInr:        number;
  /** ₹/year, ex-GST — 10 months' price for 12 */
  annualInr:         number;
  /** Call minutes included every calendar month */
  includedMinutes:   number;
  /** Calls the org's agent may handle at the same time */
  concurrentCalls:   number;
  /** One-time setup fee on monthly billing (₹0 = self-serve). Waived on annual. */
  setupFeeInr:       number;
  /** Premium Voices add-on ₹/month; null = included in the plan */
  premiumVoiceAddonInr: number | null;
}

export const PAID_PLANS: readonly PaidPlan[] = ['lite', 'starter', 'growth', 'enterprise'];

export const PLAN_CATALOG: Readonly<Record<PaidPlan, PlanDef>> = {
  lite:       { name: 'Starter',  monthlyInr: 4_999,  annualInr: 49_990,  includedMinutes: 200,   concurrentCalls: 1, setupFeeInr: 0,      premiumVoiceAddonInr: 1_499 },
  starter:    { name: 'Basic',    monthlyInr: 9_999,  annualInr: 99_990,  includedMinutes: 500,   concurrentCalls: 2, setupFeeInr: 4_999,  premiumVoiceAddonInr: 2_999 },
  growth:     { name: 'Standard', monthlyInr: 17_999, annualInr: 179_990, includedMinutes: 1_000, concurrentCalls: 3, setupFeeInr: 4_999,  premiumVoiceAddonInr: 4_999 },
  enterprise: { name: 'Pro',      monthlyInr: 29_999, annualInr: 299_990, includedMinutes: 1_500, concurrentCalls: 5, setupFeeInr: 14_999, premiumVoiceAddonInr: null },
};

export const PLAN_DISPLAY_NAME: Readonly<Record<Plan, string>> = {
  free:       'Free',
  lite:       PLAN_CATALOG.lite.name,
  starter:    PLAN_CATALOG.starter.name,
  growth:     PLAN_CATALOG.growth.name,
  enterprise: PLAN_CATALOG.enterprise.name,
};

/** Ordering for upgrade/downgrade comparisons. */
export const PLAN_RANK: Readonly<Record<Plan, number>> = {
  free: 0, lite: 1, starter: 2, growth: 3, enterprise: 4,
};

export function isPaidPlan(plan: string | undefined | null): plan is PaidPlan {
  return !!plan && (PAID_PLANS as readonly string[]).includes(plan);
}

/** Monthly recurring revenue for a plan (annual plans count as annual ÷ 12). */
export function planMrrInr(plan: Plan, interval: BillingInterval = 'month'): number {
  if (!isPaidPlan(plan)) return 0;
  const def = PLAN_CATALOG[plan];
  return interval === 'year' ? Math.round(def.annualInr / 12) : def.monthlyInr;
}

// ─── Top-up packs (prepaid extra minutes) ─────────────────────────────────────

export type TopupPackId = 'topup_100' | 'topup_500';

export interface TopupPackDef {
  minutes:  number;
  priceInr: number;
}

export const TOPUP_PACKS: Readonly<Record<TopupPackId, TopupPackDef>> = {
  topup_100: { minutes: 100, priceInr: 2_000 }, // ₹20/min
  topup_500: { minutes: 500, priceInr: 9_000 }, // ₹18/min
};

/** Pack minutes expire this many days after purchase. */
export const TOPUP_VALIDITY_DAYS = 90;

export function isTopupPackId(id: string | undefined | null): id is TopupPackId {
  return !!id && Object.prototype.hasOwnProperty.call(TOPUP_PACKS, id);
}

/** Usage-alert thresholds, as a share of the plan's included minutes. */
export const USAGE_ALERT_THRESHOLDS = [0.8, 1] as const;
