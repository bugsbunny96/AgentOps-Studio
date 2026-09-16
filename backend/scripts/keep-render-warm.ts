/**
 * Keep-alive pinger for Render free-tier — prevents cold starts during calls.
 *
 * Pings the backend health endpoint every 5 minutes.
 * Run this locally while demoing, or set up a free UptimeRobot monitor instead.
 *
 * UptimeRobot (recommended, runs 24/7 for free):
 *   https://uptimerobot.com → New Monitor → HTTP(s) →
 *   URL: https://agentops-studio-backend-o2jx.onrender.com/api/v1/health
 *   Interval: every 5 minutes
 *
 * Local run: npx tsx scripts/keep-render-warm.ts
 */

const BACKEND_URL = 'https://agentops-studio-backend-o2jx.onrender.com/api/v1/health';
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function ping() {
  const start = Date.now();
  try {
    const res = await fetch(BACKEND_URL, { signal: AbortSignal.timeout(15_000) });
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ✅  ${res.status} — ${elapsed}ms`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${new Date().toISOString()}] ❌  ping failed: ${msg}`);
  }
}

console.log(`Pinging ${BACKEND_URL} every 5 minutes. Press Ctrl+C to stop.\n`);
ping(); // immediate first ping
setInterval(ping, INTERVAL_MS);
