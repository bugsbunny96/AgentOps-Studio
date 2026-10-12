import { Mic, BarChart3, Globe2, BookOpen } from 'lucide-react';
import { color, font, maxW } from '../tokens';
import { GradientText, IconChip, LargeWaveBars, Pill, Reveal, SectionEyebrow, SectionHeading, SpotlightCard } from '../primitives';

const KB_ITEMS = [
  { dot: color.emerald, text: 'Website crawled' },
  { dot: color.blueLight, text: '10 FAQs loaded' },
  { dot: color.violetLight, text: '8 services indexed' },
];

const ANALYTICS_BARS = [45, 65, 50, 80, 70, 95, 75, 85];

const STAT_CARDS: { stat: string; label: string; tag: string | null; tagColor?: string; tagBg?: string; tagBdr?: string }[] = [
  // Product facts only (FE-19): no measured-outcome numbers until we have real data.
  // Outcome wording (MKT-01). "~30min" stays a setup claim, not a "first answered call" claim:
  // trial accounts are outbound-only until they pick a paid plan.
  { stat: '24/7', label: 'No missed call\nafter closing time', tag: null },
  { stat: '3', label: 'Languages your customers\nalready speak (EN · HI · PA)', tag: null },
  { stat: '~30min', label: 'To set up —\nno code, no engineer', tag: null },
] as const;

export function FeaturesSection() {
  return (
    <section id="services" style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
          <SectionEyebrow>What you get</SectionEyebrow>
          <SectionHeading>
            Every call answered — <GradientText>even when you can't pick up</GradientText>
          </SectionHeading>
          <p style={{ fontSize: 15, color: color.text2, marginTop: 10, lineHeight: 1.6 }}>
            Your AI receptionist answers in Hindi, English or Punjabi, takes the order or the message, and sends you a summary.
          </p>
        </Reveal>

        <div className="landing-bento" style={{ display: 'grid', gap: 10, marginTop: 48 }}>
          {/* Voice AI — large */}
          <Reveal style={{ gridColumn: 'span 7', gridRow: 'span 2' }}>
            <SpotlightCard style={{ minHeight: 240, height: '100%' }}>
              <IconChip icon={Mic} bg="rgba(33,241,168,.15)" fg={color.blueLight} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Callers get answers, not a ringing phone</h3>
              <p style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>A warm, natural voice that answers from your own website and price list, takes orders and notes who needs a call back.</p>
              <LargeWaveBars count={36} />
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <Pill bg="rgba(33,241,168,.1)" fg={color.blueLight} border="rgba(33,241,168,.25)">Answers questions</Pill>
                <Pill bg="rgba(15,201,138,.1)" fg={color.violetLight} border="rgba(15,201,138,.25)">Takes orders</Pill>
                <Pill bg="rgba(16,185,129,.1)" fg={color.emerald} border="rgba(16,185,129,.25)">Flags call-backs</Pill>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Analytics */}
          <Reveal delay={100} style={{ gridColumn: 'span 5' }}>
            <SpotlightCard style={{ minHeight: 120 }}>
              <IconChip icon={BarChart3} bg="rgba(16,185,129,.15)" fg={color.emerald} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Know what every call was about</h3>
              <p style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>Who called, what they wanted, and which calls need you — with a transcript and summary for each.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44, marginTop: 14 }}>
                {ANALYTICS_BARS.map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: '3px 3px 0 0', height: `${h}%`, background: `linear-gradient(180deg, ${color.blueLight}, rgba(33,241,168,0.3))` }} />
                ))}
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Language */}
          <Reveal delay={200} style={{ gridColumn: 'span 5' }}>
            <SpotlightCard style={{ minHeight: 120 }}>
              <IconChip icon={Globe2} bg="rgba(249,115,22,.15)" fg={color.orange} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Talk to customers in their language</h3>
              <p style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>Hindi, English or Punjabi — the agent switches as soon as the caller does. No “press 1 for Hindi”.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <Pill bg="rgba(33,241,168,.1)" fg={color.blueLight} border={color.borderStrong}>🇺🇸 English</Pill>
                <Pill bg="rgba(249,115,22,.1)" fg={color.orange} border={color.borderStrong}>🇮🇳 हिन्दी</Pill>
                <Pill bg="rgba(15,201,138,.1)" fg={color.violetLight} border={color.borderStrong}>🏳️ ਪੰਜਾਬੀ</Pill>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Knowledge base */}
          <Reveal style={{ gridColumn: 'span 3' }}>
            <SpotlightCard style={{ minHeight: 120 }}>
              <IconChip icon={BookOpen} bg="rgba(15,201,138,.15)" fg={color.violetLight} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Answers like someone who knows your shop</h3>
              <p style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>Learns your products, prices and FAQs from your website. Add anything it missed in a minute.</p>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {KB_ITEMS.map(({ dot, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: `1px solid ${color.border}`, fontSize: 10.5, color: color.text2 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    {text}
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Stat cards */}
          {STAT_CARDS.map(({ stat, label, tag, tagColor, tagBg, tagBdr }, i) => (
            <Reveal key={i} delay={i * 100} style={{ gridColumn: 'span 3' }}>
              <SpotlightCard>
                <div style={{
                  fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-.02em', marginBottom: 3,
                  fontFamily: font.mono, fontVariantNumeric: 'tabular-nums',
                  background: 'linear-gradient(135deg, #fafafa, #7CF7CB, #0FC98A)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  {stat}
                </div>
                <div style={{ fontSize: 12, color: color.text2, whiteSpace: 'pre-line' }}>{label}</div>
                {tag && (
                  <div style={{ marginTop: 10 }}>
                    <Pill bg={tagBg!} fg={tagColor!} border={tagBdr!}>{tag}</Pill>
                  </div>
                )}
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
