/**
 * BillingPage — plan overview, usage meters, upgrade flow, top-up packs.
 *
 * Pricing v2 (2026-10-08) — plan data from src/lib/pricing.ts (mirrors the
 * backend billing/plan-catalog.ts). Customer-facing names / internal IDs:
 *   lite       → Starter   ₹4,999 / month  (200 min, 1 simultaneous call)
 *   starter    → Basic     ₹9,999 / month  (500 min, 2)
 *   growth     → Standard  ₹17,999 / month (1,000 min, 3)
 *   enterprise → Pro       ₹29,999 / month (1,500 min, 5, premium voices included)
 * All prices are + 18% GST. Annual = 10 months' price for 12, setup fee waived.
 * Extra minutes: prepaid top-up packs (100 min ₹2,000 · 500 min ₹9,000, 90 days).
 *
 * Routes:
 *   GET  /api/v1/billing/status   → current plan + usage + top-up balance
 *   POST /api/v1/billing/checkout → Stripe Checkout URL ({ plan, interval })
 *   POST /api/v1/billing/topups/checkout → top-up pack checkout ({ pack })
 *   POST /api/v1/billing/addons/premium-voices/checkout → Premium Voices add-on checkout
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CheckCircle2, Zap, Building2, Loader2, AlertCircle, ChevronRight,
  X, CreditCard, BarChart3, Users, FileText, Clock, Rocket, Phone, Mic, RefreshCw,
} from 'lucide-react';
import api from '@/utils/api';
import {
  PLANS as PLAN_CATALOG, PLAN_NAMES, PLAN_ORDER, TOPUP_PACKS, TOPUP_VALIDITY_DAYS,
  inr, monthlyEquivalent,
  type BillingInterval, type PaidPlanId, type PlanId, type TopupPackId,
} from '@/lib/pricing';

// ─── Design tokens (mirrors DashboardLayout + DashboardPage) ─────────────────
const T = {
  bg:    '#171717',
  bgS:   '#1f1f1f',
  bgC:   'rgba(255,255,255,0.035)',
  bgCH:  'rgba(255,255,255,0.06)',
  bdr:   'rgba(255,255,255,0.07)',
  bdrH:  'rgba(255,255,255,0.15)',
  blue:  '#21F1A8',
  blueL: '#7CF7CB',
  violet:'#0FC98A',
  em:    '#10b981',
  amb:   '#f59e0b',
  rose:  '#f43f5e',
  t1:    '#fafafa',
  t2:    '#a3a3a3',
  t3:    '#737373',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Plan = PlanId;

interface BillingStatus {
  plan:             Plan;
  effectivePlan:    Plan;
  kbDocs:           { used: number; limit: number | null };
  teamMembers:      { used: number; limit: number | null };
  /** Monthly call-minute quota. limit=null = unlimited. resetAt = ISO date of next reset. */
  callMinutes:      { used: number; limit: number | null; resetAt: string };
  /** Prepaid top-up minutes left (used after the plan allowance) */
  topupMinutes?:    { balance: number; nextExpiry: string | null; canBuy: boolean };
  concurrentCalls?: number;
  billingInterval?: BillingInterval | null;
  setupFeePaid?:    boolean;
  stripeCustomerId: string | null;
  isInTrial:        boolean;
  isTrialExpired:   boolean;
  trialDaysLeft:    number;
  trialEndsAt:      string | null;
  premiumVoices?:   boolean;
  premiumVoiceAddon?: {
    allowed:        boolean;
    includedInPlan: boolean;
    addonActive:    boolean;
    addonEligible:  boolean;
    addonPriceInr:  number | null;
    pricesInr:      { lite?: number; starter: number; growth: number };
  };
}

