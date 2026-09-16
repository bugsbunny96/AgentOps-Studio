import { color, maxW } from '../tokens';
import { GradientText, Pill, Reveal, SectionEyebrow, SectionHeading, SpotlightCard } from '../primitives';

const HOW_STEPS = [
  { num: 1, colorBg: 'rgba(59,130,246,.15)', colorFg: color.blueLight, colorBdr: 'rgba(59,130,246,.25)', title: 'Create your workspace', body: 'Enter your business name, industry, and timezone. Your AI workspace is ready in seconds.', time: '~30 seconds' },
  { num: 2, colorBg: 'rgba(139,92,246,.15)', colorFg: color.violetLight, colorBdr: 'rgba(139,92,246,.25)', title: 'Configure your agent', body: 'Add your website, FAQs, services, and business hours. Your AI learns everything in minutes.', time: '~10 minutes' },
  { num: 3, colorBg: 'rgba(16,185,129,.15)', colorFg: color.emerald, colorBdr: 'rgba(16,185,129,.25)', title: 'Go live, instantly', body: 'Assign your existing phone number, choose languages, and launch. Calls handled from minute one.', time: '~2 minutes' },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal>
          <SectionEyebrow>How it works</SectionEyebrow>
          <SectionHeading>
            From zero to <GradientText>live calls</GradientText> in under 30 minutes
          </SectionHeading>
          <p style={{ fontSize: 15, color: color.text2, maxWidth: 500, marginTop: 10, lineHeight: 1.6 }}>
            Three steps. No code. No engineers. Just your business info and a phone number.
          </p>
        </Reveal>

        <div className="landing-grid-3" style={{ display: 'grid', gap: 2, marginTop: 48, position: 'relative' }}>
          <div className="landing-how-connector" style={{
            position: 'absolute', top: 29,
            left: 'calc(33.33% + 30px)', right: 'calc(33.33% + 30px)', height: 1,
            background: `linear-gradient(90deg, ${color.blue}, ${color.violet})`,
          }} />
          {HOW_STEPS.map(({ num, colorBg, colorFg, colorBdr, title, body, time }, i) => (
            <Reveal key={num} delay={i * 100}>
              <SpotlightCard style={{ padding: 28 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 11,
                  background: colorBg, color: colorFg, border: `1px solid ${colorBdr}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, fontWeight: 800, marginBottom: 16,
                }}>
                  {num}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
                <p style={{ fontSize: 13, color: color.text2, lineHeight: 1.55 }}>{body}</p>
                <div style={{ marginTop: 14 }}>
                  <Pill bg="rgba(16,185,129,.1)" fg={color.emerald} border="rgba(16,185,129,.2)">⏱ {time}</Pill>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
