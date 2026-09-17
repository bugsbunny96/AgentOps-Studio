/**
 * WhyUsPage — Differentiation + trust building
 * Route: /why-us (public)
 *
 * Sections:
 *   1. Hero
 *   2. Stat pillars
 *   3. Core differentiators (5 rows)
 *   4. vs-alternatives comparison table
 *   5. Objection accordion
 *   6. CTA
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
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
  padding: '4px 10px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
});

const KF = `@keyframes wu-float{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(22px,-14px) scale(1.03)}70%{transform:translate(-12px,16px) scale(.97)}}`;

function useKF() {
  useEffect(() => {
    const id = 'wu-kf';
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

const STATS = [
  { val: '<30', unit: 'min', label: 'Average setup time' },
  { val: '24/7', unit: '', label: 'Coverage, zero overtime' },
  { val: '3', unit: 'langs', label: 'Hindi · English · Punjabi' },
  { val: '₹0', unit: '', label: 'Setup fee, ever' },
];

const DIFFS = [
  { icon: '🇮🇳', title: 'Built for Indian SMBs', color: T.amber,
    body: 'Not a Western tool retrofitted for India. AgentOps Studio is designed around Indian phone behaviour: Hindi-first callers, Vobiz SIP infrastructure, INR pricing, and verticals that matter here — logistics, real estate, healthcare.' },
  { icon: '⚡', title: 'Live in 30 minutes, not 3 months', color: T.em,
    body: 'No enterprise sales cycle. No 6-month implementation. Sign up, paste your website URL, connect your number — your agent handles real calls before your next team standup.' },
  { icon: '🔒', title: 'Your data, your org', color: T.blue,
    body: 'Every org is fully isolated. Your transcripts, KB docs, and customer data never touch another tenant\'s records. Multi-tenant architecture with row-level org scoping on every database query.' },
  { icon: '💸', title: 'Predictable flat-rate pricing', color: T.violet,
    body: 'No surprise per-minute charges that blow your budget at month end. Flat monthly plans so your finance team can plan accurately. Upgrade when you need more — downgrade any time.' },
  { icon: '🧪', title: 'Enterprise voice stack, SMB price', color: '#f97316',
    body: 'The same stack used by enterprise contact centres — Vapi, Deepgram, GPT-4o, ElevenLabs — packaged at a price point a 5-person logistics company can actually afford.' },
];

const COMPARE_COLS = ['AgentOps Studio', 'Full-time receptionist', 'Generic chatbot', 'Build it yourself'];
const COMPARE = [
  { feature: 'Setup time',           vals: ['< 30 min',    '2–4 weeks',         '1–2 weeks',    '3–6 months'] },
  { feature: '24/7 availability',    vals: ['✅',           '❌ shift-limited',   '✅',            '✅'] },
  { feature: 'Hindi + English voice',vals: ['✅',           'Depends on hire',   '❌ text only',  '⚠️ extra dev'] },
  { feature: 'Outbound calling',     vals: ['✅',           '❌',                 '❌',            '⚠️ extra dev'] },
  { feature: 'Real-time transcripts',vals: ['✅',           '❌',                 'N/A',           '⚠️ extra dev'] },
  { feature: 'Monthly cost (SMB)',   vals: ['₹4,999+',      '₹25,000–60,000',    '₹8,000–20,000','₹2L+ setup'] },
  { feature: 'No-code setup',        vals: ['✅',           'N/A',               '⚠️ partial',   '❌'] },
];

const OBJECTIONS = [
  { q: 'Will my customers accept talking to an AI?',
    a: 'Yes — when the AI answers instantly, speaks their language, and solves their problem. Our agents respond in under 2 seconds, resolve 80–90% of common queries, and route the rest to your team. The bar is not "does it sound human?" — it\'s "did it solve my problem?" and ours does.' },
  { q: 'What if the AI says something wrong?',
    a: 'You control exactly what the agent knows. It only answers from your knowledge base — it won\'t hallucinate outside it. For anything out of scope, it routes to your fallback number. Review every transcript and update the KB in minutes.' },
  { q: 'Is my customer call data safe?',
    a: 'Absolutely. Every org is fully isolated in the database. Transcripts are stored encrypted, accessible only to your account. We don\'t use your customer data to train models. You own your data and can export or delete it any time.' },
];

export default function WhyUsPage() {
  useKF();
  const [openQ, setOpenQ] = useState<number | null>(null);

  return (
    <div style={{ background: T.bg, color: T.t1, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(80px,10vw,120px) 24px 72px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '5%', left: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)', animation: 'wu-float 14s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', animation: 'wu-float 10s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <span style={pill('rgba(16,185,129,0.1)', T.em, 'rgba(16,185,129,0.25)')}>● Why AgentOps Studio</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-0.03em' }}>
            The AI receptionist built{' '}
            <span style={{ background: `linear-gradient(135deg, ${T.em}, ${T.blue})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>for India</span>
          </h1>
          <p style={{ color: T.t2, fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.7, margin: '0 0 36px' }}>
            Most voice AI tools are built for US enterprise budgets. We built one for Indian SMBs who need 24/7 Hindi and English coverage, Vobiz SIP infrastructure, and flat-rate pricing their finance team can actually approve.
          </p>
          <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 32px', borderRadius: 10, background: T.em, color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', gap: 8 }}>Start free — live in 30 min →</Link>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 55}>
                <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: '24px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 900, color: T.t1, lineHeight: 1 }}>
                    {s.val}<span style={{ fontSize: '0.45em', color: T.em, marginLeft: 3 }}>{s.unit}</span>
                  </div>
                  <div style={{ color: T.t2, fontSize: 13, marginTop: 8 }}>{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section style={{ background: T.bgS, padding: '72px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, marginBottom: 10 }}>What makes us different</h2>
            <p style={{ textAlign: 'center', color: T.t2, fontSize: 15, marginBottom: 48, maxWidth: 500, margin: '0 auto 48px' }}>Five things we do that generic voice tools and full-stack agencies don't.</p>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {DIFFS.map((d, i) => (
              <Reveal key={d.title} delay={i * 55}>
                <div
                  style={{ display: 'flex', gap: 20, background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: '22px 26px', transition: 'border-color .3s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.bdrB}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.bdr}
                >
                  <div style={{ fontSize: 26, width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${d.color}18`, borderRadius: 14, border: `1px solid ${d.color}30`, flexShrink: 0 }}>{d.icon}</div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 5px', color: T.t1 }}>{d.title}</h3>
                    <p style={{ color: T.t2, fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>{d.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, marginBottom: 10 }}>AgentOps vs your other options</h2>
            <p style={{ textAlign: 'center', color: T.t2, fontSize: 15, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px' }}>We're not for everyone. But for Indian SMBs who need voice AI fast, we're the only real choice.</p>
          </Reveal>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: T.t3, fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', borderBottom: `1px solid ${T.bdr}` }}>FEATURE</th>
                  {COMPARE_COLS.map((h, i) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'center', color: i === 0 ? T.em : T.t2, fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${T.bdr}`, background: i === 0 ? `${T.em}08` : 'transparent' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.feature}>
                    <td style={{ padding: '11px 16px', color: T.t2, fontSize: 13, borderBottom: `1px solid ${T.bdr}` }}>{row.feature}</td>
                    {row.vals.map((cell, ci) => (
                      <td key={ci} style={{ padding: '11px 16px', textAlign: 'center', color: ci === 0 ? T.em : T.t2, fontWeight: ci === 0 ? 600 : 400, borderBottom: `1px solid ${T.bdr}`, background: ci === 0 ? `${T.em}05` : 'transparent' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Objections */}
      <section style={{ background: T.bgS, padding: '72px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, marginBottom: 10 }}>Common questions answered honestly</h2>
            <p style={{ textAlign: 'center', color: T.t2, fontSize: 15, marginBottom: 40 }}>No marketing spin. Just straight answers.</p>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {OBJECTIONS.map((obj, i) => (
              <Reveal key={i} delay={i * 55}>
                <div style={{ background: T.bgC, border: `1px solid ${openQ === i ? T.bdrB : T.bdr}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .3s' }}>
                  <button
                    onClick={() => setOpenQ(openQ === i ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', color: T.t1, fontSize: 15, fontWeight: 600, textAlign: 'left', gap: 12 }}
                  >
                    {obj.q}
                    <span style={{ color: T.em, fontSize: 20, lineHeight: 1, flexShrink: 0, transform: openQ === i ? 'rotate(45deg)' : 'none', transition: 'transform .25s' }}>+</span>
                  </button>
                  {openQ === i && <div style={{ padding: '0 22px 20px', color: T.t2, fontSize: 14, lineHeight: 1.75 }}>{obj.a}</div>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '72px 24px 100px', textAlign: 'center' }}>
        <Reveal>
          <div style={{ maxWidth: 560, margin: '0 auto', background: `linear-gradient(135deg, ${T.em}15, ${T.blue}10)`, border: `1px solid ${T.em}30`, borderRadius: 24, padding: 'clamp(32px,5vw,56px)' }}>
            <h2 style={{ fontSize: 'clamp(20px,3vw,30px)', fontWeight: 800, marginBottom: 10 }}>Still not convinced?</h2>
            <p style={{ color: T.t2, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>Start free — set up your agent, make a test call, see it work. No credit card. No sales call. No commitment.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" style={{ padding: '13px 28px', borderRadius: 10, background: T.em, color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Try it free →</Link>
              <Link to="/contact" style={{ padding: '13px 28px', borderRadius: 10, border: `1px solid ${T.bdrB}`, color: T.t1, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Talk to us</Link>
            </div>
          </div>
        </Reveal>
      </section>

    </div>
  );
}
