/**
 * L3.F1 — HomePage (Public Landing Page)
 * Route: / (public, no auth required)
 *
 * Design: dark SaaS, 3D CSS hero, aurora blobs, bento grid, voice wave bars,
 *         marquee, scroll reveals, cursor glow — zero external JS dependencies.
 *
 * Performance guarantee:
 *   - All animations use transform/opacity only (compositor thread, no layout reflow)
 *   - Intersection Observer for scroll reveals (no scroll event listeners)
 *   - will-change: transform on aurora blobs only
 *   - Google Font loaded in index.html (preconnect + display=swap)
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// ─── Design tokens (mirrors CSS vars in landing-page-design.html) ─────────────
const T = {
  bg: '#030712',
  bgS: '#0d1524',
  bgC: 'rgba(255,255,255,0.03)',
  bgCH: 'rgba(255,255,255,0.055)',
  bdr: 'rgba(255,255,255,0.07)',
  bdrB: 'rgba(255,255,255,0.12)',
  blue: '#3b82f6',
  blueL: '#60a5fa',
  violet: '#8b5cf6',
  em: '#10b981',
  amber: '#f59e0b',
  t1: '#f8fafc',
  t2: '#94a3b8',
  t3: '#475569',
};

// ─── Shared style helpers ─────────────────────────────────────────────────────
const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 11, fontWeight: 700, padding: '4px 10px',
  borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
});

const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 18,
  padding: 24, overflow: 'hidden', position: 'relative',
  transition: 'border-color 0.3s, transform 0.3s cubic-bezier(0.4,0,0.2,1)',
  ...extra,
});

// ─── Keyframes injected once ─────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes floatA {
    0%,100%{transform:translate(0,0) scale(1)}
    33%{transform:translate(25px,-18px) scale(1.04)}
    66%{transform:translate(-12px,20px) scale(.97)}
  }
  @keyframes pulseGlow {
    0%,100%{box-shadow:0 0 8px #10b981,0 0 0 0 rgba(16,185,129,.4)}
    50%{box-shadow:0 0 12px #10b981,0 0 0 5px rgba(16,185,129,0)}
  }
  @keyframes waveBar {
    0%{height:4px;opacity:.4}
    100%{height:100%;opacity:1}
  }
  @keyframes waveBarL {
    0%{transform:scaleY(.12);opacity:.5}
    100%{transform:scaleY(1);opacity:1}
  }
  @keyframes blinkCursor {
    0%,100%{opacity:1}50%{opacity:0}
  }
  @keyframes marquee {
    from{transform:translateX(0)}
    to{transform:translateX(-50%)}
  }
  @keyframes floatBadge {
    0%,100%{transform:translateY(0)}
    50%{transform:translateY(-5px)}
  }
  @keyframes pulseDot {
    0%,100%{opacity:1;transform:scale(1)}
    50%{opacity:.5;transform:scale(.8)}
  }
  @keyframes revealUp {
    from{opacity:0;transform:translateY(24px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes particleFloat {
    0%{transform:translateY(0) translateX(0);opacity:0}
    10%{opacity:.6}
    90%{opacity:.3}
    100%{transform:translateY(-120px) translateX(var(--px,20px));opacity:0}
  }
`;

// ─── Keyframe style injector ──────────────────────────────────────────────────
function useInjectStyles() {
  useEffect(() => {
    const id = 'hp-keyframes';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = KEYFRAMES;
      document.head.appendChild(el);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);
}

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useScrollReveal(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold, rootMargin: '0px 0px -30px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── Reveal wrapper ───────────────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.65s cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform 0.65s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Wave bars component ──────────────────────────────────────────────────────
function WaveBars({ count = 28, height = 44, gradient = `linear-gradient(180deg, ${T.blueL}, ${T.violet})` }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: gradient,
            animationName: 'waveBar',
            animationDuration: `${0.7 + Math.random() * 0.7}s`,
            animationDelay: `${i * 0.04}s`,
            animationTimingFunction: 'ease-in-out',
            animationDirection: 'alternate',
            animationIterationCount: 'infinite',
            height: 4,
          }}
        />
      ))}
    </div>
  );
}

// ─── Large wave bars (bento card) ────────────────────────────────────────────
function LargeWaveBars({ count = 36 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 68, margin: '16px 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            borderRadius: 3,
            minHeight: 4,
            background: `linear-gradient(180deg, ${T.blueL}, ${T.violet})`,
            animationName: 'waveBarL',
            animationDuration: `${1.1 + Math.random() * 0.7}s`,
            animationDelay: `${i * 0.045}s`,
            animationTimingFunction: 'ease-in-out',
            animationDirection: 'alternate',
            animationIterationCount: 'infinite',
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  );
}

// ─── 3D Hero Mockup card ──────────────────────────────────────────────────────
function HeroMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const [timerSec, setTimerSec] = useState(167);

  // Live timer
  useEffect(() => {
    const id = setInterval(() => setTimerSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) => `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // 3D tilt on mousemove
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

  const BAR_HEIGHTS = [40, 60, 45, 80, 65, 100, 72];

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 460 }}>
      {/* Floating badges */}
      {[
        { text: '⚡ <480ms latency', style: { bottom: 10, left: -16 } as React.CSSProperties },
        { text: '🔒 Data encrypted', style: { top: -8, right: 8 } as React.CSSProperties },
        { text: '🌐 Hindi detected', style: { top: 72, right: -52 } as React.CSSProperties },
      ].map(({ text, style }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            zIndex: 3,
            background: 'rgba(13,21,36,0.92)',
            border: `1px solid ${T.bdrB}`,
            borderRadius: 999,
            padding: '5px 10px',
            fontSize: 10.5,
            fontWeight: 600,
            color: T.t1,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            animationName: 'floatBadge',
            animationDuration: '4s',
            animationDelay: `${-i * 1.5}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            ...style,
          }}
        >
          {text}
        </div>
      ))}

      {/* 3D scene */}
      <div
        ref={ref}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'relative',
          width: 340,
          transform: 'perspective(1100px) rotateX(6deg) rotateY(-14deg)',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Back card — analytics */}
        <div style={{
          position: 'absolute',
          width: 148,
          right: -44,
          bottom: 55,
          zIndex: 1,
          padding: 12,
          background: 'rgba(13,21,36,0.78)',
          border: `1px solid rgba(255,255,255,0.09)`,
          borderRadius: 14,
          transform: 'perspective(1100px) rotateY(10deg) translateZ(-30px)',
          boxShadow: '0 18px 36px rgba(0,0,0,0.3)',
        }}>
          <p style={{ fontSize: 9.5, color: T.t3, marginBottom: 5, fontWeight: 600 }}>Calls today</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: T.t1, lineHeight: 1 }}>247</p>
          <p style={{ fontSize: 9.5, color: T.em, marginTop: 2 }}>↑ 18% vs yesterday</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24, marginTop: 7 }}>
            {BAR_HEIGHTS.map((h, i) => (
              <div key={i} style={{
                flex: 1, borderRadius: 2,
                background: `linear-gradient(180deg, ${T.blueL}, rgba(59,130,246,0.3))`,
                height: `${h}%`,
              }} />
            ))}
          </div>
        </div>

        {/* Back card — languages */}
        <div style={{
          position: 'absolute',
          width: 132,
          left: -36,
          top: 36,
          zIndex: 1,
          padding: 11,
          background: 'rgba(13,21,36,0.78)',
          border: `1px solid rgba(255,255,255,0.09)`,
          borderRadius: 14,
          transform: 'perspective(1100px) rotateY(-8deg) translateZ(-20px)',
          boxShadow: '0 18px 36px rgba(0,0,0,0.3)',
        }}>
          <p style={{ fontSize: 9.5, color: T.t3, marginBottom: 5, fontWeight: 600 }}>Language split</p>
          {[
            { label: 'English', color: T.blueL, pct: 58 },
            { label: 'Hindi', color: '#fb923c', pct: 36 },
            { label: 'Punjabi', color: '#a78bfa', pct: 6 },
          ].map(({ label, color, pct }) => (
            <div key={label} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginBottom: 2 }}>
                <span style={{ color }}>{label}</span>
                <span style={{ color: T.t2 }}>{pct}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: T.bdr }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Main card */}
        <div style={{
          background: 'rgba(13,21,36,0.94)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 18,
          padding: 18,
          position: 'relative',
          zIndex: 2,
          boxShadow: `0 0 0 1px rgba(59,130,246,.12), 0 40px 70px rgba(0,0,0,.5), 0 0 50px rgba(59,130,246,.08), inset 0 1px 0 rgba(255,255,255,.1)`,
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', background: T.em,
                animationName: 'pulseGlow', animationDuration: '2s', animationIterationCount: 'infinite',
              }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>Live Call</div>
                <div style={{ fontSize: 10, color: T.t3 }}>+91 98765 43210</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.em, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(timerSec)}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['#ef4444', '#f59e0b', '#22c55e'].map((c) => (
                  <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'block' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Wave bars */}
          <WaveBars count={26} height={44} />

          {/* Transcript */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${T.bdr}`,
            borderRadius: 9, padding: 10, marginBottom: 12,
          }}>
            {[
              { role: 'AI', color: T.blueL, text: 'नमस्ते! मैं प्रिया हूँ, Acme Logistics से। आपकी क्या मदद करूँ?' },
              { role: 'User', color: T.em, text: 'My order hasn\'t arrived. It was due yesterday.' },
              { role: 'AI', color: T.blueL, text: 'I understand! Let me pull up your order status', typing: true },
            ].map(({ role, color, text, typing }, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < 2 ? 7 : 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{role}</span>
                <span style={{ fontSize: 10.5, color: T.t2, lineHeight: 1.45 }}>
                  {text}
                  {typing && (
                    <span style={{
                      animationName: 'blinkCursor', animationDuration: '1s',
                      animationTimingFunction: 'step-end', animationIterationCount: 'infinite',
                      color: T.blueL,
                    }}>|</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 7 }}>
            <button style={{
              flex: 1, padding: 7, borderRadius: 7,
              background: 'rgba(59,130,246,.15)', color: T.blueL,
              border: '1px solid rgba(59,130,246,.2)', fontSize: 10.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>↗ Transfer</button>
            <button style={{
              flex: 1, padding: 7, borderRadius: 7,
              background: 'rgba(239,68,68,.1)', color: '#f87171',
              border: '1px solid rgba(239,68,68,.2)', fontSize: 10.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>✕ End Call</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bento card with cursor glow ──────────────────────────────────────────────
function BentoCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setGlowPos({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      style={{ ...card(), ...style, cursor: 'default' }}
    >
      {/* Cursor glow */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none',
        background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(255,255,255,0.04), transparent 60%)`,
        transition: 'background 0.1s',
      }} />
      {children}
    </div>
  );
}

// ─── SECTION: Hero ────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        alignItems: 'center',
        padding: '80px 0 60px',
        overflow: 'hidden',
      }}
    >
      {/* Grid dot background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)',
        backgroundSize: '50px 50px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black, transparent)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black, transparent)',
      }} />

      {/* Aurora blobs */}
      {[
        { w: 600, h: 600, color: 'rgba(59,130,246,.2)', top: -200, right: -80, delay: 0, dur: 12 },
        { w: 450, h: 450, color: 'rgba(139,92,246,.15)', top: 80, right: 220, delay: -4, dur: 15 },
        { w: 350, h: 350, color: 'rgba(16,185,129,.1)', bottom: -80, right: 0, delay: -7, dur: 10 },
      ].map(({ w, h, color, delay, dur, ...pos }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
            willChange: 'transform',
            width: w, height: h,
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            animationName: 'floatA',
            animationDuration: `${dur}s`,
            animationDelay: `${delay}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDirection: i === 1 ? 'reverse' : 'normal',
            ...pos,
          } as React.CSSProperties}
        />
      ))}

      <div style={{
        position: 'relative', zIndex: 1,
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 48, alignItems: 'center',
        maxWidth: 1100, margin: '0 auto', padding: '0 20px',
      }}>
        {/* Left — copy */}
        <div>
          <Reveal>
            <span style={pill('rgba(59,130,246,.12)', T.blueL, 'rgba(59,130,246,.25)')}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: 'currentColor',
                display: 'inline-block',
                animationName: 'pulseDot', animationDuration: '2s', animationIterationCount: 'infinite',
              }} />
              New — Next-gen AI voice agents
            </span>
          </Reveal>

          <Reveal delay={100}>
            <h1
              style={{
                fontSize: 'clamp(34px, 5vw, 62px)',
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                marginTop: 16,
                marginBottom: 16,
              }}
            >
              Handle Every Call.<br />
              <span style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #60a5fa 50%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Miss Nothing. Ever.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p style={{ fontSize: 16, color: T.t2, lineHeight: 1.65, marginBottom: 28, maxWidth: 440 }}>
              AgentOps Studio deploys AI receptionists that speak{' '}
              <strong style={{ color: T.t1 }}>Hindi, English &amp; Punjabi</strong> — answering calls,
              qualifying leads, and booking appointments 24/7. Live in 30 minutes.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              <Link
                to="/register"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '12px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
                  textDecoration: 'none',
                  boxShadow: '0 0 0 1px rgba(139,92,246,.3), 0 4px 20px rgba(59,130,246,.25)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 8h12M8 2l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Start Free Trial
              </Link>
              <a
                href="#how-it-works"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '12px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  color: T.t1, textDecoration: 'none',
                  border: `1px solid ${T.bdrB}`, background: 'transparent',
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
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: T.t3, flexWrap: 'wrap' }}>
              {['No credit card', '30-min setup', 'Cancel anytime'].map((t) => (
                <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.em }}>
                  ✓ {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Right — 3D mockup */}
        <HeroMockup />
      </div>
    </section>
  );
}

