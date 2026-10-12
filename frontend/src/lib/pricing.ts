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
    id: 'lite', name: 'Starter', tagline: 'Stop losing customers to an unanswered phone',
    monthlyInr: 4_999, annualInr: 49_990, includedMinutes: 200, approxCalls: 50,
    concurrentCalls: 1, teamMembers: 0, kbDocs: 25,
    setupFeeInr: 0, setupLabel: 'Self-serve setup — free',
    premiumVoiceAddonInr: 1_499, support: 'Email support', featured: false,
  },
  {
    id: 'starter', name: 'Basic', tagline: 'About 4 calls a day answered, every day',
    monthlyInr: 9_999, annualInr: 99_990, includedMinutes: 500, approxCalls: 125,
    concurrentCalls: 2, teamMembers: 1, kbDocs: 50,
    setupFeeInr: 4_999, setupLabel: 'Guided setup ₹4,999 (free on annual)',
    premiumVoiceAddonInr: 2_999, support: 'Email support', featured: false,
  },
  {
    id: 'growth', name: 'Standard', tagline: 'About 8 calls a day, 3 at the same time',
    monthlyInr: 17_999, annualInr: 179_990, includedMinutes: 1_000, approxCalls: 250,
    concurrentCalls: 3, teamMembers: 5, kbDocs: 200,
    setupFeeInr: 4_999, setupLabel: 'Guided setup ₹4,999 (free on annual)',
    premiumVoiceAddonInr: 4_999, support: 'Priority email + WhatsApp', featured: true,
  },
  {
    id: 'enterprise', name: 'Pro', tagline: '12+ calls a day, 5 at once, premium voices, setup done for you',
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
  'Your own local Indian number (inbound + outbound), set up automatically',
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

/** ₹ saved per year on annual billing vs 12 monthly payments (ex-GST). MKT-02 */
export function annualSaving(plan: PlanDef): number {
  return plan.monthlyInr * 12 - plan.annualInr;
}

/** First-year saving on annual: annual discount + the waived setup fee (ex-GST). */
export function firstYearAnnualSaving(plan: PlanDef): number {
  return annualSaving(plan) + plan.setupFeeInr;
}

/** Largest first-year saving across plans — for the "save up to" hint. */
export function maxFirstYearAnnualSaving(): number {
  return Math.max(...PLANS.map(firstYearAnnualSaving));
}

/**
 * What the one-time setup fee buys (MKT-05). Service deliverables only —
 * no integrations until INT-02 ships. Keep in line with the delivery SOP (OFR-02).
 */
export const SETUP_INCLUDES = {
  selfServe: [
    'Step-by-step onboarding in the app: business details, website crawl, voice and greeting',
    'Test calls from your browser before you go live',
  ],
  guided: [
    'A setup call with our team (about 45 minutes)',
    'Website crawl and a review of your knowledge base: FAQs, products, prices',
    'Business hours, greeting and after-hours message set for you',
    'Voice and language chosen with you',
    'Your local number connected',
    'Test calls with you before go-live',
  ],
  managed: [
    'Everything in guided setup',
    'We build it for you: catalog import, FAQs and greeting written from your material',
    'Fallback number and alert emails set up',
    'Go-live check on a real call',
    'Review call after your first week, with changes made for you',
  ],
} as const;

export function setupTier(plan: PlanDef): keyof typeof SETUP_INCLUDES {
  if (plan.setupFeeInr === 0) return 'selfServe';
  return plan.id === 'enterprise' ? 'managed' : 'guided';
}

export function perMinute(plan: PlanDef): number {
  return plan.monthlyInr / plan.includedMinutes;
}
