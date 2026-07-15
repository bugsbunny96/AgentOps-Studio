import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import agentopsIcon from '@/assets/logos/agentops-icon-reversed.svg';

const NAV_LINKS = [
  { label: 'Services', to: '/services' },
  { label: 'Industries', to: '/industries' },
  { label: 'Why Us', to: '/why-us' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Blog', to: '/blog' },
];

/**
 * Public-facing layout — sticky glassmorphism nav + 4-column footer.
 * Wraps all unauthenticated public pages (/, /services, /industries, etc.).
 */
export function PublicLayout() {
  const { isAuthenticated, onboardingComplete } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  // Nav scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  function handleDashboard() {
    if (isAuthenticated) {
      navigate(onboardingComplete ? '/dashboard' : '/onboarding');
    } else {
      navigate('/register');
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#030712', color: '#f8fafc' }}>
      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          background: scrolled ? 'rgba(3,7,18,0.92)' : 'rgba(3,7,18,0.6)',
          transition: 'background 0.3s ease',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '0 20px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src={agentopsIcon} alt="AgentOps" style={{ width: 28, height: 28, borderRadius: 8, display: 'block' }} />
            <span style={{ fontWeight: 800, fontSize: 15, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              AgentOps Studio
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav aria-label="Main navigation" style={{ display: 'flex', gap: 2, listStyle: 'none' }}>
            {NAV_LINKS.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: location.pathname === to ? '#f8fafc' : '#94a3b8',
                  textDecoration: 'none',
                  padding: '5px 10px',
                  borderRadius: 6,
                  background: location.pathname === to ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'color 0.2s, background 0.2s',
                }}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* CTA cluster */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isAuthenticated ? (
              <button
                onClick={handleDashboard}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  boxShadow: '0 0 0 1px rgba(139,92,246,.3), 0 4px 16px rgba(59,130,246,.25)',
                }}
              >
                Go to Dashboard →
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    color: '#f8fafc', textDecoration: 'none',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'transparent',
                    transition: 'background 0.2s',
                  }}
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  style={{
                    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    color: '#fff', textDecoration: 'none',
                    boxShadow: '0 0 0 1px rgba(139,92,246,.3), 0 4px 16px rgba(59,130,246,.25)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                >
                  Start Free Trial
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((v) => !v)}
              style={{
                display: 'none',
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 6, color: '#94a3b8',
              }}
              className="public-hamburger"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen
                  ? <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  : <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            ref={mobileRef}
            style={{
              borderTop: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(3,7,18,0.97)',
              padding: '12px 20px 20px',
            }}
          >
            {NAV_LINKS.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'block', padding: '10px 0',
                  fontSize: 15, fontWeight: 500, color: '#94a3b8', textDecoration: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {label}
              </Link>
            ))}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/login" style={{ padding: '10px 16px', borderRadius: 8, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#f8fafc', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)' }}>Log In</Link>
              <Link to="/register" style={{ padding: '10px 16px', borderRadius: 8, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>Start Free Trial</Link>
            </div>
          </div>
        )}
      </header>

      {/* ── PAGE CONTENT ─────────────────────────────────────────────── */}
      <main>
        <Outlet />
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '52px 0 28px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
              gap: 36,
              marginBottom: 36,
            }}
          >
            {/* Brand column */}
            <div>
              <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 10 }}>
                <img src={agentopsIcon} alt="AgentOps" style={{ width: 24, height: 24, borderRadius: 6, display: 'block' }} />
                <span style={{ fontWeight: 800, fontSize: 14, color: '#f8fafc' }}>AgentOps Studio</span>
              </Link>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, maxWidth: 210 }}>
                AI-powered voice agents for Indian SMBs. Handle every call in the language your customers speak.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {['in', '𝕏', '▶'].map((icon) => (
                  <a
                    key={icon}
                    href="#"
                    style={{
                      width: 30, height: 30, borderRadius: 7,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#475569', textDecoration: 'none', fontSize: 12,
                      transition: 'all 0.2s',
                    }}
                  >
                    {icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {[
              { heading: 'Product', links: ['Services', 'Pricing', 'Industries', 'Changelog'] },
              { heading: 'Company', links: ['Why Us', 'Blog', 'Contact', 'Careers'] },
              { heading: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy'] },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>{heading}</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        style={{ fontSize: 12.5, color: '#475569', textDecoration: 'none', transition: 'color 0.2s' }}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer bottom bar */}
          <div
            style={{
              paddingTop: 20,
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <p style={{ fontSize: 11.5, color: '#475569' }}>
              © {new Date().getFullYear()} <span style={{ fontWeight: 600 }}>AgentOps Studio.</span> All rights reserved.
            </p>
            <p style={{ fontSize: 11.5, color: '#475569' }}>
              Made with ♥ by <span style={{ fontWeight: 600 }}>Rishabh</span> · GST invoices available
            </p>
          </div>
        </div>
      </footer>

      {/* Responsive hamburger show */}
      <style>{`
        @media (max-width: 768px) {
          nav[aria-label="Main navigation"] { display: none !important; }
          .public-hamburger { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
