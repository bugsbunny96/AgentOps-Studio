import { Link } from 'react-router-dom';
import { color, maxW } from '../tokens';
import { GradientText, Pill, Reveal, SectionEyebrow, SectionHeading, cardStyle } from '../primitives';

const PLANS = [
  {
    badge: 'Basic', badgeBg: 'rgba(100,116,139,.2)', badgeColor: color.text2, badgeBdr: color.border,
    price: '₹9,999', per: 'per month + GST',
    desc: 'For solo shops with under 10 calls/day.',
    features: ['1 AI assistant', '500 minutes / month', '1 voice (Hindi/English)', 'Google Sheets + WhatsApp alerts'],
    missing: ['Order capture & booking', 'CRM / n8n integrations'],
    cta: 'Start Free Trial', ctaStyle: 'outline' as const, featured: false,
  },
  {
    badge: 'Standard · Most Popular', badgeBg: 'rgba(59,130,246,.15)', badgeColor: color.blueLight, badgeBdr: 'rgba(59,130,246,.3)',
    price: '₹17,999', per: 'per month + GST',
    desc: 'For active businesses handling 10–30 calls/day.',
    features: ['3 AI assistants', '1,000 minutes / month', 'Order capture & appointment booking', 'CRM + n8n + Razorpay', 'Call trends & sentiment analysis'],
    missing: [],
    cta: 'Start Free Trial', ctaStyle: 'primary' as const, featured: true,
  },
  {
    badge: 'Pro', badgeBg: 'rgba(139,92,246,.15)', badgeColor: color.violetLight, badgeBdr: 'rgba(139,92,246,.3)',
    price: '₹25,999', per: 'per month + GST',
    desc: 'For multi-branch, high-volume operations.',
    features: ['5 AI assistants', '1,500 minutes / month', 'All voices + custom cloning', 'Unlimited integrations', 'Dedicated account manager'],
    missing: [],
    cta: 'Start Free Trial', ctaStyle: 'outline' as const, featured: false,
  },
];

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
            Plans designed for Indian SMBs. Pay in ₹.
          </p>
        </Reveal>

        <div className="landing-grid-3" style={{ display: 'grid', gap: 14, marginTop: 44, alignItems: 'start' }}>
          {PLANS.map(({ badge, badgeBg, badgeColor, badgeBdr, price, per, desc, features, missing, cta, ctaStyle, featured }, i) => (
            <Reveal key={i} delay={i * 100}>
              <div
                style={{
                  ...cardStyle({ padding: 28, display: 'flex', flexDirection: 'column', height: '100%' }),
                  ...(featured ? {
                    background: 'rgba(59,130,246,.07)',
                    border: '1px solid rgba(59,130,246,.3)',
                    boxShadow: '0 0 36px rgba(59,130,246,.12), 0 0 0 1px rgba(139,92,246,.2)',
                    transform: 'scale(1.02)',
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
                      ? { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', border: 'none' }
                      : { background: 'transparent', color: color.text1, border: `1px solid ${color.borderStrong}` }),
                  }}
                >
                  {cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
