/**
 * NotFoundPage — Styled 404 page matching the AgentOps dark theme.
 * Route: * (catch-all) in PublicLayout, and app routes.
 */
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030712',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      {/* Glowing number */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <span
          style={{
            fontSize: 'clamp(96px, 18vw, 180px)',
            fontWeight: 900,
            lineHeight: 1,
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 40px rgba(139,92,246,0.35))',
            letterSpacing: '-0.04em',
          }}
        >
          404
        </span>
      </div>

      {/* Heading */}
      <h1
        style={{
          fontSize: 'clamp(22px, 4vw, 32px)',
          fontWeight: 700,
          color: '#f8fafc',
          margin: '0 0 12px',
          letterSpacing: '-0.02em',
        }}
      >
        Page not found
      </h1>

      {/* Sub-text */}
      <p
        style={{
          fontSize: 16,
          color: '#64748b',
          maxWidth: 380,
          lineHeight: 1.6,
          margin: '0 0 36px',
        }}
      >
        The page you're looking for doesn't exist or has been moved.
        Let's get you back on track.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/"
          style={{
            padding: '11px 24px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 15,
            boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
          }}
        >
          ← Back to Home
        </Link>
        <Link
          to="/dashboard"
          style={{
            padding: '11px 24px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 15,
            background: 'transparent',
          }}
        >
          Go to Dashboard
        </Link>
      </div>

      {/* Decorative grid dots */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    </div>
  );
}
