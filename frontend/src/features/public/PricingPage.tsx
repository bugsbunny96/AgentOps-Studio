/**
 * L3.F2 — PricingPage (Full Implementation)
 * Route: /pricing (public)
 *
 * Source of truth: pricing v2 (2026-10-08) — main-project-docs/Pricing-Redesign-2026-10.md
 * § 5 and the plan catalog in src/lib/pricing.ts (mirrors the backend
 * billing/plan-catalog.ts). Customer-facing plan names: Starter / Basic /
 * Standard / Pro (internal IDs: lite / starter / growth / enterprise).
 *
 * Feature lists only name things that are built (BIZ-07 / H4.2).
 *
 * Sections:
 *   1. Hero
 *   2. Pricing cards — Monthly / Annual toggle (annual = 10 months' price for 12, setup waived)
 *   3. What every plan includes
 *   4. Trust strip
 *   5. Top-up packs — prepaid extra minutes (bought from the Billing page)
 *   6. Feature comparison table
 *   7. FAQ accordion
 *   8. Bottom CTA
 *
 * Design: reuses the shared landing design system (tokens/primitives/landing.css).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Plus, ArrowRight, RefreshCw, ShieldCheck, Clock, Languages,
} from 'lucide-react';
import '../public/landing/landing.css';
import { color, font, maxW } from '../public/landing/tokens';
import {
  GradientText, Pill, Reveal, SectionEyebrow, SectionHeading,
  SpotlightCard, PrimaryButton, SecondaryButton, IconChip, cardStyle,
} from '../public/landing/primitives';
import {
  PLANS, TOPUP_PACKS, TOPUP_VALIDITY_DAYS, ALL_PLANS_INCLUDE, AVG_CALL_MINUTES,
  inr, withGst, monthlyEquivalent, perMinute,
  type BillingInterval, type PaidPlanId,
} from '../../lib/pricing';

// ─── Feature comparison table data ───────────────────────────────────────────
type CellValue = string | boolean;
interface TableSection {
  category: string;
  rows: { label: string; values: Record<PaidPlanId, CellValue> }[];
}

function row(label: string, pick: (p: (typeof PLANS)[number]) => CellValue) {
  return { label, values: Object.fromEntries(PLANS.map((p) => [p.id, pick(p)])) as Record<PaidPlanId, CellValue> };
}

const TABLE_DATA: TableSection[] = [
  {
    category: 'Price',
    rows: [
      row('Monthly (+ GST)', (p) => inr(p.monthlyInr)),
      row('Annual (+ GST) — 2 months free', (p) => inr(p.annualInr)),
      row('One-time setup (monthly billing)', (p) => (p.setupFeeInr ? inr(p.setupFeeInr) : 'Free')),
    ],
  },
  {
    category: 'Calls',
    rows: [
      row('Included minutes / month', (p) => p.includedMinutes.toLocaleString('en-IN')),
      row(`≈ calls / month (${AVG_CALL_MINUTES}-min average)`, (p) => p.approxCalls.toLocaleString('en-IN')),
      row('Effective price per minute', (p) => `₹${perMinute(p).toFixed(0)}`),
      row('Simultaneous calls', (p) => String(p.concurrentCalls)),
      row('Extra minutes', () => 'Top-up packs'),
    ],
  },
  {
    category: 'Voice & knowledge',
    rows: [
      row('Standard voices (OpenAI, Deepgram, Vapi)', () => true),
      row('Premium voices (ElevenLabs, Azure, PlayHT)', (p) => (p.premiumVoiceAddonInr === null ? 'Included' : `Add-on ${inr(p.premiumVoiceAddonInr)}/mo`)),
      row('Knowledge-base documents', (p) => String(p.kbDocs)),
      row('Hindi, English, Punjabi', () => true),
    ],
  },
  {
    category: 'Team & support',
    rows: [
      row('Team members (besides the owner)', (p) => (p.teamMembers === null ? 'Unlimited' : p.teamMembers === 0 ? 'Owner only' : String(p.teamMembers))),
      row('Support', (p) => p.support),
    ],
  },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Do I need a developer to set this up?',
    a: 'No. You enter your business details, paste your website URL, and your AI receptionist can be live in about 30 minutes. On Basic, Standard and Pro our team can also set it up with you.',
  },
  {
    q: 'What happens if I use up my monthly minutes?',
    a: `We email you at 80% and 100% of your included minutes. After that your agent keeps answering using top-up minutes if you have any (100 min for ₹2,000 or 500 min for ₹9,000, valid ${TOPUP_VALIDITY_DAYS} days). With no top-up minutes left, calls are forwarded to your fallback number — or callers hear a short "please call back" message — until your minutes reset on the 1st. We never charge you automatically for extra minutes.`,
  },
  {
    q: 'Is there an annual plan?',
    a: 'Yes. Pay for 10 months and get 12, and the one-time setup fee is waived. Annual billing also avoids the monthly card re-approval that Indian banks require for larger recurring payments.',
  },
  {
    q: 'Is there a setup fee?',
    a: 'Starter is self-serve and has no setup fee. Basic and Standard include guided setup for a one-time ₹4,999, and Pro includes managed setup for ₹14,999. The fee is charged once, on your first monthly invoice, and is waived on annual plans.',
  },
  {
    q: 'How does the free trial work?',
    a: 'Every new account gets a 7-day free trial with 30 included minutes and the Basic-plan feature set — no credit card required. If you haven’t picked a plan by day 7, your agent pauses but your data stays intact for 30 days.',
  },
  {
    q: 'Is pricing in Indian Rupees? Are GST invoices available?',
    a: 'Yes and yes. All prices are in ₹ plus 18% GST, shown as separate line items. GST invoices are issued every billing cycle and can be downloaded from the billing portal.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'You can upgrade at any time. Downgrades and cancellations are handled from the billing portal or via support, so your call history and knowledge base stay intact.',
  },
];

// ─── Cell renderer ────────────────────────────────────────────────────────────
function Cell({ value, isGrowth }: { value: CellValue; isGrowth: boolean }) {
  if (value === true) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: '50%',
        background: isGrowth ? 'rgba(33,241,168,.15)' : 'rgba(16,185,129,.12)',
        color: isGrowth ? color.blueLight : color.emerald,
      }}>
        <Check size={12} strokeWidth={3} />
      </span>
    );
  }
  if (value === false) {
    return <span style={{ color: color.text3, fontSize: 13 }}>—</span>;
  }
  return <span style={{ fontSize: 12.5, fontWeight: 600, color: color.text2, fontFamily: /^[₹\d]/.test(value) ? font.mono : 'inherit' }}>{value}</span>;
}

// ─── SECTION: Hero ────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section style={{ padding: '80px 0 48px', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)',
        backgroundSize: '50px 50px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
      }} />
      {[
        { w: 500, h: 400, c: 'rgba(33,241,168,.12)', top: -120, left: '10%', dur: 12 },
        { w: 400, h: 400, c: 'rgba(15,201,138,.1)', top: -80, right: '8%', dur: 15 },
      ].map(({ w, h, c, dur, ...pos }, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%', pointerEvents: 'none', willChange: 'transform',
          width: w, height: h, background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
          animationName: 'floatA', animationDuration: `${dur}s`, animationDelay: `${-i * 4}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          ...pos,
        } as React.CSSProperties} />
      ))}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '0 20px' }}>
        <Reveal>
          <Pill bg="rgba(16,185,129,.12)" fg={color.emerald} border="rgba(16,185,129,.25)" live>
            7-day free trial · no credit card
          </Pill>
        </Reveal>

        <Reveal delay={80}>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 58px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em',
            marginTop: 16, marginBottom: 14, fontFamily: font.display, textWrap: 'balance',
          }}>
            Simple pricing. <GradientText>No surprises.</GradientText>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p style={{ fontSize: 16, color: color.text2, lineHeight: 1.65, marginBottom: 8, maxWidth: 480, margin: '0 auto' }}>
            All plans are priced in ₹ INR plus 18% GST, and start with a{' '}
            <strong style={{ color: color.text1 }}>7-day free trial</strong>. No credit card required.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── SECTION: Pricing cards ───────────────────────────────────────────────────
function IntervalToggle({ value, onChange }: { value: BillingInterval; onChange: (v: BillingInterval) => void }) {
  const opts: { v: BillingInterval; label: string }[] = [
    { v: 'month', label: 'Monthly' },
    { v: 'year',  label: 'Annual · 2 months free' },
  ];
  return (
    <div role="radiogroup" aria-label="Billing period" style={{
      display: 'inline-flex', padding: 4, gap: 4, borderRadius: 999,
      border: `1px solid ${color.border}`, background: color.bgSoft,
    }}>
      {opts.map(({ v, label }) => {
        const on = value === v;
        return (
          <button
            key={v}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            style={{
              padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: on ? '#21F1A8' : 'transparent',
              color: on ? '#171717' : color.text2,
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PricingCards() {
  const [interval, setBillingInterval] = useState<BillingInterval>('month');

  return (
    <section style={{ padding: '32px 0 80px' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <IntervalToggle value={interval} onChange={setBillingInterval} />
        </div>

        <div className="landing-grid-4" style={{ display: 'grid', gap: 16, alignItems: 'stretch' }}>
          {PLANS.map((plan, i) => {
            const shown = monthlyEquivalent(plan, interval);
            const features = [
              `${plan.includedMinutes.toLocaleString('en-IN')} minutes / month (≈ ${plan.approxCalls} calls)`,
              `${plan.concurrentCalls} simultaneous call${plan.concurrentCalls > 1 ? 's' : ''}`,
              plan.premiumVoiceAddonInr === null
                ? 'Premium voices included'
                : `Premium voices add-on ${inr(plan.premiumVoiceAddonInr)}/mo`,
              `${plan.kbDocs} knowledge-base documents`,
              plan.teamMembers === null ? 'Unlimited team members'
                : plan.teamMembers === 0 ? 'Owner account only'
                : `${plan.teamMembers} team member${plan.teamMembers > 1 ? 's' : ''}`,
              'Extra minutes: top-up packs from ₹18/min',
              plan.support,
            ];
            return (
              <Reveal key={plan.id} delay={i * 80} style={{ height: '100%' }}>
                <SpotlightCard
                  style={{
                    padding: 26, height: '100%', display: 'flex', flexDirection: 'column',
                    ...(plan.featured ? {
                      background: 'rgba(33,241,168,.07)',
                      border: '1px solid rgba(33,241,168,.3)',
                      boxShadow: '0 0 48px rgba(33,241,168,.12), 0 0 0 1px rgba(15,201,138,.15)',
                    } : {}),
                  }}
                >
                  {plan.featured && (
                    <div style={{
                      position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, #21F1A8, #0FC98A)',
                      color: '#171717', fontSize: 10, fontWeight: 700,
                      padding: '3px 12px', borderRadius: '0 0 8px 8px',
                      letterSpacing: '.08em', textTransform: 'uppercase',
                    }}>
                      Most Popular
                    </div>
                  )}

                  <Pill
                    bg={plan.featured ? 'rgba(33,241,168,.15)' : 'rgba(115,115,115,.2)'}
                    fg={plan.featured ? color.blueLight : color.text2}
                    border={plan.featured ? 'rgba(33,241,168,.3)' : color.border}
                    style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16, alignSelf: 'flex-start', marginTop: plan.featured ? 12 : 0 }}
                  >
                    {plan.name}
                  </Pill>

                  <div style={{ marginBottom: 2 }}>
                    <span style={{
                      fontSize: 34, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1,
                      fontFamily: font.mono, color: plan.featured ? color.blueLight : color.text1,
                    }}>
                      {inr(shown)}
                    </span>
                    <span style={{ fontSize: 12.5, color: color.text3, marginLeft: 4 }}>/ month + GST</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: color.text3, marginBottom: 4 }}>
                    {interval === 'year'
                      ? `Billed ${inr(plan.annualInr)}/year (${inr(withGst(plan.annualInr))} with GST)`
                      : `${inr(withGst(plan.monthlyInr))}/month with GST`}
                  </div>
                  <div style={{ fontSize: 11.5, color: color.text3, marginBottom: 4 }}>
                    {interval === 'year' || plan.setupFeeInr === 0
                      ? (plan.setupFeeInr === 0 ? 'No setup fee' : 'Setup fee waived')
                      : `+ ${inr(plan.setupFeeInr)} one-time setup`}
                  </div>

                  <p style={{ fontSize: 12.5, color: color.text2, marginTop: 10, marginBottom: 18, lineHeight: 1.5 }}>
                    {plan.tagline}
                  </p>

                  <hr style={{ border: 'none', borderTop: `1px solid ${color.border}`, marginBottom: 18 }} />

                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, flex: 1, padding: 0, margin: 0 }}>
                    {features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: color.text2 }}>
                        <Check size={13} style={{ color: color.emerald, flexShrink: 0, marginTop: 2 }} strokeWidth={2.5} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div style={{ marginTop: 20, display: 'grid' }}>
                    {plan.featured ? (
                      <PrimaryButton to="/register" size="md">
                        <span style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Start Free Trial <ArrowRight size={13} /></span>
                      </PrimaryButton>
                    ) : (
                      <SecondaryButton to="/register" size="md">
                        <span style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Start Free Trial <ArrowRight size={13} /></span>
                      </SecondaryButton>
                    )}
                  </div>
                  <p style={{ textAlign: 'center', fontSize: 10.5, color: color.text3, marginTop: 9 }}>
                    7-day free trial · No credit card
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: Included in every plan ─────────────────────────────────────────
function IncludedStrip() {
  return (
    <section style={{ padding: '0 0 56px' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal>
          <div style={{ ...cardStyle({ padding: 24 }) }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: color.text3, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 14px' }}>
              Every plan includes
            </p>
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px 24px',
            }}>
              {ALL_PLANS_INCLUDE.map((f) => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: color.text2 }}>
                  <Check size={13} style={{ color: color.emerald, flexShrink: 0, marginTop: 3 }} strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── SECTION: Top-up packs ───────────────────────────────────────────────────
function TopupSection() {
  return (
    <section id="topups" style={{ padding: '60px 0', borderTop: `1px solid ${color.border}` }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
          <SectionEyebrow>Need more minutes?</SectionEyebrow>
          <SectionHeading style={{ fontSize: 'clamp(22px, 3vw, 32px)' }}>
            Top up without <GradientText>changing plans</GradientText>
          </SectionHeading>
          <p style={{ fontSize: 14, color: color.text2, marginTop: 10, lineHeight: 1.6 }}>
            Prepaid packs are used after your monthly minutes run out and stay valid for {TOPUP_VALIDITY_DAYS} days.
            Buy them any time from the Billing page — no automatic overage charges.
          </p>
        </Reveal>

        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', maxWidth: 560, margin: '0 auto' }}>
          {TOPUP_PACKS.map((pack, i) => (
            <Reveal key={pack.id} delay={i * 80}>
              <div style={{ ...cardStyle({ padding: 22, textAlign: 'center' }) }}>
                <IconChip icon={RefreshCw} bg="rgba(16,185,129,.12)" fg={color.emerald} style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: color.text1, margin: '0 0 4px' }}>{pack.minutes} minutes</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: color.text1, fontFamily: font.mono, margin: '0 0 4px' }}>{inr(pack.priceInr)}</p>
                <p style={{ fontSize: 12, color: color.text2, margin: 0 }}>₹{pack.priceInr / pack.minutes}/min · + GST</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: Feature comparison table ───────────────────────────────────────
const GRID_COLS = `2fr ${PLANS.map(() => '1fr').join(' ')}`;

function ComparisonTable() {
  return (
    <section style={{ padding: '80px 0', borderTop: `1px solid ${color.border}` }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto 52px' }}>
          <SectionEyebrow>Full comparison</SectionEyebrow>
          <SectionHeading>Everything side by side</SectionHeading>
          <p style={{ fontSize: 14, color: color.text2, marginTop: 10, lineHeight: 1.6 }}>
            All prices are in ₹ and exclude 18% GST.
          </p>
        </Reveal>

        <Reveal>
          <div style={{ border: `1px solid ${color.border}`, borderRadius: 18, overflow: 'auto' }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, background: color.bgSoft, borderBottom: `1px solid ${color.border}` }}>
                <div style={{ padding: '16px 20px', fontSize: 12, fontWeight: 700, color: color.text3, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Feature
                </div>
                {PLANS.map((plan) => (
                  <div key={plan.id} style={{
                    padding: '16px 14px', textAlign: 'center', fontSize: 13, fontWeight: 700,
                    color: plan.featured ? color.blueLight : color.text1,
                    background: plan.featured ? 'rgba(33,241,168,.05)' : 'transparent',
                    borderLeft: `1px solid ${color.border}`,
                  }}>
                    {plan.name}
                    {plan.featured && (
                      <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: color.blueLight, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2 }}>
                        ★ Popular
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {TABLE_DATA.map((section, sIdx) => (
                <div key={section.category}>
                  <div style={{
                    padding: '10px 20px 8px', background: 'rgba(255,255,255,0.02)',
                    borderBottom: `1px solid ${color.border}`, borderTop: sIdx > 0 ? `1px solid ${color.border}` : 'none',
                  }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: color.text3, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                      {section.category}
                    </span>
                  </div>
                  {section.rows.map((r, rIdx) => (
                    <div key={r.label} style={{
                      display: 'grid', gridTemplateColumns: GRID_COLS,
                      borderBottom: rIdx < section.rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                      <div style={{ padding: '13px 20px', fontSize: 13, color: color.text2 }}>{r.label}</div>
                      {PLANS.map((plan) => (
                        <div key={plan.id} style={{
                          padding: '13px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                          borderLeft: `1px solid ${color.border}`,
                          background: plan.featured ? 'rgba(33,241,168,.04)' : 'transparent',
                        }}>
                          <Cell value={r.values[plan.id]} isGrowth={plan.featured} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, background: color.bgSoft, borderTop: `1px solid ${color.border}` }}>
                <div style={{ padding: 20, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: color.text3 }}>Ready to get started?</span>
                </div>
                {PLANS.map((plan) => (
                  <div key={plan.id} style={{
                    padding: 20, borderLeft: `1px solid ${color.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: plan.featured ? 'rgba(33,241,168,.05)' : 'transparent',
                  }}>
                    <Link
                      to="/register"
                      style={{
                        padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                        ...(plan.featured
                          ? { background: 'linear-gradient(135deg, #21F1A8, #0FC98A)', color: '#171717' }
                          : { background: 'transparent', color: color.text1, border: `1px solid ${color.borderStrong}` }),
                      }}
                    >
                      Start Free Trial
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── SECTION: Trust strip ─────────────────────────────────────────────────────
function TrustStrip() {
  const items: { icon: typeof ShieldCheck; label: string; desc: string }[] = [
    { icon: ShieldCheck, label: 'GST-compliant invoicing', desc: 'Automatic, every billing cycle' },
    { icon: Clock, label: '7-day free trial', desc: 'No credit card required' },
    { icon: Languages, label: 'Hindi · English · Punjabi', desc: 'Language detected on every call' },
  ];
  return (
    <section style={{ padding: '20px 0 60px' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <div className="landing-grid-3" style={{ display: 'grid', gap: 14 }}>
          {items.map(({ icon: Icon, label, desc }, i) => (
            <Reveal key={label} delay={i * 60}>
              <div style={{ ...cardStyle({ padding: 18, display: 'flex', alignItems: 'center', gap: 12 }) }}>
                <IconChip icon={Icon} bg="rgba(33,241,168,.12)" fg={color.blueLight} style={{ marginBottom: 0, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: color.text1, margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 11.5, color: color.text3, margin: 0 }}>{desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: FAQ accordion ───────────────────────────────────────────────────
function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section style={{ padding: '80px 0', borderTop: `1px solid ${color.border}` }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <SectionEyebrow>FAQ</SectionEyebrow>
          <SectionHeading>Common questions</SectionHeading>
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={i} delay={i * 40}>
                <div style={{
                  ...cardStyle({ padding: 0 }),
                  border: isOpen ? '1px solid rgba(33,241,168,.3)' : `1px solid ${color.border}`,
                  background: isOpen ? 'rgba(33,241,168,.04)' : color.surface,
                  transition: 'border-color 0.25s, background 0.25s',
                }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%', textAlign: 'left', padding: '18px 22px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: color.text1, fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{faq.q}</span>
                    <span style={{
                      flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                      background: isOpen ? 'rgba(33,241,168,.2)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isOpen ? color.blueLight : color.text3,
                      transition: 'transform 0.25s, background 0.25s, color 0.25s',
                      transform: isOpen ? 'rotate(45deg)' : 'none',
                    }}>
                      <Plus size={12} strokeWidth={2.5} />
                    </span>
                  </button>
                  <div style={{ maxHeight: isOpen ? 400 : 0, overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                    <p style={{ padding: '0 22px 18px', fontSize: 13.5, color: color.text2, lineHeight: 1.65, margin: 0 }}>
                      {faq.a}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={100} style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ fontSize: 13, color: color.text3 }}>
            Still have questions?{' '}
            <Link to="/contact" style={{ color: color.blueLight, textDecoration: 'none', fontWeight: 600 }}>
              Talk to us →
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── SECTION: Bottom CTA ──────────────────────────────────────────────────────
function CtaSection() {
  return (
    <section style={{ padding: '100px 0', position: 'relative', overflow: 'hidden', borderTop: `1px solid ${color.border}` }}>
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none', willChange: 'transform',
        width: 500, height: 350, background: 'radial-gradient(circle, rgba(33,241,168,.15) 0%, transparent 70%)',
        top: -80, left: -80, animationName: 'floatA', animationDuration: '10s', animationIterationCount: 'infinite',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none', willChange: 'transform',
        width: 450, height: 300, background: 'radial-gradient(circle, rgba(15,201,138,.12) 0%, transparent 70%)',
        bottom: -80, right: -80, animationName: 'floatA', animationDuration: '10s', animationDelay: '-5s', animationIterationCount: 'infinite',
      }} />

      <Reveal style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 640, margin: '0 auto', padding: '0 20px' }}>
        <Pill bg="rgba(16,185,129,.12)" fg={color.emerald} border="rgba(16,185,129,.25)" live style={{ marginBottom: 20 }}>
          Your AI agent is ready to go live
        </Pill>

        <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 50px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: 14, fontFamily: font.display }}>
          Start your <GradientText>free 7-day trial</GradientText>
        </h2>

        <p style={{ fontSize: 16, color: color.text2, marginBottom: 32, lineHeight: 1.6 }}>
          Full Basic-plan features. No credit card. Live in 30 minutes.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <PrimaryButton to="/register" size="lg">
            Start Free Trial <ArrowRight size={14} />
          </PrimaryButton>
          <Link
            to="/contact"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '14px 22px', borderRadius: 9, fontSize: 15, fontWeight: 700,
              color: color.text1, textDecoration: 'none',
              border: `1px solid ${color.borderStrong}`, background: 'transparent',
            }}
          >
            Talk to Sales
          </Link>
        </div>

        <p style={{ marginTop: 20, fontSize: 11.5, color: color.text3 }}>
          No credit card · GST invoices · Plans from ₹4,999/month · Cancel anytime
        </p>
      </Reveal>
    </section>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function PricingPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="landing-page">
      <HeroSection />
      <PricingCards />
      <IncludedStrip />
      <TrustStrip />
      <TopupSection />
      <ComparisonTable />
      <FaqAccordion />
      <CtaSection />
    </div>
  );
}
