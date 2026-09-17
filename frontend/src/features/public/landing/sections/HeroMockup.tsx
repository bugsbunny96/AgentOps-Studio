/**
 * 3D tilting "live call" device mockup — the hero's visual centerpiece.
 */
import { useEffect, useRef, useState } from 'react';
import { Zap, Lock, Languages } from 'lucide-react';
import { color, font } from '../tokens';
import { WaveBars } from '../primitives';

const BAR_HEIGHTS = [40, 60, 45, 80, 65, 100, 72];

const STATIC_BADGES = [
  { icon: Zap, text: '<480ms latency', mono: true, style: { bottom: 10, left: -16 } as React.CSSProperties },
  { icon: Lock, text: 'Data encrypted', mono: false, style: { top: -8, right: 8 } as React.CSSProperties },
];

const LANGUAGE_SPLIT = [
  { label: 'English', color: color.blueLight, pct: 58 },
  { label: 'Hindi', color: color.orange, pct: 36 },
  { label: 'Punjabi', color: color.violetLight, pct: 6 },
];

/** Three real, distinct-language call scenarios — the hero cycles through
 * these to demonstrate auto language detection (en-US/hi-IN/pa-IN) in motion
 * instead of just claiming it in copy. */
const TRANSCRIPT_SCENARIOS = [
  {
    language: 'Hindi',
    caller: '+91 98765 43210',
    transcript: [
      { role: 'AI', color: color.blueLight, text: 'नमस्ते! मैं प्रिया हूँ, Acme Logistics से। आपकी क्या मदद करूँ?' },
      { role: 'User', color: color.emerald, text: "My order hasn't arrived. It was due yesterday." },
      { role: 'AI', color: color.blueLight, text: 'I understand! Let me pull up your order status', typing: true },
    ],
  },
  {
    language: 'Punjabi',
    caller: '+91 98123 45678',
    transcript: [
      { role: 'AI', color: color.blueLight, text: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਰੀਆ ਹਾਂ, BuildRight Realty ਤੋਂ। ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?' },
      { role: 'User', color: color.emerald, text: 'ਮੈਨੂੰ 2BHK ਬਾਰੇ ਜਾਣਕਾਰੀ ਚਾਹੀਦੀ ਹੈ।' },
      { role: 'AI', color: color.blueLight, text: 'ਜ਼ਰੂਰ! ਮੈਂ ਤੁਹਾਡੇ ਲਈ ਉਪਲਬਧ ਵਿਕਲਪ ਲੱਭਦੀ ਹਾਂ', typing: true },
    ],
  },
  {
    language: 'English',
    caller: '+91 99887 76655',
    transcript: [
      { role: 'AI', color: color.blueLight, text: "Hi! This is Alex from QuickMart Retail. How can I help you today?" },
      { role: 'User', color: color.emerald, text: 'Do you have same-day delivery in my area?' },
      { role: 'AI', color: color.blueLight, text: 'Yes! Let me check delivery slots near you', typing: true },
    ],
  },
];

function fmt(s: number) {
  return `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function HeroMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const [timerSec, setTimerSec] = useState(167);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setTimerSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Cycle through the language scenarios to demonstrate auto-detection live.
  // Skipped entirely when the visitor prefers reduced motion — the mockup
  // just shows the first (Hindi) scenario statically instead of cycling.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setScenarioIndex((i) => (i + 1) % TRANSCRIPT_SCENARIOS.length);
        setVisible(true);
      }, 300);
    }, 7000);
    return () => clearInterval(id);
  }, []);

  const scenario = TRANSCRIPT_SCENARIOS[scenarioIndex];

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    el.style.transition = 'transform 0.1s ease';
    el.style.transform = `perspective(1100px) rotateX(${-dy * 6}deg) rotateY(${dx * 10 - 14}deg)`;
  }

  function onMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
    el.style.transform = 'perspective(1100px) rotateX(6deg) rotateY(-14deg)';
  }

  return (
    <div className="hero-mockup-scale" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 460 }}>
      {STATIC_BADGES.map(({ icon: Icon, text, mono, style }, i) => (
        <div
          key={text}
          style={{
            position: 'absolute', zIndex: 3,
            background: 'rgba(13,21,36,0.92)', border: `1px solid ${color.borderStrong}`,
            borderRadius: 999, padding: '5px 10px', fontSize: 10.5, fontWeight: 600, color: color.text1,
            fontFamily: mono ? font.mono : 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
            animationName: 'floatBadge', animationDuration: '4s', animationDelay: `${-i * 1.5}s`,
            animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
            ...style,
          }}
        >
          <Icon size={11} strokeWidth={2.25} style={{ flexShrink: 0 }} />
          {text}
        </div>
      ))}

      {/* Language-detected badge — text tracks the active scenario */}
      <div
        style={{
          position: 'absolute', top: 72, right: -52, zIndex: 3,
          background: 'rgba(13,21,36,0.92)', border: `1px solid ${color.borderStrong}`,
          borderRadius: 999, padding: '5px 10px', fontSize: 10.5, fontWeight: 600, color: color.text1,
          display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
          animationName: 'floatBadge', animationDuration: '4s', animationDelay: '-3s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          opacity: visible ? 1 : 0, transition: 'opacity 0.3s',
        }}
      >
        <Languages size={11} strokeWidth={2.25} style={{ flexShrink: 0 }} />
        {scenario.language} detected
      </div>

      <div
        ref={ref}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'relative', width: 340,
          transform: 'perspective(1100px) rotateX(6deg) rotateY(-14deg)',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Back card — analytics */}
        <div style={{
          position: 'absolute', width: 148, right: -44, bottom: 55, zIndex: 1, padding: 12,
          background: 'rgba(13,21,36,0.78)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14,
          transform: 'perspective(1100px) rotateY(10deg) translateZ(-30px)',
          boxShadow: '0 18px 36px rgba(0,0,0,0.3)',
        }}>
          <p style={{ fontSize: 9.5, color: color.text3, marginBottom: 5, fontWeight: 600 }}>Calls today</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: color.text1, lineHeight: 1, fontFamily: font.mono, fontVariantNumeric: 'tabular-nums' }}>247</p>
          <p style={{ fontSize: 9.5, color: color.emerald, marginTop: 2 }}>↑ 18% vs yesterday</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24, marginTop: 7 }}>
            {BAR_HEIGHTS.map((h, i) => (
              <div key={i} style={{ flex: 1, borderRadius: 2, background: `linear-gradient(180deg, ${color.blueLight}, rgba(59,130,246,0.3))`, height: `${h}%` }} />
            ))}
          </div>
        </div>

        {/* Back card — languages */}
        <div style={{
          position: 'absolute', width: 132, left: -36, top: 36, zIndex: 1, padding: 11,
          background: 'rgba(13,21,36,0.78)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14,
          transform: 'perspective(1100px) rotateY(-8deg) translateZ(-20px)',
          boxShadow: '0 18px 36px rgba(0,0,0,0.3)',
        }}>
          <p style={{ fontSize: 9.5, color: color.text3, marginBottom: 5, fontWeight: 600 }}>Language split</p>
          {LANGUAGE_SPLIT.map(({ label, color: c, pct }) => (
            <div key={label} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginBottom: 2 }}>
                <span style={{ color: c }}>{label}</span>
                <span style={{ color: color.text2, fontFamily: font.mono }}>{pct}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: color.border }}>
                <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Main card */}
        <div style={{
          background: 'rgba(13,21,36,0.94)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18,
          padding: 18, position: 'relative', zIndex: 2,
          boxShadow: '0 0 0 1px rgba(59,130,246,.12), 0 40px 70px rgba(0,0,0,.5), 0 0 50px rgba(59,130,246,.08), inset 0 1px 0 rgba(255,255,255,.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', background: color.emerald,
                animationName: 'pulseGlow', animationDuration: '2s', animationIterationCount: 'infinite',
              }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: color.text1 }}>Live Call</div>
                <div style={{ fontSize: 10, color: color.text3, fontFamily: font.mono, transition: 'opacity 0.3s', opacity: visible ? 1 : 0 }}>{scenario.caller}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: color.emerald, fontFamily: font.mono, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(timerSec)}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                  <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'block' }} />
                ))}
              </div>
            </div>
          </div>

          <WaveBars count={26} height={44} />

          <div style={{
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${color.border}`, borderRadius: 9, padding: 10, marginBottom: 12,
            opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.3s, transform 0.3s',
          }}>
            {scenario.transcript.map(({ role, color: c, text, typing }, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < scenario.transcript.length - 1 ? 7 : 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{role}</span>
                <span style={{ fontSize: 10.5, color: color.text2, lineHeight: 1.45 }}>
                  {text}
                  {typing && (
                    <span style={{
                      animationName: 'blinkCursor', animationDuration: '1s',
                      animationTimingFunction: 'step-end', animationIterationCount: 'infinite', color: color.blueLight,
                    }}>|</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 7 }}>
            <button style={{
              flex: 1, padding: 7, borderRadius: 7, background: 'rgba(59,130,246,.15)', color: color.blueLight,
              border: '1px solid rgba(59,130,246,.2)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>↗ Transfer</button>
            <button style={{
              flex: 1, padding: 7, borderRadius: 7, background: 'rgba(239,68,68,.1)', color: color.red,
              border: '1px solid rgba(239,68,68,.2)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>✕ End Call</button>
          </div>
        </div>
      </div>
    </div>
  );
}
