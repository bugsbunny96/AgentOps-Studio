/**
 * L3.F2 — PricingPage (Full Implementation)
 * Route: /pricing (public)
 *
 * Sections:
 *   1. Hero — headline + annual/monthly toggle + social proof
 *   2. Pricing cards — Starter / Growth (featured) / Enterprise
 *   3. Feature comparison table — 5 categories
 *   4. FAQ accordion — 6 common questions
 *   5. Bottom CTA — routes to /register or /contact
 *
 * Design: same tokens, card/pill helpers, Reveal scroll-fade, and keyframes
 * as HomePage.tsx — zero external deps beyond react-router-dom.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// ─── Design tokens (identical to HomePage.tsx) ────────────────────────────────
const T = {
  bg: '#030712',
  bgS: '#0d1524',
  bgC: 'rgba(255,255,255,0.03)',
  bgCH: 'rgba(255,255,255,0.055)',
  bdr: 'rgba(255,255,255,0.07)',
  bdrB: 'rgba(255,255,255,0.12)',
  blue: '#3b82f6',
  blueL: '#60a5fa',
  violet: '#8b5cf6',
  em: '#10b981',
  amber: '#f59e0b',
  t1: '#f8fafc',
  t2: '#94a3b8',
  t3: '#475569',
};

// ─── Shared style helpers ─────────────────────────────────────────────────────
const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 11, fontWeight: 700, padding: '4px 10px',
  borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
});

const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: T.bgC,
  border: `1px solid ${T.bdr}`,
  borderRadius: 18,
  padding: 24,
  overflow: 'hidden',
  position: 'relative',
  transition: 'border-color 0.3s, transform 0.3s cubic-bezier(0.4,0,0.2,1)',
  ...extra,
});

// ─── Keyframes (same set as HomePage, namespaced to pricing page) ─────────────
const KEYFRAMES = `
  @keyframes pp-floatA {
    0%,100%{transform:translate(0,0) scale(1)}
    33%{transform:translate(25px,-18px) scale(1.04)}
    66%{transform:translate(-12px,20px) scale(.97)}
  }
  @keyframes pp-pulseDot {
    0%,100%{opacity:1;transform:scale(1)}
    50%{opacity:.5;transform:scale(.8)}
  }
  @keyframes pp-revealUp {
    from{opacity:0;transform:translateY(24px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes pp-checkPop {
    0%{transform:scale(0) rotate(-12deg);opacity:0}
    60%{transform:scale(1.2) rotate(2deg);opacity:1}
    100%{transform:scale(1) rotate(0);opacity:1}
  }
`;

function useInjectStyles() {
  useEffect(() => {
    const id = 'pp-keyframes';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = KEYFRAMES;
      document.head.appendChild(el);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold, rootMargin: '0px 0px -30px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.65s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.65s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Billing toggle ───────────────────────────────────────────────────────────
function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: !annual ? T.t1 : T.t3 }}>Monthly</span>
      <button
        onClick={() => onChange(!annual)}
        aria-pressed={annual}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: annual ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : T.bdr,
          position: 'relative', transition: 'background 0.3s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: annual ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
        }} />
      </button>
      <span style={{ fontSize: 13, fontWeight: 600, color: annual ? T.t1 : T.t3 }}>
        Annual
        <span style={{
          marginLeft: 6,
          ...pill('rgba(16,185,129,.15)', T.em, 'rgba(16,185,129,.25)'),
          fontSize: 10, fontWeight: 700, padding: '2px 7px',
        }}>
          Save 33%
        </span>
      </span>
    </div>
  );
}

// ─── Plan data ────────────────────────────────────────────────────────────────
type CtaStyle = 'outline' | 'primary';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For solopreneurs & micro-teams',
    monthlyPrice: 2999,
    annualPrice: 1999,
    annualTotal: 23988,
    desc: 'Everything you need to get your AI receptionist live fast — ideal up to 500 calls/month.',
    features: [
      '1 AI voice agent',
      '500 minutes / month',
      'English language',
      'Basic analytics (call count + duration)',
      '5 manual KB documents',
      '1 team member',
      'Email support',
    ],
    notIncluded: [
      'Hindi / Punjabi',
      'Custom agent persona',
      'Website crawler',
      'Call transcripts & AI summaries',
    ],
    cta: 'Start Free Trial',
    ctaStyle: 'outline' as CtaStyle,
    ctaLink: '/register',
    featured: false,
    badgeBg: 'rgba(100,116,139,.2)', badgeColor: T.t2, badgeBdr: T.bdr,
    accentColor: T.t2,
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'For growing teams — most popular',
    monthlyPrice: 7999,
    annualPrice: 5999,
    annualTotal: 71988,
    desc: 'Full multi-language support, deep analytics, and team collaboration for scaling businesses.',
    features: [
      '3 AI voice agents',
      '2,000 minutes / month',
      'Hindi + English + Punjabi',
      'Full analytics dashboard',
      'Custom agent name & persona',
      'Website crawler + 50 KB docs',
      'Call transcripts & AI summaries',
      'Fallback transfer number',
      'Up to 5 team members',
      'Priority email support',
    ],
    notIncluded: [],
    cta: 'Start Free Trial',
    ctaStyle: 'primary' as CtaStyle,
    ctaLink: '/register',
    featured: true,
    badgeBg: 'rgba(59,130,246,.15)', badgeColor: T.blueL, badgeBdr: 'rgba(59,130,246,.3)',
    accentColor: T.blueL,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large teams & complex deployments',
    monthlyPrice: null,
    annualPrice: null,
    annualTotal: null,
    desc: 'Unlimited agents, custom SLA, dedicated support, and integrations built around your stack.',
    features: [
      'Unlimited AI agents',
      'Unlimited minutes',
      'All languages + custom',
      'Custom CRM / helpdesk integrations',
      '99.9% uptime SLA',
      'Dedicated account manager',
      'Custom onboarding program',
      'SSO / SAML',
      'Indian data residency SLA',
      'Custom contract & invoicing',
    ],
    notIncluded: [],
    cta: 'Contact Sales →',
    ctaStyle: 'outline' as CtaStyle,
    ctaLink: '/contact',
    featured: false,
    badgeBg: 'rgba(139,92,246,.15)', badgeColor: '#a78bfa', badgeBdr: 'rgba(139,92,246,.3)',
    accentColor: '#a78bfa',
  },
];

// ─── Feature comparison table data ───────────────────────────────────────────
type CellValue = string | boolean;

interface TableSection {
  category: string;
  rows: { label: string; starter: CellValue; growth: CellValue; enterprise: CellValue }[];
}

const TABLE_DATA: TableSection[] = [
  {
    category: 'AI Voice Agent',
    rows: [
      { label: 'Number of agents', starter: '1', growth: '3', enterprise: 'Unlimited' },
      { label: 'Languages', starter: 'English', growth: 'EN + HI + PA', enterprise: 'All + custom' },
      { label: 'Custom agent name', starter: false, growth: true, enterprise: true },
      { label: 'Voice selection', starter: true, growth: true, enterprise: true },
    ],
  },
  {
    category: 'Minutes & Usage',
    rows: [
      { label: 'Included minutes / month', starter: '500', growth: '2,000', enterprise: 'Unlimited' },
      { label: 'Overage rate (per minute)', starter: '₹6', growth: '₹4', enterprise: 'Negotiated' },
      { label: 'Concurrent calls', starter: '1', growth: '5', enterprise: 'Custom' },
    ],
  },
  {
    category: 'Knowledge Base',
    rows: [
      { label: 'Website crawler', starter: false, growth: true, enterprise: true },
      { label: 'Manual text documents', starter: '5 docs', growth: '50 docs', enterprise: 'Unlimited' },
      { label: 'FAQ import', starter: false, growth: true, enterprise: true },
    ],
  },
  {
    category: 'Analytics & Transcripts',
    rows: [
      { label: 'Basic call metrics', starter: true, growth: true, enterprise: true },
      { label: 'Full analytics dashboard', starter: false, growth: true, enterprise: true },
      { label: 'Call transcripts', starter: false, growth: true, enterprise: true },
      { label: 'AI call summaries', starter: false, growth: true, enterprise: true },
    ],
  },
  {
    category: 'Team & Support',
    rows: [
      { label: 'Team members', starter: '1', growth: '5', enterprise: 'Unlimited' },
      { label: 'Role-based permissions', starter: false, growth: true, enterprise: true },
      { label: 'Email support', starter: true, growth: true, enterprise: true },
      { label: 'Priority support', starter: false, growth: true, enterprise: true },
      { label: 'Dedicated account manager', starter: false, growth: false, enterprise: true },
      { label: '99.9% uptime SLA', starter: false, growth: false, enterprise: true },
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
    a: 'We never cut off your calls mid-month. Overages are billed at the per-minute rate for your plan (₹6/min on Starter, ₹4/min on Growth) and appear on your next invoice. You can set a spend alert in your dashboard.',
  },
  {
    q: 'Can I use my existing phone number?',
    a: 'Yes. You can route calls from your existing Vobiz or similar SIP number through AgentOps Studio. Our provisioning wizard walks you through the one-time configuration.',
  },
  {
    q: 'How does the 30-day free trial work?',
    a: 'Start with full Growth-plan features for 30 days. No credit card required. At the end of your trial, choose a plan or your workspace is automatically paused — your data stays intact for 90 days.',
  },
  {
    q: 'Is pricing in Indian Rupees? Are GST invoices available?',
    a: 'Yes and yes. All plans are priced in ₹ INR. GST-compliant invoices (with your GSTIN) are issued automatically every billing cycle and downloadable from your billing portal.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'You can upgrade or downgrade at any time. Upgrades take effect immediately (prorated). Downgrades take effect at the next billing cycle. Cancellations can be done in one click — no retention maze.',
  },
];

// ─── Cell renderer ────────────────────────────────────────────────────────────
function Cell({ value, isGrowth }: { value: CellValue; isGrowth: boolean }) {
  const accentColor = isGrowth ? T.blueL : T.em;

  if (value === true) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: '50%',
        background: isGrowth ? 'rgba(59,130,246,.15)' : 'rgba(16,185,129,.12)',
        color: accentColor, fontSize: 11, fontWeight: 800,
        animationName: 'pp-checkPop', animationDuration: '0.3s', animationFillMode: 'both',
      }}>
        ✓
      </span>
    );
  }
  if (value === false) {
    return <span style={{ color: T.t3, fontSize: 13 }}>—</span>;
  }
  return <span style={{ fontSize: 12.5, fontWeight: 600, color: T.t2 }}>{value}</span>;
}

// ─── SECTION: Hero + toggle ───────────────────────────────────────────────────
function HeroSection({ annual, setAnnual }: { annual: boolean; setAnnual: (v: boolean) => void }) {
  return (
    <section
      style={{
        padding: '80px 0 48px',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      {/* Grid dot background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)',
        backgroundSize: '50px 50px',
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
      }} />

      {/* Aurora blobs */}
      {[
        { w: 500, h: 400, color: 'rgba(59,130,246,.12)', top: -120, left: '10%', dur: 12 },
        { w: 400, h: 400, color: 'rgba(139,92,246,.1)', top: -80, right: '8%', dur: 15 },
      ].map(({ w, h, color, dur, ...pos }, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
          willChange: 'transform', width: w, height: h,
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          animationName: 'pp-floatA', animationDuration: `${dur}s`,
          animationDelay: `${-i * 4}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          ...pos,
        } as React.CSSProperties} />
      ))}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '0 20px' }}>
        <Reveal>
          <span style={{
            ...pill('rgba(16,185,129,.12)', T.em, 'rgba(16,185,129,.25)'),
            marginBottom: 20, display: 'inline-flex',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: 'currentColor',
              display: 'inline-block',
              animationName: 'pp-pulseDot', animationDuration: '2s', animationIterationCount: 'infinite',
            }} />
            200+ Indian businesses trust AgentOps Studio
          </span>
        </Reveal>

        <Reveal delay={80}>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 58px)',
            fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em',
            marginBottom: 14,
          }}>
            Simple pricing.{' '}
            <span style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #60a5fa 50%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              No surprises.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p style={{ fontSize: 16, color: T.t2, lineHeight: 1.65, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            All plans are priced in ₹ INR, include GST invoicing, and start with a
            full-featured <strong style={{ color: T.t1 }}>30-day free trial</strong>. No credit card required.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <BillingToggle annual={annual} onChange={setAnnual} />
          {annual && (
            <p style={{ marginTop: 10, fontSize: 12, color: T.em }}>
              Annual plans save you up to ₹24,000 / year — billed once, renews annually.
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}

// ─── SECTION: Pricing cards ───────────────────────────────────────────────────
function PricingCards({ annual }: { annual: boolean }) {
  const fmtPrice = (p: number | null) => {
    if (p === null) return 'Custom';
    return `₹${p.toLocaleString('en-IN')}`;
  };

  return (
    <section style={{ padding: '0 0 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          alignItems: 'stretch',
        }}>
          {PLANS.map((plan, i) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            return (
              <Reveal key={plan.id} delay={i * 80}>
                <div style={{
                  ...card({ padding: 28, height: '100%' }),
                  ...(plan.featured ? {
                    background: 'rgba(59,130,246,.07)',
                    border: '1px solid rgba(59,130,246,.3)',
                    boxShadow: '0 0 48px rgba(59,130,246,.12), 0 0 0 1px rgba(139,92,246,.15)',
                    transform: 'translateY(-4px)',
                  } : {}),
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {/* Most popular badge */}
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

                  {/* Plan badge */}
                  <span style={{
                    ...pill(plan.badgeBg, plan.badgeColor, plan.badgeBdr),
                    fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
                    marginBottom: 16, display: 'inline-block',
                    marginTop: plan.featured ? 12 : 0,
                  }}>
                    {plan.name}
                  </span>

                  {/* Price */}
                  <div style={{ marginBottom: 4 }}>
                    <span style={{
                      fontSize: price !== null ? 44 : 36,
                      fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1,
                      color: plan.featured ? T.blueL : T.t1,
                    }}>
                      {fmtPrice(price)}
                    </span>
                    {price !== null && (
                      <span style={{ fontSize: 13, color: T.t3, marginLeft: 4 }}>/ month</span>
                    )}
                  </div>

                  {/* Annual billing note */}
                  {annual && plan.annualTotal !== null && (
                    <div style={{ fontSize: 11.5, color: T.t3, marginBottom: 4 }}>
                      ₹{plan.annualTotal.toLocaleString('en-IN')} billed annually
                    </div>
                  )}
                  {!annual && plan.monthlyPrice !== null && (
                    <div style={{ fontSize: 11.5, color: T.t3, marginBottom: 4 }}>
                      or ₹{plan.annualPrice?.toLocaleString('en-IN')}/mo billed annually
                    </div>
                  )}

                  <p style={{ fontSize: 12.5, color: T.t2, marginTop: 10, marginBottom: 18, lineHeight: 1.5 }}>
                    {plan.tagline}
                  </p>

                  <hr style={{ border: 'none', borderTop: `1px solid ${T.bdr}`, marginBottom: 18 }} />

                  {/* Features */}
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, flex: 1, marginBottom: 24 }}>
                    {plan.features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: T.t2 }}>
                        <span style={{ color: T.em, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                        {f}
                      </li>
                    ))}
                    {plan.notIncluded.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: T.t3 }}>
                        <span style={{ color: T.t3, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>–</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    to={plan.ctaLink}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '100%', padding: '11px 20px', borderRadius: 9,
                      fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
                      transition: 'opacity 0.2s, transform 0.2s',
                      ...(plan.ctaStyle === 'primary'
                        ? {
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            color: '#fff', border: 'none',
                            boxShadow: '0 0 0 1px rgba(139,92,246,.3), 0 4px 20px rgba(59,130,246,.25)',
                          }
                        : {
                            background: 'transparent',
                            color: T.t1,
                            border: `1px solid ${T.bdrB}`,
                          }),
                    }}
                  >
                    {plan.cta}
                  </Link>

                  {plan.ctaLink === '/register' && (
                    <p style={{ textAlign: 'center', fontSize: 10.5, color: T.t3, marginTop: 9 }}>
                      30-day free trial · No credit card
                    </p>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: Feature comparison table ───────────────────────────────────────
function ComparisonTable() {
  return (
    <section style={{ padding: '80px 0', borderTop: `1px solid ${T.bdr}` }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto 52px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.blueL, marginBottom: 10 }}>
            Full comparison
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.025em' }}>
            Everything side by side
          </h2>
          <p style={{ fontSize: 14, color: T.t2, marginTop: 10, lineHeight: 1.6 }}>
            See exactly what each plan includes — no asterisks, no hidden limits.
          </p>
        </Reveal>

        <Reveal>
          <div style={{
            border: `1px solid ${T.bdr}`,
            borderRadius: 18,
            overflow: 'hidden',
          }}>
            {/* Header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              background: T.bgS,
              borderBottom: `1px solid ${T.bdr}`,
            }}>
              <div style={{ padding: '16px 20px', fontSize: 12, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Feature
              </div>
              {['Starter', 'Growth', 'Enterprise'].map((name, i) => (
                <div
                  key={name}
                  style={{
                    padding: '16px 20px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: i === 1 ? T.blueL : T.t1,
                    background: i === 1 ? 'rgba(59,130,246,.05)' : 'transparent',
                    borderLeft: `1px solid ${T.bdr}`,
                  }}
                >
                  {name}
                  {i === 1 && (
                    <span style={{
                      display: 'block', fontSize: 9, fontWeight: 700,
                      color: T.blueL, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2,
                    }}>
                      ★ Popular
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Category sections */}
            {TABLE_DATA.map((section, sIdx) => (
              <div key={section.category}>
                {/* Category header */}
                <div style={{
                  padding: '10px 20px 8px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: `1px solid ${T.bdr}`,
                  borderTop: sIdx > 0 ? `1px solid ${T.bdr}` : 'none',
                }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                    {section.category}
                  </span>
                </div>

                {/* Rows */}
                {section.rows.map((row, rIdx) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      borderBottom: rIdx < section.rows.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
                  >
                    <div style={{ padding: '13px 20px', fontSize: 13, color: T.t2 }}>
                      {row.label}
                    </div>
                    {(['starter', 'growth', 'enterprise'] as const).map((planKey) => (
                      <div
                        key={planKey}
                        style={{
                          padding: '13px 20px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderLeft: `1px solid ${T.bdr}`,
                          background: planKey === 'growth' ? 'rgba(59,130,246,.04)' : 'transparent',
                        }}
                      >
                        <Cell value={row[planKey]} isGrowth={planKey === 'growth'} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {/* Footer — CTA row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              background: T.bgS,
              borderTop: `1px solid ${T.bdr}`,
            }}>
              <div style={{ padding: '20px', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: T.t3 }}>Ready to get started?</span>
              </div>
              {PLANS.map((plan, i) => (
                <div
                  key={plan.id}
                  style={{
                    padding: '20px',
                    borderLeft: `1px solid ${T.bdr}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i === 1 ? 'rgba(59,130,246,.05)' : 'transparent',
                  }}
                >
                  <Link
                    to={plan.ctaLink}
                    style={{
                      padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      textDecoration: 'none',
                      ...(i === 1
                        ? { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff' }
                        : { background: 'transparent', color: T.t1, border: `1px solid ${T.bdrB}` }),
                    }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── SECTION: FAQ accordion ───────────────────────────────────────────────────
function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section style={{ padding: '80px 0', borderTop: `1px solid ${T.bdr}` }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.blueL, marginBottom: 10 }}>
            FAQ
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-.025em' }}>
            Common questions
          </h2>
        </Reveal>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={i} delay={i * 40}>
                <div style={{
                  ...card({ padding: 0 }),
                  border: isOpen ? `1px solid rgba(59,130,246,.3)` : `1px solid ${T.bdr}`,
                  background: isOpen ? 'rgba(59,130,246,.04)' : T.bgC,
                  transition: 'border-color 0.25s, background 0.25s',
                }}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '18px 22px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: T.t1, fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{faq.q}</span>
                    <span style={{
                      flexShrink: 0,
                      width: 20, height: 20,
                      borderRadius: '50%',
                      background: isOpen ? 'rgba(59,130,246,.2)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isOpen ? T.blueL : T.t3, fontSize: 14, fontWeight: 700,
                      transition: 'transform 0.25s, background 0.25s, color 0.25s',
                      transform: isOpen ? 'rotate(45deg)' : 'none',
                    }}>
                      +
                    </span>
                  </button>

                  <div style={{
                    maxHeight: isOpen ? 400 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    <p style={{
                      padding: '0 22px 18px',
                      fontSize: 13.5, color: T.t2, lineHeight: 1.65,
                      margin: 0,
                    }}>
                      {faq.a}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={100} style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ fontSize: 13, color: T.t3 }}>
            Still have questions?{' '}
            <Link to="/contact" style={{ color: T.blueL, textDecoration: 'none', fontWeight: 600 }}>
              Talk to us →
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── SECTION: Bottom CTA ──────────────────────────────────────────────────────
function CtaSection({ annual }: { annual: boolean }) {
  return (
    <section style={{ padding: '100px 0', position: 'relative', overflow: 'hidden', borderTop: `1px solid ${T.bdr}` }}>
      {/* Aurora blobs */}
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none', willChange: 'transform',
        width: 500, height: 350,
        background: 'radial-gradient(circle, rgba(59,130,246,.15) 0%, transparent 70%)',
        top: -80, left: -80,
        animationName: 'pp-floatA', animationDuration: '10s', animationIterationCount: 'infinite',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none', willChange: 'transform',
        width: 450, height: 300,
        background: 'radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%)',
        bottom: -80, right: -80,
        animationName: 'pp-floatA', animationDuration: '10s', animationDelay: '-5s', animationIterationCount: 'infinite',
      }} />

      <Reveal style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 640, margin: '0 auto', padding: '0 20px' }}>
        <span style={{
          ...pill('rgba(16,185,129,.12)', T.em, 'rgba(16,185,129,.25)'),
          marginBottom: 20, display: 'inline-flex',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block',
            animationName: 'pp-pulseDot', animationDuration: '2s', animationIterationCount: 'infinite',
          }} />
          Your AI agent is ready to go live
        </span>

        <h2 style={{
          fontSize: 'clamp(28px, 4.5vw, 50px)', fontWeight: 800,
          lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: 14,
        }}>
          Start your{' '}
          <span style={{
            background: 'linear-gradient(135deg, #f8fafc, #60a5fa, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            free 30-day trial
          </span>
        </h2>

        <p style={{ fontSize: 16, color: T.t2, marginBottom: 32, lineHeight: 1.6 }}>
          Full Growth-plan features. No credit card. Live in 30 minutes.
          {annual && (
            <><br /><strong style={{ color: T.em }}>Annual billing saves you up to ₹24,000/year.</strong></>
          )}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/register"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '14px 28px', borderRadius: 9, fontSize: 15, fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: '#fff', textDecoration: 'none',
              boxShadow: '0 0 0 1px rgba(139,92,246,.3), 0 4px 20px rgba(59,130,246,.25)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 8h12M8 2l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Start Free Trial
          </Link>
          <Link
            to="/contact"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '14px 22px', borderRadius: 9, fontSize: 15, fontWeight: 700,
              color: T.t1, textDecoration: 'none',
              border: `1px solid ${T.bdrB}`, background: 'transparent',
            }}
          >
            Talk to Sales
          </Link>
        </div>

        <p style={{ marginTop: 20, fontSize: 11.5, color: T.t3 }}>
          No credit card · GST invoices · Indian data residency · Cancel anytime
        </p>
      </Reveal>
    </section>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function PricingPage() {
  useInjectStyles();
  const [annual, setAnnual] = useState(false);

  // Reset to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <HeroSection annual={annual} setAnnual={setAnnual} />
      <PricingCards annual={annual} />
      <ComparisonTable />
      <FaqAccordion />
      <CtaSection annual={annual} />
    </>
  );
}
