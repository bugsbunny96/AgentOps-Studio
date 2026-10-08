/**
 * Voice cost tiers + premium-voice access (cost reduction, step 3).
 *
 * Standard voices are cheap and included on every plan. Premium voices cost
 * several times more per minute through Vapi:
 *   • Pro                     → premium voices included, no extra charge
 *   • Starter/Basic/Standard  → paid add-on (₹1,499 / ₹2,999 / ₹4,999 a month)
 *   • Free/trial              → not available (upgrade to a paid plan first)
 * The add-on is a separate Stripe subscription (billing.service.ts). Prices come
 * from billing/plan-catalog.ts (pricing v2, 2026-10-08).
 *
 * Add-on pricing rationale: ElevenLabs through Vapi costs about $0.03 (≈ ₹2.90)
 * more per call-minute than OpenAI TTS. At the full allowance that is about
 * ₹580 (Starter, 200 min), ₹1,450 (Basic, 500 min) and ₹2,900 (Standard,
 * 1,000 min) a month, so each add-on keeps a margin at full usage.
 *
 * Approximate TTS cost per call-minute through Vapi (agent speaks ~400–500
 * characters per call-minute; list prices 2026-10-02 — see RD-LOG):
 *   standard  OpenAI tts-1 ~$0.007–0.01 · Deepgram Aura ~$0.007–0.015 · Vapi native (Naina) ~$0.01–0.02
 *   premium   ElevenLabs ~$0.03–0.05 · PlayHT / Azure / Cartesia need our own provider keys in Vapi
 */

import type { IOrganization, Plan } from '../organization/organization.model';
import { computeTrialState } from '../billing/trial.service';
import { PLAN_CATALOG } from '../billing/plan-catalog';

export type VoiceTier = 'standard' | 'premium';

const PROVIDER_TIER: Record<string, VoiceTier> = {
  openai:         'standard',
  deepgram:       'standard',
  vapi:           'standard',
  'custom-voice': 'standard', // legacy → mapped to Vapi native voice
  elevenlabs:     'premium',
  '11labs':       'premium',
  playht:         'premium',
  azure:          'premium',
  cartesia:       'premium',
};

/** Plans that include premium voices at no extra charge. */
export const PREMIUM_VOICE_PLANS: readonly Plan[] = ['enterprise'];

/** Monthly add-on price (₹, + GST) per plan that can buy it. */
export const PREMIUM_VOICE_ADDON_PRICE_INR: Readonly<Partial<Record<Plan, number>>> = {
  lite:    PLAN_CATALOG.lite.premiumVoiceAddonInr ?? undefined,    // Starter
  starter: PLAN_CATALOG.starter.premiumVoiceAddonInr ?? undefined, // Basic
  growth:  PLAN_CATALOG.growth.premiumVoiceAddonInr ?? undefined,  // Standard
};

/** Cheap default used when a premium voice is not allowed. */
export const DEFAULT_VOICE = { provider: 'openai', voiceId: 'nova' } as const;

type OrgForVoice = Pick<IOrganization, 'plan' | 'planOverride' | 'trialEndsAt'> & {
  trialUsed?: boolean;
  premiumVoiceAddon?: boolean;
};

export function getVoiceTier(provider: string | undefined): VoiceTier {
  return PROVIDER_TIER[provider ?? 'openai'] ?? 'premium';
}

/**
 * Plan that governs feature access: planOverride wins; an active free trial
 * counts as Basic ('starter'), matching billing.service.getBillingStatus.
 */
export function getFeaturePlan(org: OrgForVoice): Plan {
  const base = ((org.planOverride ?? org.plan) || 'free') as Plan;
  const trial = computeTrialState(base, org.trialUsed ?? false, org.trialEndsAt);
  return trial.isInTrial ? 'starter' : base;
}

/** The plan the org actually pays for (planOverride wins; a trial is still 'free'). */
export function getPaidPlan(org: OrgForVoice): Plan {
  return ((org.planOverride ?? org.plan) || 'free') as Plan;
}

export interface PremiumVoiceAccess {
  /** Premium voices may be used right now. */
  allowed:        boolean;
  /** Pro: included in the plan. */
  includedInPlan: boolean;
  /** The org holds an active add-on (it may be redundant on Pro). */
  addonActive:    boolean;
  /** The add-on can be bought on the current plan (Starter / Basic / Standard, add-on not active). */
  addonEligible:  boolean;
  /** Monthly add-on price for the current plan, or null when not sold on it. */
  addonPriceInr:  number | null;
}

export function getPremiumVoiceAccess(org: OrgForVoice): PremiumVoiceAccess {
  const featurePlan    = getFeaturePlan(org);
  const paidPlan       = getPaidPlan(org);
  const includedInPlan = PREMIUM_VOICE_PLANS.includes(featurePlan);
  const addonPriceInr  = PREMIUM_VOICE_ADDON_PRICE_INR[paidPlan] ?? null;
  const addonActive    = org.premiumVoiceAddon === true;
  // The add-on only counts on a plan that sells it — after a downgrade to free it lapses.
  const addonCounts    = addonActive && addonPriceInr !== null;
  return {
    allowed:       includedInPlan || addonCounts,
    includedInPlan,
    addonActive,
    addonEligible: !includedInPlan && !addonActive && addonPriceInr !== null,
    addonPriceInr,
  };
}

/** True when this provider may be used by the org right now. */
export function isVoiceAllowedForOrg(provider: string | undefined, org: OrgForVoice): boolean {
  return getVoiceTier(provider) === 'standard' || getPremiumVoiceAccess(org).allowed;
}