// ─── Plan cards — data from src/lib/pricing.ts; only built features (BIZ-07) ──
const PLAN_STYLE: Record<PaidPlanId, { accentRgb: string; accentColor: string; badgeBg: string; badgeBdr: string }> = {
  lite:       { accentRgb: '100,116,139', accentColor: T.t2,      badgeBg: 'rgba(115,115,115,0.2)', badgeBdr: T.bdr },
  starter:    { accentRgb: '100,116,139', accentColor: T.t2,      badgeBg: 'rgba(115,115,115,0.2)', badgeBdr: T.bdr },
  growth:     { accentRgb: '33,241,168',  accentColor: T.blueL,   badgeBg: 'rgba(33,241,168,0.15)', badgeBdr: 'rgba(33,241,168,0.3)' },
  enterprise: { accentRgb: '15,201,138',  accentColor: '#5CF4BF', badgeBg: 'rgba(15,201,138,0.15)', badgeBdr: 'rgba(15,201,138,0.3)' },
};

const PLANS = PLAN_CATALOG.map((p) => ({
  id:          p.id as Plan,
  name:        p.name,
  def:         p,
  description: p.tagline,
  features: [
    `${p.includedMinutes.toLocaleString('en-IN')} minutes / month (≈ ${p.approxCalls} calls)`,
    `${p.concurrentCalls} simultaneous call${p.concurrentCalls > 1 ? 's' : ''}`,
    p.premiumVoiceAddonInr === null ? 'Premium voices included' : `Premium voices add-on ${inr(p.premiumVoiceAddonInr)}/mo`,
    `${p.kbDocs} knowledge-base documents`,
    p.teamMembers === null ? 'Unlimited team members'
      : p.teamMembers === 0 ? 'Owner account only'
      : `${p.teamMembers} team member${p.teamMembers > 1 ? 's' : ''}`,
    'Extra minutes: top-up packs',
    p.support,
  ],
  highlight:   p.featured,
  targetPlan:  p.id,
  ...PLAN_STYLE[p.id],
}));

