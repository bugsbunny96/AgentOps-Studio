/**
 * Sentry initialisation for AgentOps Studio frontend.
 *
 * Rules:
 *  - Only activates in production (VITE_SENTRY_DSN must be set)
 *  - Performance: 10 % trace sample rate (free-tier safe)
 *  - Session Replay: 5 % normal sessions, 100 % error sessions
 *  - PII: masking OFF for now (flip maskAllText → true before handling medical/financial data)
 */
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  // Only run in production with a real DSN configured
  if (!dsn || import.meta.env.DEV) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,   // 'production' | 'staging'

    // ── Integrations ──────────────────────────────────────────────────
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,     // flip to true if you ever store sensitive PII
        blockAllMedia: false,
      }),
    ],

    // ── Sampling ─────────────────────────────────────────────────────
    // Keep these low — free tier is 5 k errors / month, 10 k replays / month
    tracesSampleRate:           0.10,   // 10 % of page-loads recorded for perf
    replaysSessionSampleRate:   0.05,   // 5 %  of normal sessions get replay
    replaysOnErrorSampleRate:   1.00,   // 100 % of error sessions get replay

    // ── Ignore noise ─────────────────────────────────────────────────
    // These are browser-extension / network errors we cannot fix
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured with value: Object Not Found Matching',
      /^Network Error$/,
      /^Request aborted$/,
      /^timeout of \d+ms exceeded$/,
      /ChunkLoadError/,
    ],
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
    ],

    // ── Release ──────────────────────────────────────────────────────
    // Injected by CI (Sentry vite plugin sets this from the git commit SHA)
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
  });
}

/**
 * Convenience wrapper that captures an exception with optional extra context.
 * Use this inside catch blocks where you want Sentry to see the error but you
 * also want to handle it gracefully in the UI (i.e. not crash).
 *
 * @example
 *   try { await callVapi(); }
 *   catch (err) { captureSentryException(err, { feature: 'vapi-call', orgId }); }
 */
export function captureSentryException(
  error: unknown,
  tags?: Record<string, string | number | boolean>,
) {
  Sentry.withScope((scope) => {
    if (tags) scope.setTags(tags);
    Sentry.captureException(error);
  });
}

/**
 * Set user context so Sentry groups errors by user / org.
 * Call this after a successful login or session restore.
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  orgId?: string;
  plan?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    // custom tags
  });
  if (user.orgId) Sentry.setTag('orgId', user.orgId);
  if (user.plan)  Sentry.setTag('plan', user.plan);
}

/** Clear user context on logout */
export function clearSentryUser() {
  Sentry.setUser(null);
}
