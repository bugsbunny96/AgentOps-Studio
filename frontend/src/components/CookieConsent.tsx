/**
 * CookieConsent — DPDPA 2023 / India-compliant cookie notice.
 * Shows once; stores choice in localStorage.
 * Uses only essential cookies → no analytics/marketing cookies to block.
 * "Accept" sets a flag; "Decline" sets the same flag (no tracking anyway).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'agentops_cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage blocked (private browsing) — don't show banner
    }
  }, []);

  function dismiss(choice: 'accepted' | 'declined') {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 40px)',
        maxWidth: 560,
        background: '#0e1120',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        flexWrap: 'wrap',
      }}
    >
      {/* Cookie icon */}
      <span style={{ fontSize: 26, flexShrink: 0 }}>🍪</span>

      {/* Text */}
      <p style={{
        flex: 1,
        margin: 0,
        fontSize: 13,
        color: '#94a3b8',
        lineHeight: 1.55,
        minWidth: 200,
      }}>
        We use only <strong style={{ color: '#f8fafc' }}>essential cookies</strong> to keep you signed in and the platform running.
        No tracking or advertising cookies.{' '}
        <Link to="/privacy#cookies" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
          Learn more
        </Link>
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => dismiss('declined')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent',
            color: '#94a3b8',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Decline
        </button>
        <button
          onClick={() => dismiss('accepted')}
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(59,130,246,0.3)',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
