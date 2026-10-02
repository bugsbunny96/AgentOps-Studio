/**
 * Global rate-limit exemptions (CORE-03)
 *
 * Vapi calls these routes from a small pool of shared egress IPs on every live
 * call. A per-IP limit (100 / 15 min) would return HTTP 429 to `assistant-request`
 * on a busy line and drop calls. Each route is authenticated by a shared secret
 * instead (x-vapi-secret / x-webhook-secret), so it is safe to exempt them.
 */

/** Path prefixes (no query string) that skip the global `/api/v1` limiter. */
export const RATE_LIMIT_EXEMPT_PREFIXES = [
  '/api/v1/webhooks/vapi',   // assistant-request, status, end-of-call-report
  '/api/v1/orders/submit',   // submit_order tool
  '/api/v1/tools',           // search_catalog / search_knowledge_base tools
] as const;

export function isRateLimitExempt(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].replace(/\/+$/, '');
  return RATE_LIMIT_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Key for per-account auth limits: the normalised email in the JSON body.
 * Used alongside the per-IP limit because X-Forwarded-For can be spoofed by
 * callers that bypass the Vercel proxy (CORE-05).
 */
export function authAccountKey(req: { body?: unknown }): string | undefined {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== 'string') return undefined;
  const normalised = email.trim().toLowerCase();
  return normalised ? `acct:${normalised}` : undefined;
}
