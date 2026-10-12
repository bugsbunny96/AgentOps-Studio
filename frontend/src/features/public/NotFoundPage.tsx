/**
 * NotFoundPage — Styled 404 page matching the AgentOps dark theme.
 * Route: * (catch-all) in PublicLayout, and app routes.
 */
import { Link } from 'react-router-dom';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/hooks/useAuth';
import agentopsIcon from '@/assets/logos/agentops-icon-reversed.svg';

export default function NotFoundPage() {
  usePageMeta({ title: "Page Not Found", noindex: true });
  const { isAuthenticated } = useAuth();
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#171717',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      {/* Logo — back to the home page */}
      <Link
        to="/"
        aria-label="AgentOps Studio home"
        style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', zIndex: 1 }}
      >
        <img src={agentopsIcon} alt="" style={{ width: 28, height: 28, borderRadius: 8, display: 'block' }} />
        <span style={{ fontWeight: 800, fontSize: 15, color: '#fafafa' }}>AgentOps Studio</span>
      </Link>

      {/* Glowing number */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <span
          style={{
            fontSize: 'clamp(96px, 18vw, 180px)',
            fontWeight: 900,
            lineHeight: 1,
            background: 'linear-gradient(135deg, #21F1A8 0%, #0FC98A 50%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 40px rgba(15,201,138,0.35))',
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
          color: '#fafafa',
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
          color: '#8a8a8a',
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
            background: 'linear-gradient(135deg, #21F1A8, #0FC98A)',
            color: '#171717',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 15,
            boxShadow: '0 4px 20px rgba(33,241,168,0.3)',
          }}
        >
          ← Back to Home
        </Link>
        {isAuthenticated ? (
        <Link
          to="/dashboard"
          style={{
            padding: '11px 24px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#a3a3a3',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 15,
            background: 'transparent',
          }}
        >
          Go to Dashboard
        </Link>
        ) : (
        <Link
          to="/contact"
          style={{
            padding: '11px 24px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#a3a3a3',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 15,
            background: 'transparent',
          }}
        >
          Contact us
        </Link>
        )}
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
