import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { onboardingRouter } from './modules/onboarding/onboarding.routes';
import { agentsRouter } from './modules/agents/agent.routes';
import { callsRouter } from './modules/calls/call.routes';
import { vapiWebhookRouter } from './modules/calls/webhook.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { kbRouter }        from './modules/knowledge-base/kb.routes';
import teamRouter          from './modules/team/team.routes';
import { billingRouter }   from './modules/billing/billing.routes';
import { superadminRouter }   from './modules/superadmin/superadmin.routes';
import { blogRouter }          from './modules/blog/blog.routes';
import { publicValidatePromoHandler } from './modules/promo/promo.controller';
import { announcementRouter }  from './modules/announcement/announcement.routes';
import { changelogRouter }     from './modules/changelog/changelog.routes';
import { catalogRouter }       from './modules/catalog/catalog.routes';
import { ordersRouter }        from './modules/orders/order.routes';
import { ttsBridgeRouter }     from './modules/tts-bridge/tts-bridge.routes';
import {
  publicEnterpriseLinkHandler,
  publicOrgBrandingHandler,
} from './modules/superadmin/superadmin.controller';

const app = express();

// ─── Trust proxy (needed behind ALB / Cloudflare) ────────────────────
app.set('trust proxy', 1);

// ─── Security Headers ────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // allow audio streaming
  contentSecurityPolicy: env.NODE_ENV === 'production',
}));

// ─── CORS ────────────────────────────────────────────────────────────
app.use(cors({
  origin: [env.CLIENT_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-ID'],
  exposedHeaders: ['X-Total-Count'],
}));

// ─── Billing routes BEFORE express.json() ────────────────────────────
// The Stripe webhook route requires raw bytes for signature verification.
// The billing router handles its own body parsing per-route (raw for webhook,
// json for checkout) — mounting it here keeps it outside the global json().
app.use('/api/v1/billing', billingRouter);

// ─── Body Parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Request Logging ─────────────────────────────────────────────────
app.use(requestLogger);

// ─── Rate Limiting ───────────────────────────────────────────────────
// Skip all rate limiting in test environment to allow integration tests to run freely.
const skipInTest = () => process.env.NODE_ENV === 'test';

// Standard: 100 requests per 15 min per IP
app.use('/api/v1', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' },
}));

// Auth: 10 attempts per 15 min — only on brute-forceable endpoints
app.use(['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/forgot-password', '/api/v1/auth/reset-password'], rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again in 15 minutes.' },
}));

// Crawl: 3 per hour per IP (prevent abuse of crawl infrastructure)
app.use(['/api/v1/onboarding/website/crawl', '/api/v1/knowledge-base/re-sync'], rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Crawl limit reached. Wait 1 hour before re-crawling.' },
}));

// ─── Health Check ────────────────────────────────────────────────────
// Exposed on two paths:
//   GET /health           — legacy / Docker HEALTHCHECK / Kubernetes liveness probe
//   GET /api/v1/health    — versioned URL; use this one for UptimeRobot & external monitors
// Both return identical payloads. Never add auth middleware to these routes.
function healthHandler(_req: express.Request, res: express.Response) {
  const mongoState = mongoose.connection.readyState;
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  const mongoStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] ?? 'unknown';
  const healthy = mongoState === 1; // MongoDB must be connected to be truly healthy

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'agentops-studio-backend',
    version: process.env.npm_package_version ?? '0.1.0',
    environment: env.NODE_ENV,
    mongo: mongoStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

app.get('/health',        healthHandler);   // Docker / K8s probes
app.get('/api/v1/health', healthHandler);   // UptimeRobot / external monitors

// ─── API v1 Routes (registered as layers are built) ──────────────────
// Layer 2 — Identity & Onboarding
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/onboarding', onboardingRouter);
app.use('/api/v1/knowledge-base', kbRouter);
app.use('/api/v1/team',          teamRouter);
// app.use('/api/v1/members', membersRouter);
// app.use('/api/v1/navigation', navigationRouter);
// app.use('/api/v1/feature-flags', featureFlagsRouter);

// Layer 3 — Voice AI
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/webhooks/vapi', vapiWebhookRouter);

// Layer 4 — Intelligence
app.use('/api/v1/calls', callsRouter);
app.use('/api/v1/catalog', catalogRouter);
app.use('/api/v1/orders', ordersRouter);

// TTS Bridge — Vapi custom-voice protocol endpoint (NOT behind auth; Vapi calls it directly)
// Only active when SARVAM_BRIDGE_URL points back here (opt-in via env)
app.use('/api/tts', ttsBridgeRouter);

// Layer 5 — Observability
app.use('/api/v1/analytics', analyticsRouter);
// app.use('/api/v1/audit', auditRouter);

// Public blog (no auth)
app.use('/api/v1/blog', blogRouter);

// Public promo validate (no auth — called at checkout)
app.post('/api/v1/promo/validate', publicValidatePromoHandler);

// Public announcements — authenticate middleware reads JWT, falls back to 'free' plan if no session
app.use('/api/v1/announcements', announcementRouter);

// Public changelog — no auth required
app.use('/api/v1/changelog', changelogRouter);

// Public enterprise link validator — 19.3 (no auth needed, link carries its own token)
app.get('/api/v1/enterprise-link/:token', publicEnterpriseLinkHandler);

// Public org branding — 19.7 (allows frontend to read white-label config for its own org)
app.get('/api/v1/org-branding/:orgId', publicOrgBrandingHandler);

// Super Admin (isolated prefix, own auth cookies)
app.use('/api/v1/superadmin', superadminRouter);

// ─── 404 Catch-all ───────────────────────────────────────────────────
app.use(notFound);

// ─── Global Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

export default app;
