/**
 * RouteErrorPage — used as `errorElement` on every React Router route.
 *
 * React Router v6 catches render/thrown errors inside route components and
 * shows this page instead of the generic "💿 Hey developer" fallback.
 *
 * This page:
 *   1. Reads the caught error via `useRouteError()`
 *   2. Reports it to Sentry with full context (so we get the component stack)
 *   3. Shows the user a clean "Something went wrong" UI
 *   4. In DEV, logs the full error payload so we can identify unknown shapes
 */
import { useRouteError, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import * as Sentry from '@sentry/react';

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

export function RouteErrorPage() {
  const error    = useRouteError();
  const navigate = useNavigate();
  const isDev    = import.meta.env.DEV;

  useEffect(() => {
    // Always log — this is our main debugging signal for the {type, msg, details} crash
    console.error('[RouteErrorPage] caught route error:', error);
    if (error && typeof error === 'object') {
      console.error('[RouteErrorPage] error keys:', Object.keys(error));
      console.error('[RouteErrorPage] error JSON:', JSON.stringify(error, null, 2));
    }

    // Report to Sentry
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      // Non-Error thrown — wrap it so Sentry captures it with full payload
      Sentry.captureException(
        new Error(`Route render error: ${JSON.stringify(error)}`),
        { extra: { routeError: error } }
      );
    }
  }, [error]);

  // Friendly message for user
  const userMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : 'An unexpected error occurred.';

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
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 24,
          }}
        >
          ⚠️
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.t1, margin: '0 0 10px' }}>
          Something went wrong
        </h1>

        <p style={{ fontSize: 14, color: T.t2, lineHeight: 1.6, margin: '0 0 24px' }}>
          An unexpected error occurred on this page. Our team has been notified.
        </p>

        {/* Show error details in dev only */}
        {isDev && (
          <pre
            style={{
              textAlign: 'left',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 11,
              color: '#fca5a5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: 24,
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {userMessage}
            {'\n\n'}
            {JSON.stringify(error, null, 2)}
          </pre>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '9px 20px', borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              background: `linear-gradient(135deg, ${T.blue}, #8b5cf6)`,
              color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Go back
          </button>

          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            style={{
              padding: '9px 20px', borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              background: 'transparent', color: T.t2,
              border: `1px solid ${T.bdr}`, cursor: 'pointer',
            }}
          >
            Dashboard
          </button>
        </div>

        <p style={{ fontSize: 11, color: T.t3, marginTop: 24, marginBottom: 0 }}>
          If this keeps happening, contact{' '}
          <a href="mailto:support@agentopsstudio.com" style={{ color: T.blue, textDecoration: 'none' }}>
            support@agentopsstudio.com
          </a>
        </p>
      </div>
    </div>
  );
}
