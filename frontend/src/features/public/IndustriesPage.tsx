/**
 * IndustriesPage — 3 highest-value Indian SMB verticals
 * Route: /industries (public)
 *
 * Sections:
 *   1. Hero
 *   2. Vertical tabs: Logistics | Real Estate | Healthcare
 *   3. Cross-industry benefits
 *   4. CTA
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const T = {
  bg: '#030712', bgS: '#0d1524',
  bgC: 'rgba(255,255,255,0.03)', bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  blue: '#3b82f6', violet: '#8b5cf6', em: '#10b981', amber: '#f59e0b', orange: '#f97316',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
  padding: '4px 10px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
});

const KF = `@keyframes ip-float{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(18px,-12px) scale(1.03)}70%{transform:translate(-10px,16px) scale(.97)}}`;

function useKF() {
  useEffect(() => {
    const id = 'ip-kf';
    if (!document.getElementById(id)) { const el = document.createElement('style'); el.id = id; el.textContent = KF; document.head.appendChild(el); }
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.07 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(20px)', transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms` }}>{children}</div>;
}

const INDUSTRIES = [
  {
    id: 'logistics',
    emoji: '🚛',
    label: 'Logistics & Delivery',
    color: T.amber,
    tagline: 'Every missed call is a lost delivery.',
    pain: 'Your drivers are on the road. Your office staff are overwhelmed. When a customer calls to track their shipment or reschedule a delivery window, they get a busy tone — and place the order with your competitor next time.',
    how: 'AgentOps Studio answers every call instantly. Your AI agent handles tracking queries by pulling from your knowledge base, reschedules deliveries on request, and routes complaints to your ops team with a timestamped transcript.',
    useCases: [
      { label: 'Shipment status queries', detail: 'Customer calls asking "where is my order?" — AI answers from your KB with estimated delivery window.' },
      { label: 'Delivery rescheduling', detail: 'Caller requests a new time slot — agent logs the request and sends to your ops WhatsApp.' },
      { label: 'Driver availability check', detail: 'Agent confirms pickup availability based on your business hours configuration.' },
      { label: 'Complaint routing', detail: 'Damaged goods, missing parcels — AI captures details and routes to your escalation contact immediately.' },
    ],
    roi: { stat: '62%', label: 'of logistics calls are repetitive tracking queries — handle them with zero staff cost.' },
  },
  {
    id: 'realestate',
    emoji: '🏢',
    label: 'Real Estate',
    color: T.blue,
    tagline: 'Site visits booked while you sleep.',
    pain: 'Property enquiries don\'t follow office hours. A buyer calls at 9 PM from a Meta ad, gets voicemail, and books a competitor visit the next morning. You lost a ₹50 lakh sale to a missed call.',
    how: 'Your AI agent qualifies every property enquiry — budget, configuration, timeline, location preference — and books site visits directly. Morning handoff to your sales team includes full lead transcripts, so they walk in warm.',
    useCases: [
      { label: '24/7 property enquiries', detail: 'Handles "3 BHK available in Whitefield?" at any hour, confirms pricing, shares amenities.' },
      { label: 'Site visit scheduling', detail: 'Collects buyer availability and adds to your calendar — zero back-and-forth.' },
      { label: 'Lead qualification', detail: 'Captures budget, timeline, and preferred configuration before handing off to agent.' },
      { label: 'Follow-up campaigns', detail: 'Outbound calls to warm leads who filled your enquiry form — done automatically, in Hindi or English.' },
    ],
    roi: { stat: '4×', label: 'more qualified leads captured when you answer 24/7 vs. business hours only.' },
  },
  {
    id: 'healthcare',
    emoji: '🏥',
    label: 'Healthcare & Clinics',
    color: T.em,
    tagline: 'Your clinic front desk, without the overtime.',
    pain: 'Appointment booking ties up your receptionist for hours every day. Patients call after hours, can\'t get through, and go to the clinic down the road. Meanwhile your staff manually confirm appointments over calls the morning of.',
    how: 'AgentOps Studio handles appointment enquiries, clinic hours, insurance queries, and emergency routing — 24/7, in Hindi and English. Your front desk focuses on patients who are physically present.',
    useCases: [
      { label: 'Appointment booking enquiries', detail: 'Caller asks "Is Dr. Sharma available Thursday?" — AI checks your configured schedule and confirms.' },
      { label: 'Clinic hours and location', detail: 'Handles 80% of inbound queries: timings, parking, directions — zero receptionist time.' },
      { label: 'Emergency routing', detail: 'If caller describes an emergency, AI immediately routes to your on-call number.' },
      { label: 'Appointment reminders (outbound)', detail: 'Auto-calls patients 24 hours before appointment to reduce no-shows by up to 35%.' },
    ],
    roi: { stat: '3 hrs', label: 'per day saved on receptionist call handling for a 2-doctor clinic.' },
  },
];

const SHARED_BENEFITS = [
  { icon: '🌐', label: 'Hindi + English', desc: 'Auto-detect the caller\'s language and respond naturally. No separate flows needed.' },
  { icon: '📋', label: 'Full transcripts', desc: 'Every call is transcribed and AI-summarised. Your team reviews outcomes, not audio files.' },
  { icon: '⏱️', label: '<2s response time', desc: 'No hold music. Your AI answers in under 2 seconds, every time — peak hours included.' },
  { icon: '📈', label: 'Weekly analytics', desc: 'Call volume, peak hours, top query types — all visible in your dashboard.' },
];

export default function IndustriesPage() {
  useKF();
  const [activeTab, setActiveTab] = useState(0);
  const industry = INDUSTRIES[activeTab];

  return (
    <div style={{ background: T.bg, color: T.t1, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(80px,10vw,120px) 24px 72px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '10%', left: '20%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%)', animation: 'ip-float 13s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '15%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)', animation: 'ip-float 9s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <span style={pill('rgba(245,158,11,0.1)', T.amber, 'rgba(245,158,11,0.25)')}>● Industry Solutions</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-0.03em' }}>
            Built for India's{' '}
            <span style={{ background: `linear-gradient(135deg, ${T.amber}, ${T.orange})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>fastest-growing</span>
            {' '}sectors
          </h1>
          <p style={{ color: T.t2, fontSize: 'clamp(15px,2vw,18px)', lineHeight: 1.7, margin: '0 0 36px' }}>
            AgentOps Studio isn't a generic tool. It's pre-configured for the workflows, call patterns, and language preferences of Indian logistics, real estate, and healthcare businesses.
          </p>
          <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 32px', borderRadius: 10, background: T.amber, color: '#000', fontWeight: 700, fontSize: 15, textDecoration: 'none', gap: 8 }}>Start free for your industry →</Link>
        </div>
      </section>

      {/* Industry tabs */}
      <section style={{ padding: '16px 24px 80px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
            {INDUSTRIES.map((ind, i) => (
              <button
                key={ind.id}
                onClick={() => setActiveTab(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, border: `1px solid ${activeTab === i ? ind.color + '60' : T.bdr}`, background: activeTab === i ? `${ind.color}15` : T.bgC, color: activeTab === i ? ind.color : T.t2, fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all .25s' }}
              >
                <span>{ind.emoji}</span> {ind.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div key={industry.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            {/* Left */}
            <div>
              <div style={{ background: T.bgC, border: `1px solid ${industry.color}30`, borderRadius: 20, padding: '32px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <span style={{ fontSize: 36 }}>{industry.emoji}</span>
                  <div>
                    <p style={{ color: industry.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>THE PROBLEM</p>
                    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: T.t1 }}>{industry.tagline}</h2>
                  </div>
                </div>
                <p style={{ color: T.t2, fontSize: 14, lineHeight: 1.8, margin: '0 0 24px' }}>{industry.pain}</p>

                <p style={{ color: industry.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>HOW WE FIX IT</p>
                <p style={{ color: T.t2, fontSize: 14, lineHeight: 1.8, margin: '0 0 24px' }}>{industry.how}</p>

                {/* ROI callout */}
                <div style={{ background: `${industry.color}12`, border: `1px solid ${industry.color}30`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 'clamp(24px,4vw,32px)', fontWeight: 900, color: industry.color, flexShrink: 0 }}>{industry.roi.stat}</span>
                  <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{industry.roi.label}</p>
                </div>
              </div>
            </div>

            {/* Right: use cases */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ color: T.t3, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>USE CASES</p>
              {industry.useCases.map((uc, i) => (
                <div
                  key={uc.label}
                  style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '18px 20px', transition: 'border-color .3s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = `${industry.color}50`}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = T.bdr}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${industry.color}20`, border: `1px solid ${industry.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: industry.color, flexShrink: 0 }}>{i + 1}</span>
                    <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: T.t1 }}>{uc.label}</h4>
                  </div>
                  <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: 0, paddingLeft: 32 }}>{uc.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Shared benefits */}
      <section style={{ background: T.bgS, padding: '72px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, marginBottom: 10 }}>Works the same way across every industry</h2>
            <p style={{ textAlign: 'center', color: T.t2, fontSize: 15, marginBottom: 48, maxWidth: 500, margin: '0 auto 48px' }}>The foundation is consistent — you customise the knowledge base for your business.</p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
            {SHARED_BENEFITS.map((b, i) => (
              <Reveal key={b.label} delay={i * 55}>
                <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: '22px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{b.icon}</div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: T.t1 }}>{b.label}</h4>
                  <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '72px 24px 100px', textAlign: 'center' }}>
        <Reveal>
          <div style={{ maxWidth: 580, margin: '0 auto', background: `linear-gradient(135deg, ${T.amber}15, ${T.orange}10)`, border: `1px solid ${T.amber}30`, borderRadius: 24, padding: 'clamp(32px,5vw,56px)' }}>
            <h2 style={{ fontSize: 'clamp(20px,3vw,30px)', fontWeight: 800, marginBottom: 10 }}>Your industry, your agent</h2>
            <p style={{ color: T.t2, fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
              Start free. Set up your knowledge base in 20 minutes. Make your first test call. No credit card needed.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" style={{ padding: '13px 28px', borderRadius: 10, background: T.amber, color: '#000', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Get started free →</Link>
              <Link to="/contact" style={{ padding: '13px 28px', borderRadius: 10, border: `1px solid ${T.bdrB}`, color: T.t1, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Talk to our team</Link>
            </div>
          </div>
        </Reveal>
      </section>

    </div>
  );
}