// ─── UsageMeter ───────────────────────────────────────────────────────────────
function UsageMeter({ label, used, limit, icon: Icon, subtitle }: {
  label:    string;
  used:     number;
  limit:    number | null;
  icon:     React.ElementType;
  subtitle?: string;
}) {
  const pct      = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const atLimit  = limit !== null && used >= limit;
  const barColor = pct >= 100 ? T.rose : pct >= 80 ? T.amb : T.blue;

  return (
    <div style={{
      padding: '16px 18px', borderRadius: 12,
      background: T.bgC, border: `1px solid ${atLimit ? 'rgba(244,63,94,0.25)' : T.bdr}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={13} style={{ color: atLimit ? T.rose : T.t3 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>{label}</span>
          </div>
          {subtitle && (
            <span style={{ fontSize: 10, color: T.t3, paddingLeft: 21 }}>{subtitle}</span>
          )}
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, flexShrink: 0,
          color: atLimit ? T.rose : T.t1,
        }}>
          {used.toLocaleString()} / {limit === null ? '∞' : limit.toLocaleString()}
        </span>
      </div>
      {limit !== null && (
        <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999,
            background: barColor,
            width: `${pct}%`,
            transition: 'width 0.5s ease',
            boxShadow: atLimit ? `0 0 8px ${T.rose}` : pct >= 80 ? `0 0 6px ${T.amb}` : undefined,
          }} />
        </div>
      )}
    </div>
  );
}

// ─── TrialBanner ─────────────────────────────────────────────────────────────
function TrialBanner({
  isInTrial,
  isTrialExpired,
  trialDaysLeft,
  trialEndsAt,
  onUpgrade,
}: {
  isInTrial:      boolean;
  isTrialExpired: boolean;
  trialDaysLeft:  number;
  trialEndsAt:    string | null;
  onUpgrade:      () => void;
}) {
  if (!isInTrial && !isTrialExpired) return null;

  const isUrgent  = isTrialExpired || trialDaysLeft <= 2;
  const bgColor   = isUrgent ? 'rgba(244,63,94,0.08)' : 'rgba(245,158,11,0.08)';
  const bdrColor  = isUrgent ? 'rgba(244,63,94,0.25)' : 'rgba(245,158,11,0.25)';
  const textColor = isUrgent ? T.rose : T.amb;
  const iconColor = isUrgent ? T.rose : T.amb;
  const trialDate = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const headline = isTrialExpired
    ? 'Your free trial has ended'
    : trialDaysLeft <= 1
      ? `Your free trial expires today`
      : `${trialDaysLeft} days left in your free trial`;

  const subtext = isTrialExpired
    ? 'Upgrade now to keep your AI agent live and continue using all features.'
    : `Your trial ends on ${trialDate}. Upgrade before it expires to avoid any disruption.`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
      padding: '14px 18px', borderRadius: 12,
      background: bgColor, border: `1px solid ${bdrColor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isUrgent ? 'rgba(244,63,94,0.12)' : 'rgba(245,158,11,0.12)',
          border: `1px solid ${bdrColor}`,
        }}>
          {isTrialExpired
            ? <AlertCircle size={16} style={{ color: iconColor }} />
            : <Clock size={16} style={{ color: iconColor }} />}
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: textColor, margin: '0 0 3px' }}>
            {headline}
          </p>
          <p style={{ fontSize: 12, color: T.t2, margin: 0, lineHeight: 1.5 }}>{subtext}</p>
        </div>
      </div>
      <button
        onClick={onUpgrade}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 9, border: 'none',
          background: isUrgent
            ? 'linear-gradient(135deg, #f43f5e, #e11d48)'
            : 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', flexShrink: 0,
          boxShadow: isUrgent ? '0 0 16px rgba(244,63,94,0.3)' : '0 0 16px rgba(245,158,11,0.25)',
        }}
      >
        <Rocket size={13} />
        {isTrialExpired ? 'Upgrade Now' : 'Upgrade to Keep Access'}
      </button>
    </div>
  );
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan, currentPlan, onUpgrade, upgrading, interval, setupFeePaid,
}: {
  plan:         typeof PLANS[number];
  currentPlan:  Plan;
  onUpgrade:    (targetPlan: PaidPlanId) => void;
  upgrading:    string | null;
  interval:     BillingInterval;
  setupFeePaid: boolean;
}) {
  const isCurrent   = plan.id === currentPlan;
  const isDowngrade = PLAN_ORDER.indexOf(plan.id) < PLAN_ORDER.indexOf(currentPlan);
  const showUpgrade = !isCurrent && plan.targetPlan && !isDowngrade;
  const isLoading   = upgrading === plan.targetPlan;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      border: isCurrent
        ? `1px solid rgba(${plan.accentRgb},0.4)`
        : plan.highlight
          ? `1px solid rgba(33,241,168,0.3)`
          : `1px solid ${T.bdr}`,
      background: isCurrent
        ? `rgba(${plan.accentRgb},0.06)`
        : plan.highlight
          ? 'rgba(33,241,168,0.06)'
          : T.bgC,
      boxShadow: plan.highlight && !isCurrent
        ? '0 0 40px rgba(33,241,168,0.1)'
        : isCurrent
          ? `0 0 30px rgba(${plan.accentRgb},0.08)`
          : 'none',
      transform: plan.highlight && !isCurrent ? 'translateY(-4px)' : 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      {/* Most Popular banner */}
      {plan.highlight && !isCurrent && (
        <div style={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #21F1A8, #0FC98A)',
          color: '#171717', fontSize: 9, fontWeight: 700,
          padding: '3px 12px', borderRadius: '0 0 8px 8px',
          letterSpacing: '.1em', textTransform: 'uppercase',
        }}>
          Most Popular
        </div>
      )}

      {/* Current Plan badge */}
      {isCurrent && (
        <div style={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          background: `rgba(${plan.accentRgb},0.2)`,
          border: `1px solid rgba(${plan.accentRgb},0.35)`,
          color: plan.accentColor, fontSize: 9, fontWeight: 700,
          padding: '3px 12px', borderRadius: '0 0 8px 8px',
          letterSpacing: '.1em', textTransform: 'uppercase',
        }}>
          Current Plan
        </div>
      )}

      {/* Plan name badge */}
      <span style={{
        display: 'inline-block', fontSize: 9, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '.1em',
        padding: '3px 9px', borderRadius: 999,
        background: plan.badgeBg, border: `1px solid ${plan.badgeBdr}`,
        color: plan.accentColor,
        marginBottom: 14,
        marginTop: (plan.highlight || isCurrent) ? 12 : 0,
      }}>
        {plan.name}
      </span>

      {/* Price */}
      <div style={{ marginBottom: 4 }}>
        <span style={{
          fontSize: 36,
          fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
          color: plan.highlight ? T.blueL : T.t1,
        }}>
          {inr(monthlyEquivalent(plan.def, interval))}
        </span>
        <span style={{ fontSize: 12, color: T.t3, marginLeft: 4 }}>/ month + GST</span>
      </div>
      <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0' }}>
        {interval === 'year' ? `Billed ${inr(plan.def.annualInr)} / year` : 'Billed monthly'}
        {' · '}
        {plan.def.setupFeeInr === 0
          ? 'no setup fee'
          : interval === 'year' || setupFeePaid
            ? 'setup fee waived'
            : `+ ${inr(plan.def.setupFeeInr)} one-time setup`}
      </p>

      <p style={{ fontSize: 12, color: T.t2, margin: '10px 0 16px', lineHeight: 1.5 }}>
        {plan.description}
      </p>

      <hr style={{ border: 'none', borderTop: `1px solid ${T.bdr}`, marginBottom: 16 }} />

      {/* Features */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: T.t2 }}>
            <CheckCircle2 size={13} style={{ color: T.em, flexShrink: 0, marginTop: 1 }} />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA buttons */}
      {isCurrent && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 14px', borderRadius: 9,
          background: `rgba(${plan.accentRgb},0.1)`,
          border: `1px solid rgba(${plan.accentRgb},0.2)`,
        }}>
          <CheckCircle2 size={13} style={{ color: plan.accentColor }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: plan.accentColor }}>Active Plan</span>
        </div>
      )}

      {showUpgrade && (
        <button
          onClick={() => onUpgrade(plan.targetPlan)}
          disabled={!!upgrading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '9px 16px', borderRadius: 9, border: 'none',
            background: plan.highlight
              ? 'linear-gradient(135deg, #21F1A8, #0FC98A)'
              : `rgba(${plan.accentRgb},0.15)`,
            color: plan.highlight ? '#171717' : plan.accentColor,
            fontSize: 12, fontWeight: 700, cursor: upgrading ? 'not-allowed' : 'pointer',
            opacity: upgrading ? 0.6 : 1,
            transition: 'opacity 0.2s',
            boxShadow: plan.highlight ? '0 0 20px rgba(33,241,168,0.25)' : 'none',
          }}
        >
          {isLoading ? (
            <><Loader2 size={13} style={{ animation: 'bilSpin 1s linear infinite' }} /> Redirecting…</>
          ) : (
            <>Upgrade to {plan.name} <ChevronRight size={13} /></>
          )}
        </button>
      )}

      {isDowngrade && !isCurrent && (
        <p style={{ fontSize: 11, color: T.t3, textAlign: 'center', margin: 0 }}>
          Downgrade via support
        </p>
      )}
    </div>
  );
}

