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
  { stat: '0', label: 'Missed calls\nafter going live', tag: '24 / 7 / 365', tagColor: color.emerald, tagBg: 'rgba(16,185,129,.1)', tagBdr: 'rgba(16,185,129,.2)' },
  { stat: '<500ms', label: 'Average voice\nresponse latency', tag: null },
  { stat: '30min', label: 'Average time\nfrom signup to live', tag: null },
] as const;

export function FeaturesSection() {
  return (
    <section id="services" style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
          <SectionEyebrow>Capabilities</SectionEyebrow>
          <SectionHeading>
            Everything your AI needs to <GradientText>handle every call</GradientText>
          </SectionHeading>
        </Reveal>

        <div className="landing-bento" style={{ display: 'grid', gap: 10, marginTop: 48 }}>
          {/* Voice AI — large */}
          <Reveal style={{ gridColumn: 'span 7', gridRow: 'span 2' }}>
            <SpotlightCard style={{ minHeight: 240, height: '100%' }}>
              <IconChip icon={Mic} bg="rgba(59,130,246,.15)" fg={color.blueLight} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Natural Voice AI</h3>
              <p style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>Powered by state-of-the-art AI. Your agent sounds indistinguishable from a human — warm, fluent, contextually aware.</p>
              <LargeWaveBars count={36} />
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <Pill bg="rgba(59,130,246,.1)" fg={color.blueLight} border="rgba(59,130,246,.25)">Neural LLM</Pill>
                <Pill bg="rgba(139,92,246,.1)" fg={color.violetLight} border="rgba(139,92,246,.25)">Studio TTS</Pill>
                <Pill bg="rgba(16,185,129,.1)" fg={color.emerald} border="rgba(16,185,129,.25)">AI Transcription</Pill>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Analytics */}
          <Reveal delay={100} style={{ gridColumn: 'span 5' }}>
            <SpotlightCard style={{ minHeight: 120 }}>
              <IconChip icon={BarChart3} bg="rgba(16,185,129,.15)" fg={color.emerald} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Real-time Analytics</h3>
              <p style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>Track call volume, completion rate, and language splits live.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44, marginTop: 14 }}>
                {ANALYTICS_BARS.map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: '3px 3px 0 0', height: `${h}%`, background: `linear-gradient(180deg, ${color.blueLight}, rgba(59,130,246,0.3))` }} />
                ))}
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Language */}
          <Reveal delay={200} style={{ gridColumn: 'span 5' }}>
            <SpotlightCard style={{ minHeight: 120 }}>
              <IconChip icon={Globe2} bg="rgba(249,115,22,.15)" fg={color.orange} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Auto Language Detection</h3>
              <p style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>Caller speaks Hindi? Agent switches instantly. No menu, no friction.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <Pill bg="rgba(59,130,246,.1)" fg={color.blueLight} border={color.borderStrong}>🇺🇸 English</Pill>
                <Pill bg="rgba(249,115,22,.1)" fg={color.orange} border={color.borderStrong}>🇮🇳 हिन्दी</Pill>
                <Pill bg="rgba(139,92,246,.1)" fg={color.violetLight} border={color.borderStrong}>🏳️ ਪੰਜਾਬੀ</Pill>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Knowledge base */}
          <Reveal style={{ gridColumn: 'span 3' }}>
            <SpotlightCard style={{ minHeight: 120 }}>
              <IconChip icon={BookOpen} bg="rgba(139,92,246,.15)" fg={color.violetLight} />
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Smart Knowledge Base</h3>
              <p style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>Crawls your website. Add FAQs and services manually.</p>
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
                  background: 'linear-gradient(135deg, #f8fafc, #60a5fa, #8b5cf6)',
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
