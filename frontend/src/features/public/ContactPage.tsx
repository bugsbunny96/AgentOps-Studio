/**
 * ContactPage — contact form via Formspree (no backend)
 * Route: /contact (public)
 *
 * Sections:
 *   1. Hero
 *   2. Contact form (Formspree)
 *   3. Alternate contact options
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const T = {
  bg: '#030712', bgS: '#0d1524',
  bgC: 'rgba(255,255,255,0.03)', bgCH: 'rgba(255,255,255,0.05)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.15)',
  blue: '#3b82f6', violet: '#8b5cf6', em: '#10b981', amber: '#f59e0b',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
  padding: '4px 10px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
});

const KF = `@keyframes cp-float{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(-15px,-10px) scale(1.02)}70%{transform:translate(12px,14px) scale(.98)}}`;

function useKF() {
  useEffect(() => {
    const id = 'cp-kf';
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
  return <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(18px)', transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms` }}>{children}</div>;
}

// Replace with your actual Formspree form ID
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const inputStyle = (focused: boolean): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box',
  background: focused ? T.bgCH : T.bgC,
  border: `1px solid ${focused ? T.bdrB : T.bdr}`,
  borderRadius: 10, padding: '11px 14px',
  color: T.t1, fontSize: 14, outline: 'none',
  transition: 'all .2s', fontFamily: 'inherit',
});

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: T.t2, marginBottom: 6, letterSpacing: '0.03em',
};

function Field({
  label, name, type = 'text', required = false,
  placeholder, as,
}: {
  label: string; name: string; type?: string; required?: boolean;
  placeholder?: string; as?: 'textarea';
}) {
  const [focused, setFocused] = useState(false);
  const handlers = {
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label htmlFor={name} style={labelStyle}>
        {label}{required && <span style={{ color: T.amber, marginLeft: 2 }}>*</span>}
      </label>
      {as === 'textarea' ? (
        <textarea
          id={name} name={name} required={required} rows={5}
          placeholder={placeholder} style={{ ...inputStyle(focused), resize: 'vertical', minHeight: 120 }}
          {...handlers}
        />
      ) : (
        <input
          id={name} name={name} type={type} required={required}
          placeholder={placeholder} style={inputStyle(focused)}
          {...handlers}
        />
      )}
    </div>
  );
}

const CONTACT_OPTIONS = [
  { icon: '✉️', label: 'Email us', value: 'b.rishu.pandit@gmail.com', href: 'mailto:b.rishu.pandit@gmail.com', cta: 'Send an email' },
  { icon: '💬', label: 'WhatsApp', value: 'Chat directly on WhatsApp', href: 'https://wa.me/919999999999', cta: 'Open WhatsApp' },
  { icon: '🗓️', label: 'Book a demo', value: '30-min live walkthrough', href: '/register', cta: 'Schedule now' },
];

export default function ContactPage() {
  useKF();
  const [formState, setFormState] = useState<FormState>('idle');
  const formRef = useRef<HTMLFormElement>(null);
  // Honeypot — bots fill this; humans don't see it
  const [honeypot, setHoneypot] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Silently reject bot submissions
    if (honeypot) { setFormState('success'); return; }
    setFormState('submitting');

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        setFormState('success');
        formRef.current?.reset();
      } else {
        setFormState('error');
      }
    } catch {
      setFormState('error');
    }
  }

  return (
    <div style={{ background: T.bg, color: T.t1, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(80px,10vw,120px) 24px 60px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '8%', left: '25%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', animation: 'cp-float 11s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '20%', right: '15%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', animation: 'cp-float 8s ease-in-out infinite reverse' }} />
        </div>
        <div style={{ position: 'relative', maxWidth: 620, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <span style={pill('rgba(139,92,246,0.1)', T.violet, 'rgba(139,92,246,0.25)')}>● Get in touch</span>
          </div>
          <h1 style={{ fontSize: 'clamp(30px,5vw,54px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 18px', letterSpacing: '-0.03em' }}>
            Talk to a real{' '}
            <span style={{ background: `linear-gradient(135deg, ${T.violet}, ${T.blue})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>human</span>
          </h1>
          <p style={{ color: T.t2, fontSize: 'clamp(14px,2vw,17px)', lineHeight: 1.7, margin: 0 }}>
            We respond to every message within 1 business day. Tell us what you're trying to build and we'll help you get there.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 32, alignItems: 'start' }}>

          {/* Form */}
          <Reveal>
            <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 20, padding: 'clamp(24px,4vw,36px)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 24px', color: T.t1 }}>Send us a message</h2>

              {formState === 'success' ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>Message received!</h3>
                  <p style={{ color: T.t2, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                    We'll get back to you within 1 business day. In the meantime, you can <Link to="/register" style={{ color: T.violet, textDecoration: 'underline' }}>start your free account</Link> and explore the platform.
                  </p>
                  <button onClick={() => setFormState('idle')} style={{ padding: '10px 22px', borderRadius: 9, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Send another message</button>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {/* Honeypot — hidden from real users, catches bots */}
                  <input
                    type="text"
                    name="_gotcha"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={e => setHoneypot(e.target.value)}
                    style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    aria-hidden="true"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Name" name="name" required placeholder="Rishabh Sharma" />
                    <Field label="Email" name="email" type="email" required placeholder="you@company.com" />
                  </div>
                  <Field label="Company" name="company" placeholder="Acme Logistics Pvt Ltd" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label htmlFor="interest" style={labelStyle}>I'm interested in</label>
                    <select
                      id="interest" name="interest"
                      style={{ ...inputStyle(false), appearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="">Select one…</option>
                      <option value="inbound">Inbound AI receptionist</option>
                      <option value="outbound">Outbound calling campaigns</option>
                      <option value="demo">Live demo / walkthrough</option>
                      <option value="pricing">Pricing & plans</option>
                      <option value="enterprise">Enterprise / custom</option>
                      <option value="other">Something else</option>
                    </select>
                  </div>
                  <Field label="Message" name="message" required as="textarea" placeholder="Tell us what you're trying to build, how many calls you handle per day, and any specific requirements…" />

                  {formState === 'error' && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 9, padding: '10px 14px', color: '#fca5a5', fontSize: 13 }}>
                      Something went wrong. Please try again or email us directly.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formState === 'submitting'}
                    style={{
                      padding: '13px 24px', borderRadius: 10,
                      background: formState === 'submitting' ? T.t3 : T.violet,
                      color: '#fff', fontWeight: 700, fontSize: 15, border: 'none',
                      cursor: formState === 'submitting' ? 'not-allowed' : 'pointer',
                      transition: 'background .2s', fontFamily: 'inherit',
                    }}
                  >
                    {formState === 'submitting' ? 'Sending…' : 'Send message →'}
                  </button>
                  <p style={{ color: T.t3, fontSize: 11, margin: 0 }}>We typically respond within 1 business day.</p>
                </form>
              )}
            </div>
          </Reveal>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Reveal>
              <p style={{ color: T.t3, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>OTHER WAYS TO REACH US</p>
            </Reveal>
            {CONTACT_OPTIONS.map((opt, i) => (
              <Reveal key={opt.label} delay={i * 60}>
                <a
                  href={opt.href}
                  target={opt.href.startsWith('http') ? '_blank' : undefined}
                  rel={opt.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: '18px 20px', textDecoration: 'none', transition: 'border-color .25s, background .25s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = T.bdrB; (e.currentTarget as HTMLAnchorElement).style.background = T.bgCH; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = T.bdr; (e.currentTarget as HTMLAnchorElement).style.background = T.bgC; }}
                >
                  <span style={{ fontSize: 24 }}>{opt.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: '0 0 2px' }}>{opt.label}</p>
                    <p style={{ fontSize: 12, color: T.t2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.value}</p>
                  </div>
                  <span style={{ color: T.t3, fontSize: 18 }}>→</span>
                </a>
              </Reveal>
            ))}

            <Reveal delay={200}>
              <div style={{ background: `${T.em}0F`, border: `1px solid ${T.em}25`, borderRadius: 14, padding: '18px 20px', marginTop: 4 }}>
                <p style={{ color: T.em, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>Already a customer?</p>
                <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>If you have a question about your account, use the support chat inside your dashboard for the fastest response.</p>
                <Link to="/login" style={{ color: T.em, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Go to dashboard →</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

    </div>
  );
}