// ─── BillingPage ──────────────────────────────────────────────────────────────
// ─── Premium Voices add-on card ───────────────────────────────────────────────
function PremiumVoicesCard({ addon, onBuy, buying, onManage, managing, hasStripeCustomer }: {
  addon:             NonNullable<BillingStatus['premiumVoiceAddon']>;
  onBuy:             () => void;
  buying:            boolean;
  onManage:          () => void;
  managing:          boolean;
  hasStripeCustomer: boolean;
}) {
  const { includedInPlan, addonActive, addonEligible, addonPriceInr, pricesInr } = addon;

  let status: string;
  let detail: string;
  if (includedInPlan) {
    status = 'Included in Pro';
    detail = addonActive
      ? 'Premium voices are part of your plan, so the separate add-on is cancelled automatically (prorated).'
      : 'ElevenLabs, Azure and PlayHT voices are part of your plan at no extra cost.';
  } else if (addonActive) {
    status = 'Active';
    detail = 'Premium voices are unlocked for your agent. Cancel any time from Manage subscription.';
  } else if (addonEligible && addonPriceInr !== null) {
    status = `${inr(addonPriceInr)} / month + GST`;
    detail = 'Unlock ElevenLabs, Azure and PlayHT voices for your agent. Billed monthly, cancel any time. Included free on Pro.';
  } else {
    status = 'Paid plans only';
    detail = `Available as an add-on on Starter (${inr(pricesInr.lite ?? 1_499)}/mo), Basic (${inr(pricesInr.starter)}/mo) and Standard (${inr(pricesInr.growth)}/mo), and included on Pro. Choose a paid plan below first.`;
  }

  return (
    <div id="premium-voices" style={{
      borderRadius: 16, padding: 20, background: T.bgC, border: `1px solid ${T.bdr}`,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(33,241,168,0.1)', border: '1px solid rgba(33,241,168,0.2)',
      }}>
        <Mic size={18} style={{ color: T.blueL }} />
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T.t3, margin: '0 0 3px' }}>
          Add-on · Premium voices
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, color: T.t1, margin: '0 0 4px' }}>{status}</p>
        <p style={{ fontSize: 12, color: T.t2, margin: 0, lineHeight: 1.5 }}>{detail}</p>
      </div>
      {!includedInPlan && addonEligible && (
        <button
          onClick={onBuy}
          disabled={buying}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9,
            background: T.blue, border: 'none', color: '#171717', fontSize: 13, fontWeight: 700,
            cursor: buying ? 'not-allowed' : 'pointer', opacity: buying ? 0.7 : 1,
          }}
        >
          {buying
            ? <><Loader2 size={13} style={{ animation: 'bilSpin 1s linear infinite' }} /> Redirecting…</>
            : <>Add premium voices <ChevronRight size={13} /></>}
        </button>
      )}
      {addonActive && hasStripeCustomer && !includedInPlan && (
        <button
          onClick={onManage}
          disabled={managing}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8,
            background: 'rgba(33,241,168,0.08)', border: '1px solid rgba(33,241,168,0.2)',
            color: T.blueL, fontSize: 12, fontWeight: 600, cursor: managing ? 'not-allowed' : 'pointer',
          }}
        >
          Manage subscription <ChevronRight size={11} />
        </button>
      )}
    </div>
  );
}

