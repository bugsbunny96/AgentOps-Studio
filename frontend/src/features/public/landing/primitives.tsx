/**
 * Reusable landing page primitives — the shared vocabulary every section
 * builds sections out of, instead of one-off inline style objects.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { color, radius, font, brandGradient } from './tokens';

// ─── Gradient text ─────────────────────────────────────────────────────────
export function GradientText({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        background: brandGradient,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ─── Pill / badge ──────────────────────────────────────────────────────────
export function Pill({
  children,
  bg,
  fg,
  border,
  live = false,
  style,
}: {
  children: ReactNode;
  bg: string;
  fg: string;
  border: string;
  live?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 700, padding: '4px 10px',
        borderRadius: radius.pill, background: bg, color: fg, border: `1px solid ${border}`,
        ...style,
      }}
    >
      {live && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block',
          animationName: 'pulseDot', animationDuration: '2s', animationIterationCount: 'infinite',
        }} />
      )}
      {children}
    </span>
  );
}

// ─── Section eyebrow + heading ─────────────────────────────────────────────
export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
      color: color.blueLight, marginBottom: 10, fontFamily: font.display,
    }}>
      {children}
    </div>
  );
}

export function SectionHeading({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <h2 style={{
      fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.025em',
      fontFamily: font.display, textWrap: 'balance',
      ...style,
    }}>
      {children}
    </h2>
  );
}

// ─── Icon chip — gradient-tinted icon square used at the top of cards ──────
export function IconChip({ icon: Icon, bg, fg, size = 38, style }: { icon: LucideIcon; bg: string; fg: string; size?: number; style?: CSSProperties }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius.md, background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      ...style,
    }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </div>
  );
}

// ─── Card surface ──────────────────────────────────────────────────────────
export function cardStyle(extra: CSSProperties = {}): CSSProperties {
  return {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl,
    padding: 24, overflow: 'hidden', position: 'relative',
    transition: 'border-color 0.3s, transform 0.3s cubic-bezier(0.4,0,0.2,1)',
    ...extra,
  };
}

/** Card with a cursor-tracked spotlight border (see .spotlight-card in landing.css). */
export function SpotlightCard({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--sy', `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  return (
    <div ref={ref} onMouseMove={onMouseMove} className={`spotlight-card ${className}`} style={{ ...cardStyle(), ...style }}>
      {children}
    </div>
  );
}

// ─── Buttons ───────────────────────────────────────────────────────────────
const buttonBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 14, fontWeight: 600, textDecoration: 'none',
  transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s',
};

export function PrimaryButton({ to, children, size = 'md', className = '' }: { to: string; children: ReactNode; size?: 'md' | 'lg'; className?: string }) {
  return (
    <Link
      to={to}
      className={className}
      style={{
        ...buttonBase,
        padding: size === 'lg' ? '14px 28px' : '12px 22px',
        borderRadius: radius.md,
        background: `linear-gradient(135deg, ${color.blue}, ${color.violet})`,
        color: '#fff',
        boxShadow: '0 0 0 1px rgba(139,92,246,.3), 0 4px 20px rgba(59,130,246,.25)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {children}
    </Link>
  );
}

export function SecondaryButton({ to, href, children, size = 'md' }: { to?: string; href?: string; children: ReactNode; size?: 'md' | 'lg' }) {
  const style: CSSProperties = {
    ...buttonBase,
    padding: size === 'lg' ? '14px 22px' : '12px 18px',
    borderRadius: radius.md,
    color: color.text1,
    border: `1px solid ${color.borderStrong}`,
    background: 'transparent',
  };
  const hover = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; };
  const leave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'transparent'; };
  return to
    ? <Link to={to} style={style} onMouseEnter={hover} onMouseLeave={leave}>{children}</Link>
    : <a href={href} style={style} onMouseEnter={hover} onMouseLeave={leave}>{children}</a>;
}

// ─── Wave bars (voice waveform motif) ──────────────────────────────────────
export function WaveBars({ count = 28, height = 44, gradient = `linear-gradient(180deg, ${color.blueLight}, ${color.violet})` }: { count?: number; height?: number; gradient?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3, borderRadius: 2, background: gradient, height: 4,
            animationName: 'waveBar',
            animationDuration: `${0.7 + Math.random() * 0.7}s`,
            animationDelay: `${i * 0.04}s`,
            animationTimingFunction: 'ease-in-out',
            animationDirection: 'alternate',
            animationIterationCount: 'infinite',
          }}
        />
      ))}
    </div>
  );
}

export function LargeWaveBars({ count = 36 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 68, margin: '16px 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1, borderRadius: 3, minHeight: 4,
            background: `linear-gradient(180deg, ${color.blueLight}, ${color.violet})`,
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

// ─── Scroll reveal ──────────────────────────────────────────────────────────
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

export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
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

// ─── Scroll progress bar ───────────────────────────────────────────────────
export function ScrollProgressBar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onScroll() {
      const el = ref.current;
      if (!el) return;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? doc.scrollTop / max : 0;
      el.style.transform = `scaleX(${pct})`;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div ref={ref} className="landing-scroll-progress" style={{ width: '100%', transform: 'scaleX(0)' }} />;
}
