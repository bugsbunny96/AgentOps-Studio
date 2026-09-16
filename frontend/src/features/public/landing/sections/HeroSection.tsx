import { Check } from 'lucide-react';
import { color, font } from '../tokens';
import { GradientText, Pill, PrimaryButton, Reveal } from '../primitives';
import { HeroMockup } from './HeroMockup';

const AURORA_BLOBS = [
  { w: 600, h: 600, color: 'rgba(59,130,246,.2)', top: -200, right: -80, delay: 0, dur: 12 },
  { w: 450, h: 450, color: 'rgba(139,92,246,.15)', top: 80, right: 220, delay: -4, dur: 15 },
  { w: 350, h: 350, color: 'rgba(16,185,129,.1)', bottom: -80, right: 0, delay: -7, dur: 10 },
];

const TRUST_ITEMS = ['No credit card', '30-min setup', 'Cancel anytime'];

export function HeroSection() {
  return (
    <section style={{ position: 'relative', minHeight: '92vh', display: 'flex', alignItems: 'center', padding: '80px 0 60px', overflow: 'hidden' }}>
      {/* Grid dot background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)',
        backgroundSize: '50px 50px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black, transparent)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black, transparent)',
      }} />

      {AURORA_BLOBS.map(({ w, h, color: c, delay, dur, ...pos }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', borderRadius: '50%', pointerEvents: 'none', willChange: 'transform',
            width: w, height: h,
            background: `radial-gradient(circle, ${c} 0%, transparent 70%)`,
            animationName: 'floatA', animationDuration: `${dur}s`, animationDelay: `${delay}s`,
            animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
            animationDirection: i === 1 ? 'reverse' : 'normal',
            ...pos,
          } as React.CSSProperties}
        />
      ))}

      <div
        className="landing-hero-grid"
        style={{
          position: 'relative', zIndex: 1,
          display: 'grid', gap: 48, alignItems: 'center',
          maxWidth: 1100, margin: '0 auto', padding: '0 20px',
        }}
      >
        <div>
          <Reveal>
            <Pill bg="rgba(59,130,246,.12)" fg={color.blueLight} border="rgba(59,130,246,.25)" live>
              New — Next-gen AI voice agents
            </Pill>
          </Reveal>

          <Reveal delay={100}>
            <h1 style={{
              fontSize: 'clamp(34px, 5vw, 62px)', fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.03em',
              marginTop: 16, marginBottom: 16, fontFamily: font.display, textWrap: 'balance',
            }}>
              Handle Every Call.<br />
              <GradientText>Miss Nothing. Ever.</GradientText>
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p style={{ fontSize: 16, color: color.text2, lineHeight: 1.65, marginBottom: 28, maxWidth: 440 }}>
              AgentOps Studio deploys AI receptionists that speak{' '}
              <strong style={{ color: color.text1 }}>Hindi, English &amp; Punjabi</strong> — answering calls,
              qualifying leads, and booking appointments 24/7. Live in 30 minutes.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              <PrimaryButton to="/register">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 8h12M8 2l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Start Free Trial
              </PrimaryButton>
              <a
                href="#how-it-works"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '12px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  color: color.text1, textDecoration: 'none',
                  border: `1px solid ${color.borderStrong}`, background: 'transparent',
                  transition: 'background 0.2s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="currentColor" />
                </svg>
                Watch Demo
              </a>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: color.text3, flexWrap: 'wrap' }}>
              {TRUST_ITEMS.map((t) => (
                <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, color: color.emerald }}>
                  <Check size={13} strokeWidth={2.5} /> {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}
