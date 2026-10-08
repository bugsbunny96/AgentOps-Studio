import { Link } from 'react-router-dom';
import { color, maxW } from '../tokens';
import { GradientText, Pill, Reveal, SectionEyebrow, SectionHeading, cardStyle } from '../primitives';
import { PLANS as PLAN_LIST, inr } from '../../../../lib/pricing';

// Pricing v2 (2026-10-08) — data from src/lib/pricing.ts; only built features (BIZ-07).
const PLANS = PLAN_LIST.map((p) => ({
  badge:    p.featured ? `${p.name} · Most Popular` : p.name,
  badgeBg:  p.featured ? 'rgba(33,241,168,.15)' : 'rgba(115,115,115,.2)',
  badgeColor: p.featured ? color.blueLight : color.text2,
  badgeBdr: p.featured ? 'rgba(33,241,168,.3)' : color.border,
  price:    inr(p.monthlyInr),
  per:      'per month + GST',
  desc:     p.tagline,
  features: [
    `${p.includedMinutes.toLocaleString('en-IN')} minutes / month (≈ ${p.approxCalls} calls)`,
    `${p.concurrentCalls} simultaneous call${p.concurrentCalls > 1 ? 's' : ''}`,
    'Hindi, English, Punjabi',
    p.premiumVoiceAddonInr === null ? 'Premium voices included' : 'Standard voices (premium add-on)',
    p.setupFeeInr === 0 ? 'Self-serve setup' : p.id === 'enterprise' ? 'Managed setup' : 'Guided setup',
  ],
  missing:  [] as string[],
  cta:      'Start Free Trial',
  ctaStyle: (p.featured ? 'primary' : 'outline') as 'primary' | 'outline',
  featured: p.featured,
}));

export function PricingSection() {
  return (
    <section id="pricing" style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
          <SectionEyebrow>Pricing</SectionEyebrow>
          <SectionHeading>
            Simple pricing.<br /><GradientText>No surprises.</GradientText>
          </SectionHeading>
          <p style={{ fontSize: 15, color: color.text2, margin: '10px auto 0', lineHeight: 1.6 }}>
            Plans for Indian SMBs, from ₹4,999/month. Pay in ₹, monthly or yearly (2 months free).
          </p>
        </Reveal>

        <div className="landing-grid-4" style={{ display: 'grid', gap: 14, marginTop: 44, alignItems: 'start' }}>
          {PLANS.map(({ badge, badgeBg, badgeColor, badgeBdr, price, per, desc, features, missing, cta, ctaStyle, featured }, i) => (
            <Reveal key={i} delay={i * 100}>
              <div
                style={{
                  ...cardStyle({ padding: 28, display: 'flex', flexDirection: 'column', height: '100%' }),
                  ...(featured ? {
                    background: 'rgba(33,241,168,.07)',
                    border: '1px solid rgba(33,241,168,.3)',
                    boxShadow: '0 0 36px rgba(33,241,168,.12), 0 0 0 1px rgba(15,201,138,.2)',
                  } : {}),
                }}
              >
                <Pill bg={badgeBg} fg={badgeColor} border={badgeBdr} style={{ marginBottom: 18, alignSelf: 'flex-start', fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {badge}
                </Pill>
                <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-.04em', lineHeight: 1, marginBottom: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {price}
                </div>
                <div style={{ fontSize: 12, color: color.text3, marginBottom: 16 }}>{per}</div>
                <p style={{ fontSize: 13, color: color.text2, marginBottom: 18, lineHeight: 1.5 }}>{desc}</p>
                <hr style={{ border: 'none', borderTop: `1px solid ${color.border}`, marginBottom: 16 }} />
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, flex: 1 }}>
                  {features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, color: color.text2 }}>
                      <span style={{ color: color.emerald, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </li>
                  ))}
                  {missing.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, color: color.text3 }}>
                      <span style={{ color: color.text3, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>–</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    textDecoration: 'none', transition: 'transform 0.2s',
                    ...(ctaStyle === 'primary'
                      ? { background: 'linear-gradient(135deg, #21F1A8, #0FC98A)', color: '#171717', border: 'none' }
                      : { background: 'transparent', color: color.text1, border: `1px solid ${color.borderStrong}` }),
                  }}
                >
                  {cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: color.text3 }}>
          Extra minutes from ₹18/min with top-up packs.{' '}
          <Link to="/pricing" style={{ color: color.blueLight, textDecoration: 'none', fontWeight: 600 }}>
            Compare all plans →
          </Link>
        </p>
      </div>
    </section>
  );
}
