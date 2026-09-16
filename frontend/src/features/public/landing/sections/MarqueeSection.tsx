import { color } from '../tokens';

const LOGOS = [
  'FastShip Logistics', 'BuildRight Realty', 'MedCare Clinics',
  'EduFirst Academy', 'TrustBank NBFC', 'QuickMart Retail',
  'SpiceRoute Food', 'LegalEdge Firm',
];

export function MarqueeSection() {
  const items = [...LOGOS, ...LOGOS]; // duplicated for a seamless loop
  return (
    <section aria-label="Trusted by" style={{ padding: '24px 0', borderTop: `1px solid ${color.border}`, borderBottom: `1px solid ${color.border}`, overflow: 'hidden' }}>
      <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: color.text3, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Trusted by fast-growing businesses across India
      </p>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, background: `linear-gradient(90deg, ${color.bg}, transparent)`, zIndex: 1 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, background: `linear-gradient(-90deg, ${color.bg}, transparent)`, zIndex: 1 }} />
        <div style={{
          display: 'flex', gap: 40, alignItems: 'center', width: 'max-content',
          animationName: 'marquee', animationDuration: '28s', animationTimingFunction: 'linear', animationIterationCount: 'infinite',
        }}>
          {items.map((name, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: color.text3, whiteSpace: 'nowrap' }}>
              ✦ {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