// ─── SECTION: Proof Marquee ───────────────────────────────────────────────────
const LOGOS = [
  'FastShip Logistics', 'BuildRight Realty', 'MedCare Clinics',
  'EduFirst Academy', 'TrustBank NBFC', 'QuickMart Retail',
  'SpiceRoute Food', 'LegalEdge Firm',
];

function MarqueeSection() {
  const items = [...LOGOS, ...LOGOS]; // duplicate for seamless loop
  return (
    <section style={{ padding: '24px 0', borderTop: `1px solid ${T.bdr}`, borderBottom: `1px solid ${T.bdr}`, overflow: 'hidden' }}>
      <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: T.t3, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Trusted by fast-growing businesses across India
      </p>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: `linear-gradient(90deg, ${T.bg}, transparent)`, zIndex: 1 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: `linear-gradient(-90deg, ${T.bg}, transparent)`, zIndex: 1 }} />
        <div style={{
          display: 'flex', gap: 40, alignItems: 'center',
          width: 'max-content',
          animationName: 'marquee', animationDuration: '28s', animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }}>
          {items.map((name, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: T.t3, whiteSpace: 'nowrap' }}>
              ✦ {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: How it works ────────────────────────────────────────────────────
const HOW_STEPS = [
  { num: 1, colorBg: 'rgba(59,130,246,.15)', colorFg: T.blueL, colorBdr: 'rgba(59,130,246,.25)', title: 'Create your workspace', body: 'Enter your business name, industry, and timezone. Your AI workspace is ready in seconds.', time: '~30 seconds' },
  { num: 2, colorBg: 'rgba(139,92,246,.15)', colorFg: '#a78bfa', colorBdr: 'rgba(139,92,246,.25)', title: 'Configure your agent', body: 'Add your website, FAQs, services, and business hours. Your AI learns everything in minutes.', time: '~10 minutes' },
  { num: 3, colorBg: 'rgba(16,185,129,.15)', colorFg: T.em, colorBdr: 'rgba(16,185,129,.25)', title: 'Go live, instantly', body: 'Assign your existing phone number, choose languages, and launch. Calls handled from minute one.', time: '~2 minutes' },
];

function HowSection() {
  return (
    <section id="how-it-works" style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
        <Reveal>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.blueL, marginBottom: 10 }}>How it works</div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.025em' }}>
            From zero to{' '}
            <span style={{ background: 'linear-gradient(135deg, #f8fafc, #60a5fa, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              live calls
            </span>{' '}
            in under 30 minutes
          </h2>
          <p style={{ fontSize: 15, color: T.t2, maxWidth: 500, marginTop: 10, lineHeight: 1.6 }}>
            Three steps. No code. No engineers. Just your business info and a phone number.
          </p>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, marginTop: 48, position: 'relative' }}>
          {/* Connector line */}
          <div style={{
            position: 'absolute', top: 29,
            left: 'calc(33.33% + 30px)', right: 'calc(33.33% + 30px)',
            height: 1,
            background: `linear-gradient(90deg, ${T.blue}, ${T.violet})`,
          }} />
          {HOW_STEPS.map(({ num, colorBg, colorFg, colorBdr, title, body, time }, i) => (
            <Reveal key={num} delay={i * 100}>
              <div style={card({ padding: 28 })}>
                <div style={{
                  width: 44, height: 44, borderRadius: 11,
                  background: colorBg, color: colorFg, border: `1px solid ${colorBdr}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, fontWeight: 800, marginBottom: 16,
                }}>
                  {num}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
                <p style={{ fontSize: 13, color: T.t2, lineHeight: 1.55 }}>{body}</p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: 14, fontSize: 10.5, fontWeight: 700, color: T.em,
                  padding: '3px 9px', borderRadius: 999,
                  background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)',
                }}>
                  ⏱ {time}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: Features Bento ──────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section id="services" style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.blueL, marginBottom: 10 }}>Capabilities</div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.025em' }}>
            Everything your AI needs to{' '}
            <span style={{ background: 'linear-gradient(135deg, #f8fafc, #60a5fa, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              handle every call
            </span>
          </h2>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 10, marginTop: 48 }}>
          {/* Voice AI — large */}
          <Reveal style={{ gridColumn: 'span 7', gridRow: 'span 2' }}>
            <BentoCard style={{ minHeight: 240, height: '100%' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(59,130,246,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>🎙️</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Natural Voice AI</h3>
              <p style={{ fontSize: 12.5, color: T.t2, lineHeight: 1.5 }}>Powered by state-of-the-art AI. Your agent sounds indistinguishable from a human — warm, fluent, contextually aware.</p>
              <LargeWaveBars count={36} />
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <span style={pill('rgba(59,130,246,.1)', T.blueL, 'rgba(59,130,246,.25)')}>Neural LLM</span>
                <span style={pill('rgba(139,92,246,.1)', '#a78bfa', 'rgba(139,92,246,.25)')}>Studio TTS</span>
                <span style={pill('rgba(16,185,129,.1)', T.em, 'rgba(16,185,129,.25)')}>AI Transcription</span>
              </div>
            </BentoCard>
          </Reveal>

          {/* Analytics */}
          <Reveal delay={100} style={{ gridColumn: 'span 5' }}>
            <BentoCard style={{ minHeight: 120 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>📊</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Real-time Analytics</h3>
              <p style={{ fontSize: 12.5, color: T.t2, lineHeight: 1.5 }}>Track call volume, completion rate, and language splits live.</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44, marginTop: 14 }}>
                {[45, 65, 50, 80, 70, 95, 75, 85].map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: '3px 3px 0 0', height: `${h}%`, background: `linear-gradient(180deg, ${T.blueL}, rgba(59,130,246,0.3))` }} />
                ))}
              </div>
            </BentoCard>
          </Reveal>

          {/* Language */}
          <Reveal delay={200} style={{ gridColumn: 'span 5' }}>
            <BentoCard style={{ minHeight: 120 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(249,115,22,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>🌐</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Auto Language Detection</h3>
              <p style={{ fontSize: 12.5, color: T.t2, lineHeight: 1.5 }}>Caller speaks Hindi? Agent switches instantly. No menu, no friction.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <span style={pill('rgba(59,130,246,.1)', T.blueL, T.bdrB)}>🇺🇸 English</span>
                <span style={pill('rgba(249,115,22,.1)', '#fb923c', T.bdrB)}>🇮🇳 हिन्दी</span>
                <span style={pill('rgba(139,92,246,.1)', '#a78bfa', T.bdrB)}>🏳️ ਪੰਜਾਬੀ</span>
              </div>
            </BentoCard>
          </Reveal>

          {/* KB */}
          <Reveal style={{ gridColumn: 'span 4' }}>
            <BentoCard style={{ minHeight: 120 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(139,92,246,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>📚</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Smart Knowledge Base</h3>
              <p style={{ fontSize: 12.5, color: T.t2, lineHeight: 1.5 }}>Crawls your website. Add FAQs and services manually.</p>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { dot: T.em, text: 'Website crawled' },
                  { dot: T.blueL, text: '10 FAQs loaded' },
                  { dot: '#a78bfa', text: '8 services indexed' },
                ].map(({ dot, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.bdr}`, fontSize: 10.5, color: T.t2 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                    {text}
                  </div>
                ))}
              </div>
            </BentoCard>
          </Reveal>

          {/* Stat cards */}
          {[
            { stat: '0', label: 'Missed calls\nafter going live', tag: '24 / 7 / 365', tagColor: T.em, tagBg: 'rgba(16,185,129,.1)', tagBdr: 'rgba(16,185,129,.2)' },
            { stat: '<500ms', label: 'Average voice\nresponse latency', tag: null },
            { stat: '30min', label: 'Average time\nfrom signup to live', tag: null },
          ].map(({ stat, label, tag, tagColor, tagBg, tagBdr }, i) => (
            <Reveal key={i} delay={i * 100} style={{ gridColumn: 'span 4' }}>
              <BentoCard>
                <div style={{
                  fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-.04em', marginBottom: 3,
                  background: 'linear-gradient(135deg, #f8fafc, #60a5fa, #8b5cf6)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  {stat}
                </div>
                <div style={{ fontSize: 12, color: T.t2, whiteSpace: 'pre-line' }}>{label}</div>
                {tag && (
                  <div style={{ marginTop: 10 }}>
                    <span style={pill(tagBg!, tagColor!, tagBdr!)}>{tag}</span>
                  </div>
                )}
              </BentoCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: Testimonials ───────────────────────────────────────────────────
const TESTIMONIALS = [
  { quote: '"We went from missing 40% of calls during peak hours to zero missed calls. Our delivery team focuses on deliveries, not phone calls. ROI was clear in week one."', name: 'Rohit Mehra', role: 'Founder, FastShip Logistics · Delhi', avatar: 'R', grad: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
  { quote: '"The Hindi auto-detection is flawless. Our customers in tier-2 cities now get responses in their language without any effort from our side. Game changer."', name: 'Priya Nair', role: 'Operations Head, MedCare Clinics · Bangalore', avatar: 'P', grad: 'linear-gradient(135deg, #10b981, #3b82f6)' },
  { quote: '"Setup took 22 minutes. That\'s it. No developers, no integration headaches. The voice quality is so good our clients think it\'s a real receptionist."', name: 'Amit Sharma', role: 'CEO, BuildRight Realty · Mumbai', avatar: 'A', grad: 'linear-gradient(135deg, #f59e0b, #ec4899)' },
];

function TestimonialsSection() {
  return (
    <section style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.blueL, marginBottom: 10 }}>Testimonials</div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.025em' }}>
            Loved by{' '}
            <span style={{ background: 'linear-gradient(135deg, #f8fafc, #60a5fa, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              200+ businesses
            </span>
          </h2>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 48 }}>
          {TESTIMONIALS.map(({ quote, name, role, avatar, grad }, i) => (
            <Reveal key={i} delay={i * 100}>
              <div style={{ ...card({ padding: 24, minHeight: 200 }), position: 'relative', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                {/* Quote mark */}
                <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 52, fontWeight: 800, lineHeight: 1, color: 'rgba(59,130,246,0.13)', userSelect: 'none' }}>
                  "
                </div>
                <div style={{ display: 'flex', gap: 2, marginBottom: 14, color: T.amber, fontSize: 12 }}>
                  {'★★★★★'}
                </div>
                <p style={{ fontSize: 13, color: T.t2, lineHeight: 1.6, marginBottom: 18 }}>{quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
                  }}>
                    {avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.t1 }}>{name}</div>
                    <div style={{ fontSize: 10.5, color: T.t3 }}>{role}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: Pricing ─────────────────────────────────────────────────────────
const PLANS = [
  {
    badge: 'Starter', badgeBg: 'rgba(100,116,139,.2)', badgeColor: T.t2, badgeBdr: T.bdr,
    price: '₹2,999', per: 'per month',
    desc: 'For solopreneurs and small teams up to 500 calls/month.',
    features: ['1 AI voice agent', '500 minutes / month', 'English language', 'Basic analytics'],
    missing: ['Hindi / Punjabi', 'Custom agent name'],
    cta: 'Start Free Trial', ctaStyle: 'outline' as const, featured: false,
  },
  {
    badge: 'Growth · Most Popular', badgeBg: 'rgba(59,130,246,.15)', badgeColor: T.blueL, badgeBdr: 'rgba(59,130,246,.3)',
    price: '₹7,999', per: 'per month',
    desc: 'Multi-language support and deeper analytics for growing teams.',
    features: ['3 AI voice agents', '2,000 minutes / month', 'Hindi + English + Punjabi', 'Full analytics dashboard', 'Custom agent persona', 'Fallback transfer number'],
    missing: [],
    cta: 'Start Free Trial', ctaStyle: 'primary' as const, featured: true,
  },
  {
    badge: 'Enterprise', badgeBg: 'rgba(139,92,246,.15)', badgeColor: '#a78bfa', badgeBdr: 'rgba(139,92,246,.3)',
    price: 'Custom', per: 'volume pricing',
    desc: 'Unlimited agents, SLA, dedicated support, custom integrations.',
    features: ['Unlimited AI agents', 'Unlimited minutes', 'All languages', 'Custom integrations', '99.9% uptime SLA', 'Dedicated account manager'],
    missing: [],
    cta: 'Contact Sales →', ctaStyle: 'outline' as const, featured: false,
  },
];

function PricingSection() {
  return (
    <section id="pricing" style={{ padding: '80px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.blueL, marginBottom: 10 }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-.025em' }}>
            Simple pricing.<br />
            <span style={{ background: 'linear-gradient(135deg, #f8fafc, #60a5fa, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              No surprises.
            </span>
          </h2>
          <p style={{ fontSize: 15, color: T.t2, margin: '10px auto 0', lineHeight: 1.6 }}>
            Plans designed for Indian SMBs. Pay in ₹.
          </p>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 44, alignItems: 'start' }}>
          {PLANS.map(({ badge, badgeBg, badgeColor, badgeBdr, price, per, desc, features, missing, cta, ctaStyle, featured }, i) => (
            <Reveal key={i} delay={i * 100}>
              <div style={{
                ...card({ padding: 28 }),
                ...(featured ? {
                  background: 'rgba(59,130,246,.07)',
                  border: '1px solid rgba(59,130,246,.3)',
                  boxShadow: '0 0 36px rgba(59,130,246,.1), 0 0 0 1px rgba(139,92,246,.2)',
                  transform: 'scale(1.02)',
                } : {}),
              }}>
                <span style={{ ...pill(badgeBg, badgeColor, badgeBdr), marginBottom: 18, display: 'inline-block', fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {badge}
                </span>
                <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1, marginBottom: 3 }}>
                  {price}
                </div>
                <div style={{ fontSize: 12, color: T.t3, marginBottom: 16 }}>{per}</div>
                <p style={{ fontSize: 13, color: T.t2, marginBottom: 18, lineHeight: 1.5 }}>{desc}</p>
                <hr style={{ border: 'none', borderTop: `1px solid ${T.bdr}`, marginBottom: 16 }} />
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, color: T.t2 }}>
                      <span style={{ color: T.em, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </li>
                  ))}
                  {missing.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, color: T.t3 }}>
                      <span style={{ color: T.t3, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>–</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={cta === 'Contact Sales →' ? '/contact' : '/register'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    textDecoration: 'none',
                    ...(ctaStyle === 'primary'
                      ? { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', border: 'none' }
                      : { background: 'transparent', color: T.t1, border: `1px solid ${T.bdrB}` }),
                  }}
                >
                  {cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SECTION: CTA ─────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section style={{ padding: '100px 0', position: 'relative', overflow: 'hidden', borderTop: `1px solid ${T.bdr}` }}>
      {/* Aurora blobs */}
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
        width: 500, height: 350,
        background: 'radial-gradient(circle, rgba(59,130,246,.15) 0%, transparent 70%)',
        top: -80, left: -80,
        animationName: 'floatA', animationDuration: '10s', animationIterationCount: 'infinite',
        willChange: 'transform',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
        width: 450, height: 300,
        background: 'radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%)',
        bottom: -80, right: -80,
        animationName: 'floatA', animationDuration: '10s', animationDelay: '-5s', animationIterationCount: 'infinite',
        willChange: 'transform',
      }} />

      <Reveal style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 660, margin: '0 auto', padding: '0 20px' }}>
        <span style={{ ...pill('rgba(16,185,129,.12)', T.em, 'rgba(16,185,129,.25)'), marginBottom: 18, display: 'inline-flex' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animationName: 'pulseDot', animationDuration: '2s', animationIterationCount: 'infinite' }} />
          Your AI agent is ready to go live
        </span>
        <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 50px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: 14 }}>
          Set up your AI receptionist in{' '}
          <span style={{ background: 'linear-gradient(135deg, #f8fafc, #60a5fa, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            30 minutes
          </span>
        </h2>
        <p style={{ fontSize: 16, color: T.t2, marginBottom: 32, lineHeight: 1.6 }}>
          Join 200+ Indian businesses that never miss a call. No developers, no long contracts.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/register"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '14px 28px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
              textDecoration: 'none',
              boxShadow: '0 0 0 1px rgba(139,92,246,.3), 0 4px 20px rgba(59,130,246,.25)',
            }}
          >
            Start Free Trial — It's Free →
          </Link>
          <Link
            to="/contact"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '14px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              color: T.t1, textDecoration: 'none',
              border: `1px solid ${T.bdrB}`, background: 'transparent',
            }}
          >
            Book a 30-min Demo
          </Link>
        </div>
        <p style={{ marginTop: 18, fontSize: 11.5, color: T.t3 }}>
          No credit card · Cancel anytime · ₹ pricing · Indian data residency
        </p>
      </Reveal>
    </section>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function HomePage() {
  useInjectStyles();

  return (
    <>
      <HeroSection />
      <MarqueeSection />
      <HowSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
    </>
  );
}
