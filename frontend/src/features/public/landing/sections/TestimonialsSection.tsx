import { color, maxW } from '../tokens';
import { GradientText, Reveal, SectionEyebrow, SectionHeading, SpotlightCard } from '../primitives';

const TESTIMONIALS = [
  { quote: '"We went from missing 40% of calls during peak hours to zero missed calls. Our delivery team focuses on deliveries, not phone calls. ROI was clear in week one."', name: 'Rohit Mehra', role: 'Founder, FastShip Logistics · Delhi', avatar: 'R', grad: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
  { quote: '"The Hindi auto-detection is flawless. Our customers in tier-2 cities now get responses in their language without any effort from our side. Game changer."', name: 'Priya Nair', role: 'Operations Head, MedCare Clinics · Bangalore', avatar: 'P', grad: 'linear-gradient(135deg, #10b981, #3b82f6)' },
  { quote: '"Setup took 22 minutes. That\'s it. No developers, no integration headaches. The voice quality is so good our clients think it\'s a real receptionist."', name: 'Amit Sharma', role: 'CEO, BuildRight Realty · Mumbai', avatar: 'A', grad: 'linear-gradient(135deg, #f59e0b, #ec4899)' },
];

export function TestimonialsSection() {
  return (
    <section style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
          <SectionEyebrow>Testimonials</SectionEyebrow>
          <SectionHeading>
            Loved by <GradientText>200+ businesses</GradientText>
          </SectionHeading>
        </Reveal>

        <div className="landing-grid-3" style={{ display: 'grid', gap: 14, marginTop: 48 }}>
          {TESTIMONIALS.map(({ quote, name, role, avatar, grad }, i) => (
            <Reveal key={i} delay={i * 100}>
              <SpotlightCard style={{ padding: 24, minHeight: 200 }}>
                <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 52, fontWeight: 800, lineHeight: 1, color: 'rgba(59,130,246,0.13)', userSelect: 'none' }} aria-hidden="true">
                  "
                </div>
                <div style={{ display: 'flex', gap: 2, marginBottom: 14, color: color.amber, fontSize: 12 }} aria-label="5 out of 5 stars">
                  {'★★★★★'}
                </div>
                <p style={{ fontSize: 13, color: color.text2, lineHeight: 1.6, marginBottom: 18 }}>{quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
                  }} aria-hidden="true">
                    {avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: color.text1 }}>{name}</div>
                    <div style={{ fontSize: 10.5, color: color.text3 }}>{role}</div>
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
