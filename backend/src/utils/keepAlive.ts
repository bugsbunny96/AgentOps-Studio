/**
 * Keep-alive self-ping for Render's free tier.
 *
 * Render free web services spin down after 15 minutes without inbound traffic.
 * This pings the service's own PUBLIC URL on an interval; the request leaves the
 * container and re-enters through Render's edge, so it counts as inbound traffic
 * and the instance never goes idle.
 *
 * Enabled automatically on Render (RENDER_EXTERNAL_URL is injected by Render).
 * Override the target with KEEP_ALIVE_URL, disable with KEEP_ALIVE_ENABLED=false.
 */
import { env } from '../config/env';
import { logger } from './logger';

let timer: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;

function resolveTarget(): string | null {
  const base = env.KEEP_ALIVE_URL || env.RENDER_EXTERNAL_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/health`;
}

async function ping(url: string): Promise<void> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'agentops-keep-alive/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (consecutiveFailures > 0 || !res.ok) {
      logger.info(`[keep-alive] ${res.status} in ${Date.now() - started}ms`, { recoveredAfter: consecutiveFailures });
    }
    consecutiveFailures = res.ok ? 0 : consecutiveFailures + 1;
  } catch (err) {
    consecutiveFailures += 1;
    logger.warn('[keep-alive] ping failed', { url, consecutiveFailures, message: (err as Error).message });
  }
}

export function startKeepAlive(): void {
  if (!env.KEEP_ALIVE_ENABLED) return;
  const url = resolveTarget();
  if (!url) {
    logger.info('[keep-alive] disabled — no RENDER_EXTERNAL_URL / KEEP_ALIVE_URL (local dev)');
    return;
  }
  // Must stay under Render's 15-minute idle window.
  const minutes = Math.min(Math.max(env.KEEP_ALIVE_INTERVAL_MINUTES, 1), 14);
  timer = setInterval(() => void ping(url), minutes * 60_000);
  timer.unref(); // never block graceful shutdown
  logger.info(`[keep-alive] pinging ${url} every ${minutes} min`);
}

export function stopKeepAlive(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
