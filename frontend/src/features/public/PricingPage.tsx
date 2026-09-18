/**
 * L3.F2 — PricingPage (Full Implementation)
 * Route: /pricing (public)
 *
 * Source of truth: main-project-docs/AgentOps Studio — SaaS Pricing & Stripe
 * Setup.md (2026-09-17). Customer-facing plan names: Basic / Standard / Pro
 * (internal enum values are unchanged: starter / growth / enterprise).
 *
 * No annual billing option — the current pricing model is monthly-only
 * (removed the old annual toggle, which had no backing Stripe price).
 *
 * Sections:
 *   1. Hero — headline + trust copy
 *   2. Pricing cards — Basic / Standard (featured) / Pro, with GST + setup fee
 *   3. Feature comparison table
 *   4. Recharge packs — informational (no purchase flow exists yet)
 *   5. FAQ accordion
 *   6. Bottom CTA
 *
 * Design: reuses the shared landing design system (tokens/primitives/landing.css)
 * built for HomePage.tsx — same spotlight cards, gradient text, mono data labels.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Plus, ArrowRight, RefreshCw, ShieldCheck, Clock, Building2,
} from 'lucide-react';
import '../public/landing/landing.css';
import { color, font, maxW } from '../public/landing/tokens';
import {
  GradientText, Pill, Reveal, SectionEyebrow, SectionHeading,
  SpotlightCard, PrimaryButton, SecondaryButton, IconChip, cardStyle,
} from '../public/landing/primitives';

// ─── Plan data — source of truth: pricing doc §2, §10 ────────────────────────
type CtaStyle = 'outline' | 'primary';

const PLANS = [
  {
    id: 'starter',
    name: 'Basic',
    tagline: 'Solo shops, <10 calls/day',
    price: 9_999,
    gst: 1_800,
    total: 11_799,
    setupFee: 9_999,
    overageRate: '₹25/min',
    features: [
      '500 minutes / month',
      '1 AI assistant',
      '1 voice (standard Hindi/English)',
      '50 KB knowledge base',
      'Google Sheets + WhatsApp alerts',
      'Call logging, basic routing',
      'Call logs analytics',
      '1 concurrent call',
      'Email support (business hours)',
    ],
    notIncluded: [
      'Order capture & appointment booking',
      'CRM / n8n / Razorpay integrations',
      'Sentiment analysis',
    ],
    ctaStyle: 'outline' as CtaStyle,
    featured: false,
    badgeBg: 'rgba(100,116,139,.2)', badgeColor: color.text2, badgeBdr: color.border,
    accentColor: color.text2,
  },
  {
    id: 'growth',
    name: 'Standard',
    tagline: 'Active businesses, 10–30 calls/day',
    price: 17_999,
    gst: 3_240,
    total: 21_239,
    setupFee: 14_999,
    overageRate: '₹20/min',
    features: [
      '1,000 minutes / month',
      '3 AI assistants',
      '3 voices',
      '200 KB knowledge base',
      '+ CRM, n8n workflows, Razorpay',
      '+ Order capture, appointment booking',
      'Call trends, sentiment analysis',
      '2 concurrent calls',
      'Priority email + WhatsApp support',
    ],
    notIncluded: [],
    ctaStyle: 'primary' as CtaStyle,
    featured: true,
    badgeBg: 'rgba(59,130,246,.15)', badgeColor: color.blueLight, badgeBdr: 'rgba(59,130,246,.3)',
    accentColor: color.blueLight,
  },
  {
    id: 'enterprise',
    name: 'Pro',
    tagline: 'Multi-branch, high volume',
    price: 25_999,
    gst: 4_680,
    total: 30_679,
    setupFee: 24_999,
    overageRate: '₹18/min',
    features: [
      '1,500 minutes / month',
      '5 AI assistants',
      'All voices + custom voice cloning',
      '500 KB knowledge base',
      'Unlimited integrations',
      'Full automation suite + custom workflows',
      'Full analytics + monthly reports',
      '3 concurrent calls',
      'Dedicated account manager',
      'Fair-use cap: 3,000 min',
    ],
    notIncluded: [],
    ctaStyle: 'outline' as CtaStyle,
    featured: false,
    badgeBg: 'rgba(139,92,246,.15)', badgeColor: color.violetLight, badgeBdr: 'rgba(139,92,246,.3)',
    accentColor: color.violetLight,
  },
];

// ─── Recharge packs — informational only, no purchase flow built yet ────────
const RECHARGE_PACKS = [
  { name: 'Starter', price: '₹2,000', minutes: '100 min', rate: '₹20/min' },
  { name: 'Growth', price: '₹4,500', minutes: '250 min', rate: '₹18/min' },
  { name: 'Mega', price: '₹8,000', minutes: '500 min', rate: '₹16/min' },
];

// ─── Feature comparison table data ───────────────────────────────────────────
type CellValue = string | boolean;
interface TableSection {
  category: string;
  rows: { label: string; starter: CellValue; growth: CellValue; enterprise: CellValue }[];
}

const TABLE_DATA: TableSection[] = [
  {
    category: 'Core',
    rows: [
      { label: 'Included minutes / month', starter: '500', growth: '1,000', enterprise: '1,500' },
      { label: 'Effective ₹/min', starter: '₹20.00', growth: '₹18.00', enterprise: '₹17.33' },
      { label: 'AI assistants', starter: '1', growth: '3', enterprise: '5' },
      { label: 'Concurrent calls', starter: '1', growth: '2', enterprise: '3' },
    ],
  },
  {
    category: 'Voice & Knowledge Base',
    rows: [
      { label: 'Voice options', starter: '1 (standard)', growth: '3 voices', enterprise: 'All + custom cloning' },
      { label: 'Knowledge base', starter: '50 KB', growth: '200 KB', enterprise: '500 KB' },
    ],
  },
  {
    category: 'Integrations & Automation',
    rows: [
      { label: 'Integrations', starter: 'Google Sheets, WhatsApp', growth: '+ CRM, n8n, Razorpay', enterprise: 'Unlimited' },
      { label: 'Automation', starter: 'Call logging, basic routing', growth: '+ Order capture, booking', enterprise: 'Full suite + custom' },
      { label: 'Analytics', starter: 'Call logs', growth: 'Trends, sentiment', enterprise: 'Full + monthly reports' },
    ],
  },
  {
    category: 'Billing & Support',
    rows: [
      { label: 'Additional minutes', starter: '₹25/min', growth: '₹20/min', enterprise: '₹18/min' },
      { label: 'Usage limit', starter: 'Hard cap', growth: 'Soft cap + overage', enterprise: 'Soft cap, 3,000 fair-use' },
      { label: 'Support', starter: 'Email (business hours)', growth: 'Priority email + WhatsApp', enterprise: 'Dedicated account manager' },
      { label: 'One-time setup fee', starter: '₹9,999', growth: '₹14,999', enterprise: '₹24,999' },
    ],
  },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Do I need a developer to set this up?',
    a: 'No. AgentOps Studio is built for non-technical founders. You enter your business details, paste your website URL, and your AI agent is live in under 30 minutes. No code, no API keys to configure, no DevOps.',
  },
  {
    q: 'What happens if I exceed my monthly minutes?',
    a: 'Once you hit your plan’s included minutes, new calls pause until the next billing cycle, you upgrade, or you add a recharge pack (see below) — we never auto-charge you for overage. Standard and Pro rates for additional capacity are ₹20/min and ₹18/min respectively, with Pro covering up to a 3,000-minute fair-use ceiling.',
  },
  {
    q: 'Can I use my existing phone number?',
    a: 'Yes. You can route calls from your existing Vobiz or similar SIP number through AgentOps Studio. Our provisioning wizard walks you through the one-time configuration.',
  },
  {
    q: 'How does the free trial work?',
    a: 'Every new account gets a 7-day free trial with 30 included minutes and the full Basic-plan feature set — no credit card required. If you haven’t picked a plan by day 7, your agent pauses (it stops answering calls) but your data stays intact for 30 days.',
  },
  {
    q: 'Is pricing in Indian Rupees? Are GST invoices available?',
    a: 'Yes and yes. All plans are priced in ₹ INR plus 18% GST, shown as separate line items. GST-compliant invoices (with your GSTIN) are issued automatically every billing cycle and downloadable from your billing portal.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'You can upgrade at any time — it takes effect immediately. Downgrades and cancellations are handled via support to make sure your call minutes and knowledge base data are preserved correctly.',
  },
  {
    q: 'Is there a setup fee?',
    a: 'Yes — a one-time setup fee (₹9,999 / ₹14,999 / ₹24,999 depending on plan) covers VAPI configuration, catalog upload, phone provisioning, and onboarding support. It’s billed once on your first invoice, alongside your first month’s subscription.',
  },
];

// ─── Cell renderer ────────────────────────────────────────────────────────────
function Cell({ value, isGrowth }: { value: CellValue; isGrowth: boolean }) {
  if (value === true) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: '50%',
        background: isGrowth ? 'rgba(59,130,246,.15)' : 'rgba(16,185,129,.12)',
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
        { w: 500, h: 400, c: 'rgba(59,130,246,.12)', top: -120, left: '10%', dur: 12 },
        { w: 400, h: 400, c: 'rgba(139,92,246,.1)', top: -80, right: '8%', dur: 15 },
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
            Loved by 200+ Indian businesses
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
function PricingCards() {
  return (
    <section style={{ padding: '32px 0 80px' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <div className="landing-grid-3" style={{ display: 'grid', gap: 16, alignItems: 'stretch' }}>
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 80} style={{ height: '100%' }}>
              <SpotlightCard
                style={{
                  padding: 28, height: '100%', display: 'flex', flexDirection: 'column',
                  ...(plan.featured ? {
                    background: 'rgba(59,130,246,.07)',
                    border: '1px solid rgba(59,130,246,.3)',
                    boxShadow: '0 0 48px rgba(59,130,246,.12), 0 0 0 1px rgba(139,92,246,.15)',
                    transform: 'translateY(-4px)',
                  } : {}),
                }}
              >
                {plan.featured && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    padding: '3px 12px', borderRadius: '0 0 8px 8px',
                    letterSpacing: '.08em', textTransform: 'uppercase',
                  }}>
                    Most Popular
                  </div>
                )}

                <Pill
                  bg={plan.badgeBg} fg={plan.badgeColor} border={plan.badgeBdr}
                  style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16, alignSelf: 'flex-start', marginTop: plan.featured ? 12 : 0 }}
                >
                  {plan.name}
                </Pill>

                <div style={{ marginBottom: 2 }}>
                  <span style={{
                    fontSize: 40, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1,
                    fontFamily: font.mono, color: plan.featured ? color.blueLight : color.text1,
                  }}>
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontSize: 13, color: color.text3, marginLeft: 4 }}>/ month + GST</span>
                </div>
                <div style={{ fontSize: 11.5, color: color.text3, marginBottom: 4 }}>
                  ₹{plan.total.toLocaleString('en-IN')} total with GST (₹{plan.gst.toLocaleString('en-IN')})
                </div>
                <div style={{ fontSize: 11.5, color: color.text3, marginBottom: 4 }}>
                  + ₹{plan.setupFee.toLocaleString('en-IN')} one-time setup fee
                </div>

                <p style={{ fontSize: 12.5, color: color.text2, marginTop: 10, marginBottom: 18, lineHeight: 1.5 }}>
                  {plan.tagline}
                </p>

                <hr style={{ border: 'none', borderTop: `1px solid ${color.border}`, marginBottom: 18 }} />

                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, flex: 1, marginBottom: 24, padding: 0, margin: 0 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: color.text2 }}>
                      <Check size={13} style={{ color: color.emerald, flexShrink: 0, marginTop: 2 }} strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: color.text3 }}>
                      <span style={{ fontWeight: 700, flexShrink: 0, marginTop: 1 }}>–</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* display:grid stretches the single Link child to full width
                    (grid's default justify-items:stretch) without needing a
                    style-override prop on the shared button primitives. */}
                <div style={{ marginTop: 20, display: 'grid' }}>
                  {plan.ctaStyle === 'primary' ? (
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
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: Recharge packs (informational) ─────────────────────────────────
function RechargeSection() {
  return (
    <section style={{ padding: '60px 0', borderTop: `1px solid ${color.border}` }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 36px' }}>
          <SectionEyebrow>Need more minutes?</SectionEyebrow>
          <SectionHeading style={{ fontSize: 'clamp(22px, 3vw, 32px)' }}>
            Top up without <GradientText>changing plans</GradientText>
          </SectionHeading>
          <p style={{ fontSize: 14, color: color.text2, marginTop: 10, lineHeight: 1.6 }}>
            Recharge packs roll over for 6 months — buy one anytime your plan runs low. Talk to support to add one to your account.
          </p>
        </Reveal>

        <div className="landing-grid-3" style={{ display: 'grid', gap: 14 }}>
          {RECHARGE_PACKS.map((pack, i) => (
            <Reveal key={pack.name} delay={i * 80}>
              <div style={{ ...cardStyle({ padding: 22, textAlign: 'center' }) }}>
                <IconChip icon={RefreshCw} bg="rgba(16,185,129,.12)" fg={color.emerald} style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: color.text1, margin: '0 0 4px' }}>{pack.name}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: color.text1, fontFamily: font.mono, margin: '0 0 4px' }}>{pack.price}</p>
                <p style={{ fontSize: 12, color: color.text2, margin: 0 }}>{pack.minutes} · {pack.rate}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: Feature comparison table ───────────────────────────────────────
function ComparisonTable() {
  return (
    <section style={{ padding: '80px 0', borderTop: `1px solid ${color.border}` }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto 52px' }}>
          <SectionEyebrow>Full comparison</SectionEyebrow>
          <SectionHeading>Everything side by side</SectionHeading>
          <p style={{ fontSize: 14, color: color.text2, marginTop: 10, lineHeight: 1.6 }}>
            See exactly what each plan includes — no asterisks, no hidden limits.
          </p>
        </Reveal>

        <Reveal>
          <div style={{ border: `1px solid ${color.border}`, borderRadius: 18, overflow: 'auto' }}>
            <div style={{ minWidth: 640 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: color.bgSoft, borderBottom: `1px solid ${color.border}` }}>
                <div style={{ padding: '16px 20px', fontSize: 12, fontWeight: 700, color: color.text3, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Feature
                </div>
                {PLANS.map((plan, i) => (
                  <div key={plan.id} style={{
                    padding: '16px 20px', textAlign: 'center', fontSize: 13, fontWeight: 700,
                    color: i === 1 ? color.blueLight : color.text1,
                    background: i === 1 ? 'rgba(59,130,246,.05)' : 'transparent',
                    borderLeft: `1px solid ${color.border}`,
                  }}>
                    {plan.name}
                    {i === 1 && (
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
                  {section.rows.map((row, rIdx) => (
                    <div key={row.label} style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      borderBottom: rIdx < section.rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                      <div style={{ padding: '13px 20px', fontSize: 13, color: color.text2 }}>{row.label}</div>
                      {(['starter', 'growth', 'enterprise'] as const).map((planKey) => (
                        <div key={planKey} style={{
                          padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderLeft: `1px solid ${color.border}`,
                          background: planKey === 'growth' ? 'rgba(59,130,246,.04)' : 'transparent',
                        }}>
                          <Cell value={row[planKey]} isGrowth={planKey === 'growth'} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: color.bgSoft, borderTop: `1px solid ${color.border}` }}>
                <div style={{ padding: 20, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: color.text3 }}>Ready to get started?</span>
                </div>
                {PLANS.map((plan, i) => (
                  <div key={plan.id} style={{
                    padding: 20, borderLeft: `1px solid ${color.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i === 1 ? 'rgba(59,130,246,.05)' : 'transparent',
                  }}>
                    <Link
                      to="/register"
                      style={{
                        padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                        ...(i === 1
                          ? { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff' }
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
    { icon: Building2, label: 'Indian data residency', desc: 'Your data stays in India' },
  ];
  return (
    <section style={{ padding: '20px 0 60px' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <div className="landing-grid-3" style={{ display: 'grid', gap: 14 }}>
          {items.map(({ icon: Icon, label, desc }, i) => (
            <Reveal key={label} delay={i * 60}>
              <div style={{ ...cardStyle({ padding: 18, display: 'flex', alignItems: 'center', gap: 12 }) }}>
                <IconChip icon={Icon} bg="rgba(59,130,246,.12)" fg={color.blueLight} style={{ marginBottom: 0, flexShrink: 0 }} />
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
                  border: isOpen ? '1px solid rgba(59,130,246,.3)' : `1px solid ${color.border}`,
                  background: isOpen ? 'rgba(59,130,246,.04)' : color.surface,
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
                      background: isOpen ? 'rgba(59,130,246,.2)' : 'rgba(255,255,255,0.06)',
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
        width: 500, height: 350, background: 'radial-gradient(circle, rgba(59,130,246,.15) 0%, transparent 70%)',
        top: -80, left: -80, animationName: 'floatA', animationDuration: '10s', animationIterationCount: 'infinite',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none', willChange: 'transform',
        width: 450, height: 300, background: 'radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%)',
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
          No credit card · GST invoices · Indian data residency · Cancel anytime
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
      <TrustStrip />
      <RechargeSection />
      <ComparisonTable />
      <FaqAccordion />
      <CtaSection />
    </div>
  );
}
