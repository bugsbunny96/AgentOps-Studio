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
app.get('/health', (_req, res) => {
  const mongoState = mongoose.connection.readyState;
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  const mongoStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] ?? 'unknown';

  res.status(200).json({
    status: 'ok',
    service: 'agentops-studio-backend',
    version: process.env.npm_package_version ?? '0.1.0',
    environment: env.NODE_ENV,
    mongo: mongoStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ─── API v1 Routes (registered as layers are built) ──────────────────
// Layer 2 — Identity & Onboarding
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/onboarding', onboardingRouter);
// app.use('/api/v1/knowledge-base', knowledgeBaseRouter);
// app.use('/api/v1/members', membersRouter);
// app.use('/api/v1/navigation', navigationRouter);
// app.use('/api/v1/feature-flags', featureFlagsRouter);

// Layer 3 — Voice AI
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/webhooks/vapi', vapiWebhookRouter);

// Layer 4 — Intelligence
app.use('/api/v1/calls', callsRouter);

// Layer 5 — Observability
app.use('/api/v1/analytics', analyticsRouter);
// app.use('/api/v1/audit', auditRouter);

// ─── 404 Catch-all ───────────────────────────────────────────────────
app.use(notFound);

// ─── Global Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

export default app;
