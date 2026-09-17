import { color, maxW } from '../tokens';
import { Pill, Reveal } from '../primitives';

/**
 * Real infra names, not generic "AI-powered" language — every provider here
 * is an actual integration in the voice-agent catalog (see
 * frontend/src/features/agents/voice-catalog.ts). Phrased as "Built on",
 * never "Partnered with" — no such relationship is confirmed.
 */
const PROVIDERS = [
  { name: 'GPT-4o', sub: 'OpenAI' },
  { name: 'ElevenLabs', sub: 'Studio TTS' },
  { name: 'Deepgram', sub: 'Speech-to-text' },
  { name: 'Cartesia', sub: 'Low-latency TTS' },
  { name: 'PlayHT', sub: 'Voice cloning' },
  { name: 'Azure Speech', sub: 'Enterprise TTS' },
];

export function PoweredBySection() {
  return (
    <section style={{ padding: '32px 0', borderBottom: `1px solid ${color.border}` }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: color.text3, marginBottom: 16 }}>
            Built on best-in-class AI infrastructure
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {PROVIDERS.map(({ name, sub }) => (
              <Pill key={name} bg={color.surface} fg={color.text2} border={color.border} style={{ padding: '7px 14px', gap: 7 }}>
                <span style={{ color: color.text1, fontWeight: 700 }}>{name}</span>
                <span style={{ color: color.text3, fontWeight: 500 }}>· {sub}</span>
              </Pill>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
