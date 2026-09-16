import { color, font } from '../tokens';
import { GradientText, Pill, PrimaryButton, Reveal, SecondaryButton } from '../primitives';

export function CTASection() {
  return (
    <section style={{ padding: '100px 0', position: 'relative', overflow: 'hidden', borderTop: `1px solid ${color.border}` }}>
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none', width: 500, height: 350,
        background: 'radial-gradient(circle, rgba(59,130,246,.15) 0%, transparent 70%)', top: -80, left: -80,
        animationName: 'floatA', animationDuration: '10s', animationIterationCount: 'infinite', willChange: 'transform',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none', width: 450, height: 300,
        background: 'radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%)', bottom: -80, right: -80,
        animationName: 'floatA', animationDuration: '10s', animationDelay: '-5s', animationIterationCount: 'infinite', willChange: 'transform',
      }} />

      <Reveal style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 660, margin: '0 auto', padding: '0 20px' }}>
        <Pill bg="rgba(16,185,129,.12)" fg={color.emerald} border="rgba(16,185,129,.25)" live style={{ marginBottom: 18 }}>
          Your AI agent is ready to go live
        </Pill>
        <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 50px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: 14, fontFamily: font.display, textWrap: 'balance' }}>
          Set up your AI receptionist in <GradientText>30 minutes</GradientText>
        </h2>
        <p style={{ fontSize: 16, color: color.text2, marginBottom: 32, lineHeight: 1.6 }}>
          Join 200+ Indian businesses that never miss a call. No developers, no long contracts.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <PrimaryButton to="/register" size="lg">Start Free Trial — It's Free →</PrimaryButton>
          <SecondaryButton to="/contact" size="lg">Book a 30-min Demo</SecondaryButton>
        </div>
        <p style={{ marginTop: 18, fontSize: 11.5, color: color.text3 }}>
          No credit card · Cancel anytime · ₹ pricing · Indian data residency
        </p>
      </Reveal>
    </section>
  );
}