// ─── Top-up packs card ────────────────────────────────────────────────────────
function TopupCard({ topup, onBuy, buying }: {
  topup:  NonNullable<BillingStatus['topupMinutes']>;
  onBuy:  (pack: TopupPackId) => void;
  buying: TopupPackId | null;
}) {
  const expiry = topup.nextExpiry
    ? new Date(topup.nextExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <div id="topups" style={{
      borderRadius: 16, padding: 20, background: T.bgC, border: `1px solid ${T.bdr}`,
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
      }}>
        <RefreshCw size={18} style={{ color: T.em }} />
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T.t3, margin: '0 0 3px' }}>
          Top-up minutes
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, color: T.t1, margin: '0 0 4px' }}>
          {topup.balance.toLocaleString('en-IN')} min left{expiry ? ` · first expiry ${expiry}` : ''}
        </p>
        <p style={{ fontSize: 12, color: T.t2, margin: 0, lineHeight: 1.5 }}>
          {topup.canBuy
            ? `Used after your monthly minutes run out. Valid ${TOPUP_VALIDITY_DAYS} days. No automatic overage charges.`
            : 'Top-up packs are available once you are on a paid plan.'}
        </p>
      </div>
      {topup.canBuy && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TOPUP_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => onBuy(pack.id)}
              disabled={!!buying}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9,
                background: pack.id === 'topup_500' ? T.blue : 'rgba(33,241,168,0.08)',
                border: pack.id === 'topup_500' ? 'none' : '1px solid rgba(33,241,168,0.2)',
                color: pack.id === 'topup_500' ? '#171717' : T.blueL,
                fontSize: 12, fontWeight: 700,
                cursor: buying ? 'not-allowed' : 'pointer', opacity: buying && buying !== pack.id ? 0.6 : 1,
              }}
            >
              {buying === pack.id
                ? <><Loader2 size={12} style={{ animation: 'bilSpin 1s linear infinite' }} /> Redirecting…</>
                : <>{pack.minutes} min · {inr(pack.priceInr)}</>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IntervalSwitch({ value, onChange }: { value: BillingInterval; onChange: (v: BillingInterval) => void }) {
  return (
    <div role="radiogroup" aria-label="Billing period" style={{
      display: 'inline-flex', padding: 3, gap: 3, borderRadius: 999, border: `1px solid ${T.bdr}`, background: T.bgS,
    }}>
      {([['month', 'Monthly'], ['year', 'Annual · 2 months free']] as const).map(([v, label]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          style={{
            padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
            fontSize: 11.5, fontWeight: 700,
            background: value === v ? T.blue : 'transparent',
            color: value === v ? '#171717' : T.t2,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [interval, setBillingInterval] = useState<BillingInterval>('month');
  const [buyingPack, setBuyingPack] = useState<TopupPackId | null>(null);
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Inject spin keyframe
  useEffect(() => {
    const id = 'bil-keyframes';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = `@keyframes bilSpin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(el);
    }
    return () => { document.getElementById('bil-keyframes')?.remove(); };
  }, []);

  // Handle Stripe return params
  useEffect(() => {
    const upgraded  = searchParams.get('upgraded');
    const cancelled = searchParams.get('cancelled');
    const addon     = searchParams.get('addon');
    const topup     = searchParams.get('topup');
    if (topup) {
      const pack = TOPUP_PACKS.find((p) => p.id === topup);
      setToast({ type: 'success', msg: `Payment received — ${pack ? pack.minutes : 'your'} top-up minutes will show here within a minute.` });
      navigate('/billing', { replace: true });
    } else if (addon === 'premium_voices') {
      setToast({ type: 'success', msg: 'Premium voices added. You can now pick ElevenLabs, Azure and PlayHT voices for your agent.' });
      navigate('/billing', { replace: true });
    } else if (upgraded === 'true') {
      setToast({ type: 'success', msg: 'Plan upgraded successfully! Welcome to your new plan.' });
      navigate('/billing', { replace: true });
    } else if (cancelled === 'true') {
      setToast({ type: 'error', msg: 'Checkout cancelled — your plan has not changed.' });
      navigate('/billing', { replace: true });
    }
  }, [searchParams, navigate]);

  // Auto-dismiss toast after 5s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const { data, isLoading, isError } = useQuery<BillingStatus>({
    queryKey: ['billing-status'],
    queryFn:  async () => {
      const res = await api.get<{ success: boolean; data: BillingStatus }>('/billing/status');
      return res.data.data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: PaidPlanId) => {
      const res = await api.post<{ success: boolean; data: { url: string } }>('/billing/checkout', { plan, interval });
      return res.data.data.url;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Checkout failed')
          : 'Checkout failed';
      setToast({ type: 'error', msg });
      setUpgrading(null);
    },
  });

  // Stripe Customer Portal — manage payment methods, invoices, cancellation
  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: { url: string } }>('/billing/portal');
      return res.data.data.url;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to open billing portal')
          : 'Failed to open billing portal';
      setToast({ type: 'error', msg });
    },
  });

  const addonMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: { url: string } }>('/billing/addons/premium-voices/checkout');
      return res.data.data.url;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not start add-on checkout')
          : 'Could not start add-on checkout';
      setToast({ type: 'error', msg });
    },
  });

  const topupMutation = useMutation({
    mutationFn: async (pack: TopupPackId) => {
      const res = await api.post<{ success: boolean; data: { url: string } }>('/billing/topups/checkout', { pack });
      return res.data.data.url;
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not start top-up checkout')
          : 'Could not start top-up checkout';
      setToast({ type: 'error', msg });
      setBuyingPack(null);
    },
  });

  function handleBuyPack(pack: TopupPackId) {
    setBuyingPack(pack);
    topupMutation.mutate(pack);
  }

  function handleUpgrade(plan: PaidPlanId) {
    setUpgrading(plan);
    checkoutMutation.mutate(plan);
  }

  const currentPlan    = data?.plan ?? 'free';
  const effectivePlan  = data?.effectivePlan ?? currentPlan;
  const currentPlanDef = PLANS.find((p) => p.id === effectivePlan);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 16px', borderRadius: 12,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {toast.type === 'success'
              ? <CheckCircle2 size={15} style={{ color: T.em, flexShrink: 0 }} />
              : <AlertCircle size={15} style={{ color: T.rose, flexShrink: 0 }} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: toast.type === 'success' ? T.em : T.rose }}>
              {toast.msg}
            </span>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 2 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Trial Banner */}
      {data && (
        <TrialBanner
          isInTrial={data.isInTrial}
          isTrialExpired={data.isTrialExpired}
          trialDaysLeft={data.trialDaysLeft}
          trialEndsAt={data.trialEndsAt}
          onUpgrade={() => handleUpgrade('growth')}
        />
      )}

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Billing & Plan
        </h1>
        <p style={{ fontSize: 13, color: T.t3, margin: 0 }}>
          Manage your subscription, view feature usage, and upgrade when you're ready.
        </p>
      </div>

      {/* Current plan + usage */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '3px solid rgba(33,241,168,0.2)',
            borderTopColor: T.blue,
            animation: 'bilSpin 0.7s linear infinite',
          }} />
        </div>
      ) : isError ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderRadius: 12,
          background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
        }}>
          <AlertCircle size={15} style={{ color: T.rose, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#f87171' }}>Failed to load billing status. Please refresh.</span>
        </div>
      ) : data ? (
        <div style={{
          borderRadius: 16, padding: 24,
          background: T.bgC, border: `1px solid ${T.bdr}`,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {/* Current plan row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: currentPlan === 'enterprise'
                ? 'rgba(15,201,138,0.15)'
                : currentPlan === 'growth'
                  ? 'rgba(33,241,168,0.15)'
                  : 'rgba(16,185,129,0.1)',
              border: `1px solid ${
                currentPlan === 'enterprise' ? 'rgba(15,201,138,0.25)'
                : currentPlan === 'growth' ? 'rgba(33,241,168,0.25)'
                : 'rgba(16,185,129,0.15)'
              }`,
            }}>
              {currentPlan === 'enterprise'
                ? <Building2 size={18} style={{ color: '#5CF4BF' }} />
                : currentPlan === 'growth'
                  ? <Zap size={18} style={{ color: T.blueL }} />
                  : <CreditCard size={18} style={{ color: T.em }} />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T.t3, margin: '0 0 3px' }}>
                Current Plan
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: T.t1, margin: 0, letterSpacing: '-0.02em' }}>
                  {data?.isInTrial ? 'Free Trial' : PLAN_NAMES[currentPlan] ?? currentPlan}
                </p>
                {data?.isInTrial && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999,
                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
                    color: T.amb,
                  }}>
                    {data.trialDaysLeft} day{data.trialDaysLeft !== 1 ? 's' : ''} left
                  </span>
                )}
                {!data?.isInTrial && currentPlanDef && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: currentPlanDef.accentColor,
                    padding: '2px 8px', borderRadius: 999,
                    background: currentPlanDef.badgeBg, border: `1px solid ${currentPlanDef.badgeBdr}`,
                  }}>
                    {data.billingInterval === 'year'
                      ? `${inr(currentPlanDef.def.annualInr)} / year + GST`
                      : `${inr(currentPlanDef.def.monthlyInr)} / month + GST`}
                  </span>
                )}
              </div>
            </div>
            {data.stripeCustomerId && (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                title="Manage payment methods, invoices, and cancellation via Stripe"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 8,
                  background: 'rgba(33,241,168,0.08)',
                  border: '1px solid rgba(33,241,168,0.2)',
                  color: T.blueL, fontSize: 12, fontWeight: 600,
                  cursor: portalMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: portalMutation.isPending ? 0.65 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {portalMutation.isPending
                  ? <><Loader2 size={11} style={{ animation: 'bilSpin 1s linear infinite' }} /> Opening…</>
                  : <>Manage subscription <ChevronRight size={11} /></>}
              </button>
            )}
          </div>

          {/* Usage meters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <UsageMeter
              label="KB Documents"
              used={data.kbDocs.used}
              limit={data.kbDocs.limit}
              icon={FileText}
            />
            <UsageMeter
              label="Team Members"
              used={data.teamMembers.used}
              limit={data.teamMembers.limit}
              icon={Users}
            />
            <UsageMeter
              label="Call Minutes (this month)"
              used={data.callMinutes.used}
              limit={data.callMinutes.limit}
              icon={Phone}
              subtitle={`Resets ${new Date(data.callMinutes.resetAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${data.topupMinutes?.balance ? ` · + ${data.topupMinutes.balance} top-up min` : ''}`}
            />
            {data.concurrentCalls !== undefined && (
              <div style={{
                padding: '16px 18px', borderRadius: 12, background: T.bgC, border: `1px solid ${T.bdr}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={13} style={{ color: T.t3 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>Simultaneous calls</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{data.concurrentCalls}</span>
              </div>
            )}
          </div>

          {/* Limit warnings */}
          {data.callMinutes.limit !== null && data.callMinutes.used >= data.callMinutes.limit + (data.topupMinutes?.balance ?? 0) && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '11px 14px', borderRadius: 10,
              background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
            }}>
              <Phone size={14} style={{ color: T.rose, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: T.rose, lineHeight: 1.5 }}>
                <strong>All minutes used.</strong> New calls go to your fallback number (or hear a short
                &ldquo;please call back&rdquo; message) until{' '}
                {new Date(data.callMinutes.resetAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}.
                {data.topupMinutes?.canBuy ? ' Buy a top-up pack below to keep your AI receptionist answering.' : ' Choose a plan below to keep your AI receptionist answering.'}
              </span>
            </div>
          )}
          {((data.kbDocs.limit !== null && data.kbDocs.used >= data.kbDocs.limit) ||
            (data.teamMembers.limit !== null && data.teamMembers.used >= data.teamMembers.limit)) && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '11px 14px', borderRadius: 10,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <AlertCircle size={14} style={{ color: T.amb, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.5 }}>
                You've reached a plan limit. Upgrade below to unlock more capacity.
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Top-up packs */}
      {data?.topupMinutes && (
        <TopupCard topup={data.topupMinutes} onBuy={handleBuyPack} buying={buyingPack} />
      )}

      {/* Premium Voices add-on */}
      {data?.premiumVoiceAddon && (
        <PremiumVoicesCard
          addon={data.premiumVoiceAddon}
          onBuy={() => addonMutation.mutate()}
          buying={addonMutation.isPending}
          onManage={() => portalMutation.mutate()}
          managing={portalMutation.isPending}
          hasStripeCustomer={!!data.stripeCustomerId}
        />
      )}

      {/* Section header — plan grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 6,
            background: 'rgba(33,241,168,0.15)', border: '1px solid rgba(33,241,168,0.25)',
          }}>
            <BarChart3 size={11} style={{ color: T.blueL }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: T.t3 }}>
            Choose a Plan
          </span>
          <div style={{ flex: 1, height: 1, background: T.bdr }} />
          <IntervalSwitch value={interval} onChange={setBillingInterval} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'start' }}>
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlan={currentPlan}
              onUpgrade={handleUpgrade}
              upgrading={upgrading}
              interval={interval}
              setupFeePaid={!!data?.setupFeePaid}
            />
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p style={{ fontSize: 11, color: T.t3, textAlign: 'center', margin: 0 }}>
        All prices in ₹ + 18% GST · GST invoices · Annual = 2 months free, setup waived · Cancel anytime ·{' '}
        <a href="mailto:support@agentops.studio" style={{ color: T.blueL, textDecoration: 'none', fontWeight: 600 }}>
          Contact support
        </a>
      </p>
    </div>
  );
}
