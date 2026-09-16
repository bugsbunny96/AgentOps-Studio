import { Lightbulb, ListChecks, CheckCircle2 } from 'lucide-react';
import { color, font, maxW } from '../tokens';
import { GradientText, IconChip, Pill, Reveal, SectionEyebrow, SectionHeading, SpotlightCard } from '../primitives';

/**
 * Mirrors the real AI Summary card shipped in the authenticated dashboard
 * (frontend/src/features/calls/CallDetailPage.tsx SummaryCard) — same
 * information shape (resolution state, intent tags, action items) restyled
 * for the dark landing surface, so this reads as a preview of the real
 * product rather than a marketing fiction.
 */
const RESOLUTION = { label: 'Transferred', color: color.amber, bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.3)' };

const TRANSCRIPT_EXCERPT = [
  { role: 'AI', text: "I've checked your account — your EMI payment is 3 days overdue." },
  { role: 'User', text: "I didn't get any reminder, can you waive the late fee?" },
  { role: 'AI', text: "I can't waive fees directly, but I'll connect you with billing support right away." },
];

const INTENTS = ['Late Payment', 'Fee Waiver Request'];
const ACTION_ITEMS = ['Connect caller to billing support', 'Flag account for fee review'];

export function CallIntelligenceSection() {
  return (
    <section style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <SectionEyebrow>Call Intelligence</SectionEyebrow>
          <SectionHeading>
            Every call, <GradientText>automatically understood</GradientText>
          </SectionHeading>
          <p style={{ fontSize: 15, color: color.text2, maxWidth: 480, margin: '10px auto 0', lineHeight: 1.6 }}>
            Intent, action items, and resolution — extracted from every conversation, no manual review needed.
          </p>
        </Reveal>

        <Reveal delay={100} style={{ marginTop: 44, maxWidth: 640, margin: '44px auto 0' }}>
          <SpotlightCard style={{ padding: 28 }}>
            {/* Transcript excerpt */}
            <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: 9, padding: 14, marginBottom: 20 }}>
              {TRANSCRIPT_EXCERPT.map(({ role, text }, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < TRANSCRIPT_EXCERPT.length - 1 ? 8 : 0 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: role === 'AI' ? color.blueLight : color.emerald, whiteSpace: 'nowrap' }}>{role}</span>
                  <span style={{ fontSize: 12.5, color: color.text2, lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Extracted summary — reveals in below the transcript */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconChip icon={Lightbulb} bg="rgba(59,130,246,.15)" fg={color.blueLight} size={30} style={{ marginBottom: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: color.text1 }}>Extracted automatically</span>
              </div>
              <Pill bg={RESOLUTION.bg} fg={RESOLUTION.color} border={RESOLUTION.border}>
                <CheckCircle2 size={11} strokeWidth={2.5} /> {RESOLUTION.label}
              </Pill>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: color.text3, marginBottom: 8 }}>
                Intent detected
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {INTENTS.map((intent, i) => (
                  <Reveal key={intent} delay={200 + i * 120} style={{ display: 'inline-block' }}>
                    <Pill bg="rgba(139,92,246,.1)" fg={color.violetLight} border="rgba(139,92,246,.25)">{intent}</Pill>
                  </Reveal>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: color.text3, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ListChecks size={12} /> Action items
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {ACTION_ITEMS.map((item, i) => (
                  <Reveal key={item} delay={400 + i * 120}>
                    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, color: color.text2 }}>
                      <CheckCircle2 size={13} strokeWidth={2.5} style={{ color: color.emerald, flexShrink: 0, marginTop: 1 }} />
                      {item}
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>

            <p style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${color.border}`, fontSize: 10.5, color: color.text3, fontFamily: font.mono }}>
              call_id: cl_8f2a91 · processed in 1.2s
            </p>
          </SpotlightCard>
        </Reveal>
      </div>
    </section>
  );
}
