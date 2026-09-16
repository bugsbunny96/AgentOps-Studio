/**
 * SentryErrorBoundary
 *
 * Wraps the entire React app. When an unhandled render/lifecycle error escapes
 * React's tree, Sentry captures it automatically and the user sees a polished
 * fallback screen instead of a blank white page.
 *
 * Usage (see main.tsx):
 *   <SentryErrorBoundary>
 *     <App />
 *   </SentryErrorBoundary>
 */
import { ErrorBoundary } from '@sentry/react';
import type { ReactNode } from 'react';

// ── Design tokens — must match PublicLayout / DashboardLayout dark palette ──
const T = {
  bg:   '#030712',
  bgS:  '#0e1117',
  bdr:  'rgba(255,255,255,0.07)',
  t1:   '#f8fafc',
  t2:   '#94a3b8',
  t3:   '#475569',
  blue: '#3b82f6',
  red:  '#ef4444',
};

interface FallbackProps {
  error: Error;
  componentStack?: string;
  resetError: () => void;
}

function ErrorFallback({ error, resetError }: FallbackProps) {
  const isDev = import.meta.env.DEV;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: T.bg,
        padding: '24px 20px',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: T.bgS,
          border: `1px solid ${T.bdr}`,
          borderRadius: 16,
          padding: '40px 36px',
          textAlign: 'center',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 24,
          }}
        >
          ⚠️
        </div>

        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: T.t1,
            margin: '0 0 10px',
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: 14,
            color: T.t2,
            lineHeight: 1.6,
            margin: '0 0 24px',
          }}
        >
          An unexpected error occurred. Our team has been notified automatically.
          You can try refreshing or return to the dashboard.
        </p>

        {/* Show error message in dev only */}
        {isDev && error?.message && (
          <pre
            style={{
              textAlign: 'left',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 12,
              color: '#fca5a5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: 24,
              maxHeight: 160,
              overflow: 'auto',
            }}
          >
            {error.message}
          </pre>
        )}

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={resetError}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              background: `linear-gradient(135deg, ${T.blue}, #8b5cf6)`,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Try again
          </button>

          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              background: 'transparent',
              color: T.t2,
              border: `1px solid ${T.bdr}`,
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = T.t1;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.bdr;
              e.currentTarget.style.color = T.t2;
            }}
          >
            Go to homepage
          </button>
        </div>

        <p style={{ fontSize: 11, color: T.t3, marginTop: 24, marginBottom: 0 }}>
          If this keeps happening, contact{' '}
          <a
            href="mailto:support@agentopsstudio.com"
            style={{ color: T.blue, textDecoration: 'none' }}
          >
            support@agentopsstudio.com
          </a>
        </p>
      </div>
    </div>
  );
}

interface SentryErrorBoundaryProps {
  children: ReactNode;
}

export function SentryErrorBoundary({ children }: SentryErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback
          error={error as Error}
          resetError={resetError}
        />
      )}
      onError={(error, componentStack) => {
        // Extra breadcrumb — already captured by Sentry ErrorBoundary internally,
        // but we log to console in dev for quick triage
        if (import.meta.env.DEV) {
          console.error('[SentryErrorBoundary] caught:', error);
          console.error('[SentryErrorBoundary] component stack:', componentStack);
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
