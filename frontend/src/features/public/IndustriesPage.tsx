/**
 * IndustriesPage — public marketing page
 * Route: /Industries (lowercase-hyphenated)
 * TODO: Full implementation in L3.F2
 */
export default function IndustriesPage() {
  return (
    <section style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
          Industries
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 16 }}>Coming soon — full page in next release.</p>
      </div>
    </section>
  );
}
