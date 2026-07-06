/**
 * AuthLayout — split-screen layout for login / register / forgot-password.
 *
 * Left panel  (lg+): dark gradient brand panel with animated orbs + tagline
 * Right panel       : white clean form area — consistent with dashboard design system
 *
 * Design tokens match the landing page (dark #030712 gradient) and dashboard
 * (slate type system). Uses real brand logo assets from assets/logos/.
 */

import { Outlet, Link } from 'react-router-dom';
import { useEffect } from 'react';
import agentopsIcon from '@/assets/logos/agentops-icon.svg';
import agentopsIconReversed from '@/assets/logos/agentops-icon-reversed.svg';

// ── Keyframes injected once ───────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes authOrbFloat {
    0%,100%{transform:translate(0,0) scale(1)}
    40%{transform:translate(18px,-22px) scale(1.05)}
    70%{transform:translate(-10px,14px) scale(.97)}
  }
  @keyframes authGridFade {
    from{opacity:0} to{opacity:1}
  }
  @keyframes authReveal {
    from{opacity:0;transform:translateY(14px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes authPulseDot {
    0%,100%{opacity:1;transform:scale(1)}
    50%{opacity:.45;transform:scale(.75)}
  }
`;

function useAuthStyles() {
  useEffect(() => {
    const id = 'auth-layout-kf';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = KEYFRAMES;
      document.head.appendChild(el);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

// ── Feature bullets shown in the brand panel ──────────────────────────────────
const FEATURES = [
  { icon: '🎙️', text: 'AI voice agent — live in minutes' },
  { icon: '🌐', text: 'Hindi, Punjabi & English — auto-detect' },
  { icon: '📊', text: 'Call transcripts & analytics' },
  { icon: '🔒', text: 'Enterprise-grade security' },
];

export function AuthLayout() {
  useAuthStyles();

  return (
    <div className="flex min-h-screen">

      {/* ── Left: Brand panel (visible lg+) ────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-shrink-0 flex-col
          relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #030712 0%, #0d1524 50%, #0f0a1e 100%)' }}
      >
        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)`,
            backgroundSize: '36px 36px',
            animation: 'authGridFade 1.2s ease forwards',
          }}
        />

        {/* Glow orbs */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '10%', right: '-60px', width: 280, height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,.28) 0%, transparent 70%)',
            animation: 'authOrbFloat 10s ease-in-out infinite',
            willChange: 'transform',
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: '15%', left: '-40px', width: 220, height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,.22) 0%, transparent 70%)',
            animation: 'authOrbFloat 13s ease-in-out infinite reverse',
            willChange: 'transform',
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            top: '50%', left: '30%', width: 160, height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,.15) 0%, transparent 70%)',
            animation: 'authOrbFloat 8s ease-in-out infinite',
          }}
        />

        {/* Content */}
        <div className="relative flex flex-col h-full px-10 py-10 z-10">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img src={agentopsIconReversed} alt="AgentOps" className="h-10 w-10 flex-shrink-0 rounded-xl" />
            <div>
              <p className="text-sm font-bold text-white tracking-tight leading-none">AgentOps</p>
              <p className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,.4)' }}>Studio</p>
            </div>
          </Link>

          {/* Hero copy */}
          <div className="flex-1 flex flex-col justify-center" style={{ animation: 'authReveal .9s ease forwards' }}>
            {/* Live badge */}
            <div
              className="inline-flex items-center gap-2 mb-6 w-fit rounded-full px-3 py-1.5"
              style={{
                border: '1px solid rgba(16,185,129,.3)',
                background: 'rgba(16,185,129,.1)',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: '#10b981',
                  animation: 'authPulseDot 2s ease-in-out infinite',
                  display: 'inline-block',
                }}
              />
              <span className="text-xs font-semibold" style={{ color: '#34d399' }}>
                AI-powered voice receptionists
              </span>
            </div>

            <h2
              className="text-3xl xl:text-4xl font-extrabold leading-tight mb-4"
              style={{ color: '#f8fafc', letterSpacing: '-0.02em' }}
            >
              Never miss a<br />
              <span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                customer call
              </span>{' '}again.
            </h2>

            <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(148,163,184,.85)', maxWidth: 340 }}>
              Set up your AI receptionist in under 10 minutes. It handles inbound calls,
              answers FAQs, and captures leads — 24 × 7, in any language.
            </p>

            {/* Feature list */}
            <div className="space-y-3">
              {FEATURES.map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base"
                    style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.09)' }}
                  >
                    {icon}
                  </span>
                  <span className="text-sm" style={{ color: 'rgba(203,213,225,.9)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer quote */}
          <div
            className="mt-auto pt-8 border-t"
            style={{ borderColor: 'rgba(255,255,255,.07)' }}
          >
            <p className="text-xs italic" style={{ color: 'rgba(100,116,139,.8)' }}>
              "Set up in 10 minutes. Customers never know it's AI."
            </p>
          </div>
        </div>
      </div>

      {/* ── Right: Form panel ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center
        bg-white min-h-screen px-6 py-10">

        {/* Mobile-only logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <img src={agentopsIcon} alt="AgentOps" className="h-9 w-9 rounded-xl" />
          <div>
            <p className="text-sm font-bold text-slate-900 tracking-tight">AgentOps</p>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">Studio</p>
          </div>
        </div>

        {/* Form card */}
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm
            ring-1 ring-slate-950/5">
            <Outlet />
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} AgentOps Studio. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
