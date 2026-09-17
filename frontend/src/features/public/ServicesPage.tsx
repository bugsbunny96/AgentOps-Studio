/**
 * ServicesPage — What AgentOps Studio does
 * Route: /services (public)
 *
 * Sections:
 *   1. Hero
 *   2. 6-service grid
 *   3. How it works (4 steps)
 *   4. Tech stack trust bar
 *   5. Bottom CTA
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const T = {
  bg: '#030712', bgS: '#0d1524',
  bgC: 'rgba(255,255,255,0.03)', bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  blue: '#3b82f6', violet: '#8b5cf6', em: '#10b981', amber: '#f59e0b',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  fontSize: 11, fontWeight: 700, padding: '4px 10px',
  borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
});

const cardBase = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 18, padding: 28,
  overflow: 'hidden', position: 'relative',
  transition: 'border-color 0.3s, transform 0.3s cubic-bezier(0.4,0,0.2,1)', ...extra,
});

const KF = `
  @keyframes sp-float{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(20px,-15px) scale(1.03)}70%{transform:translate(-10px,18px) scale(.97)}}
`;

function useKF() {
  useEffect(() => {
    const id = 'sp-kf';
    if (!document.getElementById(id)) { const el = document.createElement('style'); el.id = id; el.textContent = KF; document.head.appendChild(el); }
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.08 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(22px)', transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms` }}>{children}</div>;
}

const SERVICES = [
  { icon: '📞', label: 'Inbound AI Receptionist', color: T.em,
    desc: 'Never miss a call. Your AI agent answers 24/7, handles FAQs, books appointments, and routes urgent calls — in Hindi, English, or Punjabi.',
    bullets: ['Instant call pickup, every time', 'FAQ resolution in <2 seconds', 'Business-hours enforcement + fallback', 'Custom greeting per campaign'] },
  { icon: '📤', label: 'Outbound AI Calling', color: T.blue,
    desc: 'Launch proactive campaigns at scale. Schedule follow-ups, payment reminders, delivery confirmations, and appointment reminders with a single click.',
    bullets: ['One-click outbound dial', 'Personalised scripts per lead', 'Call outcome tracking', 'Auto retry on no-answer'] },
  { icon: '🧠', label: 'Knowledge Base Builder', color: T.violet,
    desc: 'Feed your AI agent everything it needs to know. Import your website, upload FAQs, or type docs manually — your agent learns in minutes.',
    bullets: ['Website auto-crawl', 'Manual text + FAQ import', 'Instant re-sync', 'Injected live into every call'] },
  { icon: '📊', label: 'Call Analytics', color: T.amber,
    desc: 'See exactly what your customers are asking. AI-summarised transcripts, duration trends, cost-per-call, and weekly KPI snapshots — all in one place.',
    bullets: ['Full call transcripts', 'AI-generated summaries', 'Cost & duration tracking', 'Hourly call volume chart'] },
  { icon: '👥', label: 'Team Access Control', color: '#ec4899',
    desc: 'Invite your ops team without sharing passwords. Set granular permissions per section with full visibility over who accessed what.',
    bullets: ['Owner + Member roles', 'Per-section permissions', 'Invitation via email', 'No shared credentials'] },
  { icon: '🌐', label: 'Multi-Language Voice', color: '#f97316',
    desc: 'Auto-detect the language your caller speaks and respond in kind. Serve Hindi-speaking customers with the same quality as English-first flows.',
    bullets: ['Hindi auto-detection', 'English + Punjabi support', 'Same agent, any language', 'Language fallback chain'] },
];

const STEPS = [
  { n: '01', title: 'Connect', desc: 'Add your business details, hours, and website. We crawl and build your knowledge base automatically — no manual entry needed.' },
  { n: '02', title: 'Train', desc: 'Review what the AI learned. Add FAQs, custom scripts, and fallback behaviours in plain English. No prompt engineering required.' },
  { n: '03', title: 'Activate', desc: 'Connect your Vobiz phone number. Your agent goes live in under 5 minutes and handles calls immediately.' },
  { n: '04', title: 'Optimise', desc: 'Review real transcripts, tweak scripts based on actual calls, and watch your cost-per-call drop week over week.' },
];

const STACK = ['Vapi AI', 'Deepgram STT', 'GPT-4o', 'ElevenLabs TTS', 'Vobiz SIP', 'MongoDB Atlas'];

export default function ServicesPage() {
  useKF();
  return (
    <div style={{ background: T.bg, color: T.t1, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(80px,10vw,120px) 24px 80px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', animation: 'sp-float 12s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '20%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', animation: 'sp-float 9s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ position: 'relative', maxWidth: 700, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <span style={pill('rgba(16,185,129,0.1)', T.em, 'rgba(16,185,129,0.25)')}>● Full Voice AI Platform</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-0.03em' }}>
            Every tool your{' '}
            <span style={{ background: `linear-gradient(135deg, ${T.em}, ${T.blue})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>voice operations</span>
            {' '}need
          </h1>
          <p style={{ color: T.t2, fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.7, margin: '0 0 36px' }}>
            From first ring to final transcript — one platform that handles inbound calls, fires outbound campaigns, learns from your knowledge base, and gives you analytics to cut cost per call every week.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" style={{ padding: '13px 28px', borderRadius: 10, background: T.em, color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>Start free →</Link>
            <Link to="/pricing" style={{ padding: '13px 28px', borderRadius: 10, background: 'transparent', color: T.t1, fontWeight: 600, fontSize: 15, textDecoration: 'none', border: `1px solid ${T.bdrB}`, display: 'inline-flex', alignItems: 'center' }}>See pricing</Link>
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Reveal>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, marginBottom: 10 }}>Six capabilities, one platform</h2>
          <p style={{ textAlign: 'center', color: T.t2, fontSize: 15, marginBottom: 48, maxWidth: 520, margin: '0 auto 48px' }}>No stitching together six tools. Everything runs from a single dashboard your team learns in an afternoon.</p>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {SERVICES.map((s, i) => (
            <Reveal key={s.label} delay={i * 55}>
              <div
                style={cardBase()}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.bdrB; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.bdr; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 24, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${s.color}18`, borderRadius: 14, border: `1px solid ${s.color}30` }}>{s.icon}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: T.t1, margin: 0 }}>{s.label}</h3>
                </div>
                <p style={{ color: T.t2, fontSize: 13.5, lineHeight: 1.7, margin: '0 0 14px' }}>{s.desc}</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {s.bullets.map(b => (
                    <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.t2 }}>
                      <span style={{ color: s.color, fontWeight: 800, fontSize: 11 }}>✓</span>{b}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: T.bgS, padding: '80px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, marginBottom: 10 }}>From zero to live in 30 minutes</h2>
            <p style={{ textAlign: 'center', color: T.t2, fontSize: 15, marginBottom: 56, maxWidth: 480, margin: '0 auto 56px' }}>No engineers, no IT budget. If you can fill out a form, you can deploy an AI receptionist.</p>
          </Reveal>
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 80}>
              <div style={{ display: 'flex', gap: 24, paddingBottom: i < STEPS.length - 1 ? 36 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${T.em}, ${T.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>{step.n}</div>
                  {i < STEPS.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 28, background: `linear-gradient(to bottom, ${T.em}50, transparent)`, marginTop: 6 }} />}
                </div>
                <div style={{ paddingTop: 8 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>{step.title}</h3>
                  <p style={{ color: T.t2, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Stack */}
      <section style={{ padding: '60px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <p style={{ color: T.t3, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>Powered by enterprise-grade infrastructure</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {STACK.map(name => (
                <span key={name} style={{ padding: '8px 18px', borderRadius: 8, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, fontSize: 13, fontWeight: 600 }}>{name}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: '40px 24px 100px', textAlign: 'center' }}>
        <Reveal>
          <div style={{ maxWidth: 560, margin: '0 auto', background: `linear-gradient(135deg, ${T.em}15, ${T.blue}10)`, border: `1px solid ${T.em}30`, borderRadius: 24, padding: 'clamp(32px,5vw,56px)' }}>
            <h2 style={{ fontSize: 'clamp(20px,3vw,30px)', fontWeight: 800, marginBottom: 10 }}>Ready to deploy your first agent?</h2>
            <p style={{ color: T.t2, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>Start free — no credit card required. Live in under 30 minutes.</p>
            <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 32px', borderRadius: 10, background: T.em, color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', gap: 8 }}>Create your free account →</Link>
          </div>
        </Reveal>
      </section>

    </div>
  );
}
