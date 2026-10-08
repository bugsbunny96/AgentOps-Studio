/**
 * Plan catalog for the UI (pricing v2, 2026-10-08).
 *
 * Mirrors backend/src/modules/billing/plan-catalog.ts — change both together.
 * Stripe prices are what customers are actually charged.
 * Source: main-project-docs/Pricing-Redesign-2026-10.md § 5.
 *
 * Internal IDs → customer names:
 *   lite → Starter · starter → Basic · growth → Standard · enterprise → Pro
 * All amounts are ₹, exclusive of 18% GST.
 */

export type PlanId = 'free' | 'lite' | 'starter' | 'growth' | 'enterprise';
export type PaidPlanId = Exclude<PlanId, 'free'>;
export type BillingInterval = 'month' | 'year';
export type TopupPackId = 'topup_100' | 'topup_500';

export interface PlanDef {
  id:                   PaidPlanId;
  name:                 string;
  tagline:              string;
  monthlyInr:           number;
  annualInr:            number;
  includedMinutes:      number;
  /** ≈ calls at a 4-minute average call */
  approxCalls:          number;
  concurrentCalls:      number;
  teamMembers:          number | null; // null = unlimited
  kbDocs:               number;
  setupFeeInr:          number;
  setupLabel:           string;
  /** null = premium voices included */
  premiumVoiceAddonInr: number | null;
  support:              string;
  featured:             boolean;
}

export const GST_RATE = 0.18;
export const AVG_CALL_MINUTES = 4;

export const PLANS: readonly PlanDef[] = [
  {
    id: 'lite', name: 'Starter', tagline: 'Try an AI receptionist on one line',
    monthlyInr: 4_999, annualInr: 49_990, includedMinutes: 200, approxCalls: 50,
    concurrentCalls: 1, teamMembers: 0, kbDocs: 25,
    setupFeeInr: 0, setupLabel: 'Self-serve setup — free',
    premiumVoiceAddonInr: 1_499, support: 'Email support', featured: false,
  },
  {
    id: 'starter', name: 'Basic', tagline: 'Small shops, a few calls a day',
    monthlyInr: 9_999, annualInr: 99_990, includedMinutes: 500, approxCalls: 125,
    concurrentCalls: 2, teamMembers: 1, kbDocs: 50,
    setupFeeInr: 4_999, setupLabel: 'Guided setup ₹4,999 (free on annual)',
    premiumVoiceAddonInr: 2_999, support: 'Email support', featured: false,
  },
  {
    id: 'growth', name: 'Standard', tagline: 'Busy businesses, 10+ calls a day',
    monthlyInr: 17_999, annualInr: 179_990, includedMinutes: 1_000, approxCalls: 250,
    concurrentCalls: 3, teamMembers: 5, kbDocs: 200,
    setupFeeInr: 4_999, setupLabel: 'Guided setup ₹4,999 (free on annual)',
    premiumVoiceAddonInr: 4_999, support: 'Priority email + WhatsApp', featured: true,
  },
  {
    id: 'enterprise', name: 'Pro', tagline: 'High call volume, premium voices',
    monthlyInr: 29_999, annualInr: 299_990, includedMinutes: 1_500, approxCalls: 375,
    concurrentCalls: 5, teamMembers: null, kbDocs: 500,
    setupFeeInr: 14_999, setupLabel: 'Managed setup ₹14,999 (free on annual)',
    premiumVoiceAddonInr: null, support: 'Priority support + onboarding call', featured: false,
  },
];

export const PLAN_BY_ID: Readonly<Record<PaidPlanId, PlanDef>> =
  Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PaidPlanId, PlanDef>;

export const PLAN_NAMES: Readonly<Record<PlanId, string>> = {
  free: 'Free', lite: 'Starter', starter: 'Basic', growth: 'Standard', enterprise: 'Pro',
};

export const PLAN_ORDER: readonly PlanId[] = ['free', 'lite', 'starter', 'growth', 'enterprise'];

export interface TopupPackDef { id: TopupPackId; minutes: number; priceInr: number }

export const TOPUP_PACKS: readonly TopupPackDef[] = [
  { id: 'topup_100', minutes: 100, priceInr: 2_000 },
  { id: 'topup_500', minutes: 500, priceInr: 9_000 },
];
export const TOPUP_VALIDITY_DAYS = 90;

/** Features every plan includes — only things that are built today (BIZ-07). */
export const ALL_PLANS_INCLUDE: readonly string[] = [
  'Answers calls in the hours you set, with an after-hours message outside them',
  'Hindi, English and Punjabi, detected automatically',
  'One Indian phone number',
  'Product catalog + order capture on calls',
  'Call recordings, transcripts and AI summaries',
  'Follow-up alerts by email',
  'Analytics dashboard',
  'Website crawl into the knowledge base',
];

export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function withGst(n: number): number {
  return Math.round(n * (1 + GST_RATE));
}

/** Price shown per month for an interval (annual = annual price ÷ 12). */
export function monthlyEquivalent(plan: PlanDef, interval: BillingInterval): number {
  return interval === 'year' ? Math.round(plan.annualInr / 12) : plan.monthlyInr;
}

export function perMinute(plan: PlanDef): number {
  return plan.monthlyInr / plan.includedMinutes;
}
