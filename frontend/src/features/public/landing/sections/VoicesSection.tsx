import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { color, maxW } from '../tokens';
import { GradientText, Pill, Reveal, SectionEyebrow, SectionHeading, SpotlightCard, WaveBars } from '../primitives';

import voiceAsteria from '@/assets/audio/voice-asteria.mp3';
import voiceAthena from '@/assets/audio/voice-athena.mp3';
import voiceStella from '@/assets/audio/voice-stella.mp3';
import voiceOrion from '@/assets/audio/voice-orion.mp3';
import voiceAngus from '@/assets/audio/voice-angus.mp3';
import voiceHelios from '@/assets/audio/voice-helios.mp3';

/**
 * Curated from the real voice catalog (frontend/src/features/agents/voice-catalog.ts,
 * Deepgram Aura provider). Static, hand-picked subset — will NOT auto-update if the
 * catalog changes; that's an accepted tradeoff for a curated marketing showcase.
 *
 * Clips generated once via the authenticated backend /agents/voice-preview endpoint
 * and committed as static assets (see frontend/src/assets/audio/).
 */
const VOICES = [
  { id: 'asteria', name: 'Asteria', gender: 'Female', accent: 'American', description: 'Warm and conversational', src: voiceAsteria },
  { id: 'athena', name: 'Athena', gender: 'Female', accent: 'British', description: 'Authoritative and clear', src: voiceAthena },
  { id: 'stella', name: 'Stella', gender: 'Female', accent: 'American', description: 'Expressive and upbeat', src: voiceStella },
  { id: 'orion', name: 'Orion', gender: 'Male', accent: 'American', description: 'Rich and measured', src: voiceOrion },
  { id: 'angus', name: 'Angus', gender: 'Male', accent: 'Irish', description: 'Friendly Irish accent', src: voiceAngus },
  { id: 'helios', name: 'Helios', gender: 'Male', accent: 'British', description: 'Energetic and bright', src: voiceHelios },
];

/**
 * Plays a short preview clip via the Web Audio API rather than a plain
 * <audio> element. The generated TTS clips lack the metadata (Xing/seek
 * headers) Chrome's HTMLMediaElement expects for progressive loading —
 * verified in-browser that `<audio src>` stalls indefinitely (readyState
 * never leaves 0, fires a `stalled` event) on these exact files, while
 * fetch() + decodeAudioData() decodes them correctly every time. Buffers
 * are decoded once per voice and cached for instant replay.
 */
function useAudioPreview(src: string) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { sourceRef.current?.stop(); }, []);

  async function toggle() {
    if (playing) {
      sourceRef.current?.stop();
      return; // onended below flips `playing` back to false
    }
    setLoading(true);
    try {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = new Ctx();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();
      if (!bufferRef.current) {
        const res = await fetch(src);
        const arrayBuffer = await res.arrayBuffer();
        bufferRef.current = await ctx.decodeAudioData(arrayBuffer);
      }
      const node = ctx.createBufferSource();
      node.buffer = bufferRef.current;
      node.connect(ctx.destination);
      node.onended = () => { setPlaying(false); sourceRef.current = null; };
      node.start();
      sourceRef.current = node;
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  }

  return { playing, loading, toggle };
}

function VoiceCard({ voice, delay }: { voice: (typeof VOICES)[number]; delay: number }) {
  const { playing, loading, toggle } = useAudioPreview(voice.src);

  return (
    <Reveal delay={delay}>
      <SpotlightCard style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: color.text1 }}>{voice.name}</h3>
            <p style={{ fontSize: 12, color: color.text2, marginTop: 2 }}>{voice.description}</p>
          </div>
          <button
            onClick={toggle}
            disabled={loading}
            aria-label={playing ? `Pause ${voice.name} preview` : `Play ${voice.name} preview`}
            style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: playing ? color.blueLight : 'rgba(59,130,246,.15)',
              color: playing ? '#031024' : color.blueLight,
              border: '1px solid rgba(59,130,246,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {loading
              ? <Loader2 size={14} className="landing-spin" />
              : playing
                ? <Pause size={14} fill="currentColor" />
                : <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />}
          </button>
        </div>

        <div style={{ height: 32, marginBottom: 12 }}>
          <WaveBars count={20} height={playing ? 32 : 12} />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pill bg="rgba(255,255,255,0.04)" fg={color.text2} border={color.border}>{voice.gender}</Pill>
          <Pill bg="rgba(255,255,255,0.04)" fg={color.text2} border={color.border}>{voice.accent}</Pill>
        </div>
      </SpotlightCard>
    </Reveal>
  );
}

export function VoicesSection() {
  return (
    <section style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
          <SectionEyebrow>Voices</SectionEyebrow>
          <SectionHeading>
            Pick a voice that <GradientText>sounds like your business</GradientText>
          </SectionHeading>
          <p style={{ fontSize: 15, color: color.text2, maxWidth: 480, margin: '10px auto 0', lineHeight: 1.6 }}>
            A curated sample from a catalog of dozens of voices across multiple providers — press play to hear one.
          </p>
        </Reveal>

        <div className="landing-grid-3" style={{ display: 'grid', gap: 14, marginTop: 44 }}>
          {VOICES.map((voice, i) => (
            <VoiceCard key={voice.id} voice={voice} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}
