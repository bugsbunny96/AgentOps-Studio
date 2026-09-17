import { Request, Response, NextFunction } from 'express';
import {
  superAdminLogin,
  getPlatformStats,
  listOrgs,
  getOrgDetail,
  impersonateOrg,
  listUsers,
  getUserDetail,
  suspendUser,
  deleteUser,
  overrideOrgPlan,
  revertOrgPlanOverride,
  getBillingDashboard,
  getPlatformAnalytics,
  getRevenueAnalytics,
} from './superadmin.service';
import { writeAuditLog } from './superadmin-audit.service';
import { getAuditLogs } from './superadmin-audit.service';
import { SA_COOKIE_OPTIONS } from '../../middleware/superAdminAuthenticate';
import { redis } from '../../config/redis';

const SA_COOKIE = 'sas-session';
// Non-HttpOnly marker cookie so the browser JS can detect impersonation
const IMP_META_COOKIE = 'sas-imp';

// Impersonation access token TTL: 4 hours (matches PRD spec)
const IMPERSONATE_COOKIE_OPTIONS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'strict' as const,
  maxAge:    4 * 60 * 60 * 1000,
};

// ─── SA Login ─────────────────────────────────────────────────────────────────
export async function saLoginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'email and password required' });
      return;
    }

    const { token, admin } = await superAdminLogin(email, password);

    res.cookie(SA_COOKIE, token, SA_COOKIE_OPTIONS);

    await writeAuditLog({
      superAdminId:    admin.id,
      superAdminEmail: admin.email,
      action: 'SA_LOGIN',
      req,
    });

    res.status(200).json({ success: true, data: { admin } });
  } catch (err) {
    next(err);
  }
}

// ─── SA Logout ────────────────────────────────────────────────────────────────
export async function saLogoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.superAdminId && req.superAdminEmail) {
      await writeAuditLog({
        superAdminId:    req.superAdminId,
        superAdminEmail: req.superAdminEmail,
        action: 'SA_LOGOUT',
        req,
      });
    }

    res.clearCookie(SA_COOKIE, { ...SA_COOKIE_OPTIONS, maxAge: 0 });
    res.status(200).json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

// ─── SA Me ────────────────────────────────────────────────────────────────────
export function saMeHandler(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      id:    req.superAdminId,
      email: req.superAdminEmail,
      role:  req.superAdminRole,
    },
  });
}

// ─── Platform Stats ───────────────────────────────────────────────────────────
export async function saStatsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getPlatformStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

// ─── Platform Health ──────────────────────────────────────────────────────────
export async function saHealthHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mongoState = require('mongoose').connection.readyState;
    const mongoStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] ?? 'unknown';

    let redisStatus = 'unknown';
    try {
      const pong = await redis.ping();
      redisStatus = pong === 'PONG' ? 'connected' : 'error';
    } catch {
      redisStatus = 'disconnected';
    }

    res.status(200).json({
      success: true,
      data: {
        mongo: mongoStatus,
        redis: redisStatus,
        uptime: Math.floor(process.uptime()),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Org List ─────────────────────────────────────────────────────────────────
export async function saOrgListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page   = Number(req.query.page)  || 1;
    const limit  = Number(req.query.limit) || 20;
    const search = (req.query.search  as string) || undefined;
    const plan   = (req.query.plan    as string) || undefined;

    const result = await listOrgs(page, limit, search, plan);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Org Detail ───────────────────────────────────────────────────────────────
export async function saOrgDetailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.params.id as string;
    const result = await getOrgDetail(orgId);

    if (req.superAdminId && req.superAdminEmail) {
      await writeAuditLog({
        superAdminId:    req.superAdminId,
        superAdminEmail: req.superAdminEmail,
        action:          'SA_ORG_VIEW',
        targetType:      'Organization',
        targetId:        orgId,
        targetLabel:     result.org.name,
        req,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Impersonate Org ──────────────────────────────────────────────────────────
export async function saImpersonateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { impersonateToken, org, owner } = await impersonateOrg(req.params.id as string);

    // Set the standard accessToken cookie with the org owner's identity (4h TTL)
    res.cookie('accessToken', impersonateToken, IMPERSONATE_COOKIE_OPTIONS);

    // Set a non-HttpOnly marker so frontend JS knows we're in impersonation mode
    res.cookie(IMP_META_COOKIE, JSON.stringify({
      orgId:   org.id,
      orgName: org.name,
      orgSlug: org.slug,
    }), {
      httpOnly: false, // Must be readable by JS
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge:   4 * 60 * 60 * 1000,
    });

    if (req.superAdminId && req.superAdminEmail) {
      await writeAuditLog({
        superAdminId:    req.superAdminId,
        superAdminEmail: req.superAdminEmail,
        action:          'SA_ORG_IMPERSONATE',
        targetType:      'Organization',
        targetId:        org.id,
        targetLabel:     org.name,
        metadata:        { ownerId: owner.id, ownerEmail: owner.email },
        req,
      });
    }

    res.status(200).json({
      success: true,
      data:    { org, owner, redirectTo: '/dashboard' },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Exit Impersonation ───────────────────────────────────────────────────────
export async function saExitImpersonationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Clear the regular user access token (kills dashboard session)
    res.clearCookie('accessToken', {
      httpOnly:  true,
      secure:    process.env.NODE_ENV === 'production',
      sameSite:  'strict' as const,
    });
    // Clear the impersonation marker
    res.clearCookie(IMP_META_COOKIE, {
      httpOnly:  false,
      secure:    process.env.NODE_ENV === 'production',
      sameSite:  'strict' as const,
    });

    if (req.superAdminId && req.superAdminEmail) {
      await writeAuditLog({
        superAdminId:    req.superAdminId,
        superAdminEmail: req.superAdminEmail,
        action:          'SA_ORG_EXIT_IMPERSONATION',
        req,
      });
    }

    res.status(200).json({ success: true, data: { redirectTo: '/superadmin' } });
  } catch (err) {
    next(err);
  }
}

// ─── User List ────────────────────────────────────────────────────────────────
export async function saUserListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page   = Number(req.query.page)  || 1;
    const limit  = Number(req.query.limit) || 20;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await listUsers(page, limit, search, status);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── User Detail ──────────────────────────────────────────────────────────────
export async function saUserDetailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.id as string;
    const result = await getUserDetail(userId);

    if (req.superAdminId && req.superAdminEmail) {
      await writeAuditLog({
        superAdminId:    req.superAdminId,
        superAdminEmail: req.superAdminEmail,
        action:          'SA_USER_VIEW',
        targetType:      'User',
        targetId:        userId,
        targetLabel:     result.user.email,
        req,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Suspend User ─────────────────────────────────────────────────────────────
export async function saSuspendUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId  = req.params.id as string;
    const suspend = req.body.suspend !== false; // default to suspend=true
    const result  = await suspendUser(userId, suspend);

    if (req.superAdminId && req.superAdminEmail) {
      await writeAuditLog({
        superAdminId:    req.superAdminId,
        superAdminEmail: req.superAdminEmail,
        action:          suspend ? 'SA_USER_SUSPEND' : 'SA_USER_UNSUSPEND',
        targetType:      'User',
        targetId:        userId,
        req,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Delete User ──────────────────────────────────────────────────────────────
export async function saDeleteUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params.id as string;
    const result = await deleteUser(userId);

    if (req.superAdminId && req.superAdminEmail) {
      await writeAuditLog({
        superAdminId:    req.superAdminId,
        superAdminEmail: req.superAdminEmail,
        action:          'SA_USER_DELETE',
        targetType:      'User',
        targetId:        userId,
        req,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export async function saAuditLogsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page   = Number(req.query.page)  || 1;
    const limit  = Number(req.query.limit) || 50;
    const result = await getAuditLogs(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Plan Override ────────────────────────────────────────────────────────────
export async function saOverridePlanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id }   = req.params;
    const { plan, expiryDate } = req.body;

    if (!plan) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'plan is required' });
      return;
    }

    const saEmail  = req.superAdminEmail ?? 'superadmin';
    const expiry   = expiryDate ? new Date(expiryDate) : null;
    const result   = await overrideOrgPlan(id as string, plan, expiry, saEmail);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_PLAN_OVERRIDE',
      targetType:      'Organization',
      targetId:        id as string,
      targetLabel:     result.name,
      metadata:        { oldPlan: result.oldPlan, newPlan: plan, expiryDate },
      req,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function saRevertPlanOverrideHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await revertOrgPlanOverride(id as string);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: req.superAdminEmail ?? 'superadmin',
      action:          'SA_PLAN_OVERRIDE_REVERT',
      targetType:      'Organization',
      targetId:        id as string,
      targetLabel:     result.name,
      metadata:        { revertedToPlan: result.plan },
      req,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Billing Dashboard ────────────────────────────────────────────────────────
export async function saBillingDashboardHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getBillingDashboard();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Platform Analytics ───────────────────────────────────────────────────────
export async function saPlatformAnalyticsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days   = Number(req.query.days) || 30;
    const result = await getPlatformAnalytics(days);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Revenue Analytics ────────────────────────────────────────────────────────
export async function saRevenueAnalyticsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getRevenueAnalytics();
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — OPS TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

import {
  listGlobalFlags,
  listOrgFlags,
  toggleFlag,
  createOrgFlag,
  deleteFlag,
  ORG_FLAG_TEMPLATES,
  GLOBAL_FLAG_TEMPLATES,
} from '../feature-flags/feature-flag.service';

import {
  getAllQueueStats,
  retryFailedJobs,
  cleanCompletedJobs,
  cleanFailedJobs,
  pauseQueue,
  resumeQueue,
  getFailedJobs,
} from '../jobs/jobs.service';

import {
  listErrorLogs,
  getErrorStats,
  getTotalErrorCount,
} from '../error-log/error-log.service';

// ─── Enhanced Health ──────────────────────────────────────────────────────────

export async function saHealthEnhancedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mongoose = require('mongoose') as typeof import('mongoose');
    const mongoState = mongoose.connection.readyState;
    const mongoStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] ?? 'unknown';

    let redisStatus = 'unknown';
    let redisLatencyMs: number | null = null;
    try {
      const t0 = Date.now();
      const pong = await redis.ping();
      redisLatencyMs = Date.now() - t0;
      redisStatus = pong === 'PONG' ? 'connected' : 'error';
    } catch {
      redisStatus = 'disconnected';
    }

    // BullMQ queue depths (lightweight — just counts)
    let queueStats: Awaited<ReturnType<typeof getAllQueueStats>> = [];
    try {
      queueStats = await getAllQueueStats();
    } catch {
      // Non-fatal if Redis is partially available
    }

    const mem = process.memoryUsage();
    const data = {
      mongo: {
        status:     mongoStatus,
        readyState: mongoState,
      },
      redis: {
        status:    redisStatus,
        latencyMs: redisLatencyMs,
      },
      queues: queueStats.map(q => ({
        id:       q.id,
        label:    q.label,
        waiting:  q.waiting,
        active:   q.active,
        failed:   q.failed,
        isPaused: q.isPaused,
      })),
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMb: {
          rss:       Math.round(mem.rss / 1024 / 1024),
          heapUsed:  Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
        nodeVersion: process.version,
        pid:         process.pid,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

export async function saListGlobalFlagsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const flags = await listGlobalFlags();
    res.status(200).json({ success: true, data: { flags, templates: GLOBAL_FLAG_TEMPLATES } });
  } catch (err) {
    next(err);
  }
}

export async function saListOrgFlagsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = req.params;
    const flags = await listOrgFlags(orgId as string);
    res.status(200).json({ success: true, data: { flags, templates: ORG_FLAG_TEMPLATES } });
  } catch (err) {
    next(err);
  }
}

export async function saToggleFlagHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { enabled } = req.body as { enabled: boolean };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'enabled (boolean) is required' });
      return;
    }

    const flag = await toggleFlag(id as string, enabled, saEmail);
    if (!flag) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Feature flag not found' });
      return;
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_FLAG_TOGGLE',
      targetType:      'FeatureFlag',
      targetId:        id as string,
      targetLabel:     flag.name,
      metadata:        { enabled, scope: flag.scope, orgId: flag.orgId },
      req,
    });

    res.status(200).json({ success: true, data: flag });
  } catch (err) {
    next(err);
  }
}

export async function saCreateOrgFlagHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId, name, description, enabled = false } = req.body as {
      orgId:        string;
      name:         string;
      description?: string;
      enabled?:     boolean;
    };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    if (!orgId || !name) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'orgId and name are required' });
      return;
    }

    const flag = await createOrgFlag({
      orgId,
      name,
      description: description ?? '',
      enabled,
      changedBy:   saEmail,
    });

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_FLAG_CREATE',
      targetType:      'FeatureFlag',
      targetId:        String(flag._id),
      targetLabel:     flag.name,
      metadata:        { orgId, enabled },
      req,
    });

    res.status(201).json({ success: true, data: flag });
  } catch (err) {
    next(err);
  }
}

export async function saDeleteFlagHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';

    const deleted = await deleteFlag(id as string);
    if (!deleted) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Feature flag not found' });
      return;
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_FLAG_DELETE',
      targetType:      'FeatureFlag',
      targetId:        id as string,
      req,
    });

    res.status(200).json({ success: true, message: 'Flag deleted' });
  } catch (err) {
    next(err);
  }
}

// ─── Job Inspector ────────────────────────────────────────────────────────────

export async function saJobStatsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getAllQueueStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

export async function saJobFailedListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { queueId } = req.params;
    const jobs = await getFailedJobs(queueId as string);
    res.status(200).json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
}

export async function saJobRetryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { queueId } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const count = await retryFailedJobs(queueId as string);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_JOB_RETRY',
      targetType:      'Queue',
      targetLabel:     queueId as string,
      metadata:        { jobsRetried: count },
      req,
    });

    res.status(200).json({ success: true, data: { retried: count } });
  } catch (err) {
    next(err);
  }
}

export async function saJobCleanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { queueId } = req.params;
    const { type = 'completed' } = req.body as { type?: 'completed' | 'failed' };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    if (type === 'failed') {
      await cleanFailedJobs(queueId as string);
    } else {
      await cleanCompletedJobs(queueId as string);
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_JOB_CLEAN',
      targetType:      'Queue',
      targetLabel:     queueId as string,
      metadata:        { type },
      req,
    });

    res.status(200).json({ success: true, message: `Cleaned ${type} jobs from ${queueId as string}` });
  } catch (err) {
    next(err);
  }
}

export async function saJobPauseHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { queueId } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';
    await pauseQueue(queueId as string);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_JOB_PAUSE',
      targetType:      'Queue',
      targetLabel:     queueId as string,
      req,
    });

    res.status(200).json({ success: true, message: `Queue ${queueId as string} paused` });
  } catch (err) {
    next(err);
  }
}

export async function saJobResumeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { queueId } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';
    await resumeQueue(queueId as string);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_JOB_RESUME',
      targetType:      'Queue',
      targetLabel:     queueId as string,
      req,
    });

    res.status(200).json({ success: true, message: `Queue ${queueId as string} resumed` });
  } catch (err) {
    next(err);
  }
}

// ─── Error Logs ───────────────────────────────────────────────────────────────

export async function saErrorLogsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page       = Number(req.query.page)       || 1;
    const limit      = Math.min(Number(req.query.limit) || 50, 200);
    const code       = (req.query.code  as string) || undefined;
    const orgId      = (req.query.orgId as string) || undefined;
    const statusCode = req.query.statusCode ? Number(req.query.statusCode) : undefined;

    const result = await listErrorLogs(page, limit, { code, orgId, statusCode });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function saErrorStatsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [stats, total] = await Promise.all([getErrorStats(), getTotalErrorCount()]);
    res.status(200).json({ success: true, data: { stats, total } });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — COMMUNICATIONS + POLISH
// ═══════════════════════════════════════════════════════════════════════════════

import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
  getActiveBanners,
} from '../announcement/announcement.service';

import {
  listAllChangelog,
  createChangelogEntry,
  updateChangelogEntry,
  toggleChangelogPublish,
  deleteChangelogEntry,
  getPublicChangelog,
  getLatestPublishedDate,
} from '../changelog/changelog.service';

import {
  broadcastEmail,
  transferOrgOwnership,
  getAdminAccessLog,
} from './superadmin.service';

// ─── Public Announcement Banner (no SA auth) ──────────────────────────────────

export async function publicAnnouncementsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Resolve plan from the X-Organization-ID header (sent by axiosInstance on every dashboard call).
    // validateOrganization middleware is intentionally NOT used here — we only need the plan.
    let plan = 'free';
    const orgId = req.headers['x-organization-id'] as string | undefined;
    if (orgId) {
      const { OrganizationModel: OrgModel } = await import('../organization/organization.model');
      const org = await OrgModel.findById(orgId).select('plan planOverride').lean();
      if (org) {
        plan = (org.planOverride ?? org.plan) as string;
      }
    }
    const banners = await getActiveBanners(plan);
    res.status(200).json({ success: true, data: banners });
  } catch (err) {
    next(err);
  }
}

// ─── SA Announcements CRUD ────────────────────────────────────────────────────

export async function saListAnnouncementsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const list = await listAnnouncements();
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
}

export async function saCreateAnnouncementHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, message, type, targetPlan = 'all', dismissible = true, expiresAt } = req.body as {
      title:        string;
      message:      string;
      type:         'info' | 'warning' | 'critical';
      targetPlan?:  string;
      dismissible?: boolean;
      expiresAt?:   string;
    };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    if (!title || !message || !type) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'title, message, and type are required' });
      return;
    }

    const ann = await createAnnouncement({
      title, message,
      type:        type as 'info' | 'warning' | 'critical',
      targetPlan:  (targetPlan as 'all' | 'free' | 'starter' | 'growth' | 'enterprise') ?? 'all',
      dismissible,
      expiresAt:   expiresAt ? new Date(expiresAt) : null,
      createdBy:   saEmail,
    });

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_ANNOUNCEMENT_CREATE',
      targetType:      'Announcement',
      targetId:        String(ann._id),
      targetLabel:     ann.title,
      metadata:        { type, targetPlan },
      req,
    });

    res.status(201).json({ success: true, data: ann });
  } catch (err) {
    next(err);
  }
}

export async function saUpdateAnnouncementHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const patch = req.body as Parameters<typeof updateAnnouncement>[1];

    const ann = await updateAnnouncement(id as string, patch);
    if (!ann) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Announcement not found' });
      return;
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_ANNOUNCEMENT_UPDATE',
      targetType:      'Announcement',
      targetId:        id as string,
      targetLabel:     ann.title,
      req,
    });

    res.status(200).json({ success: true, data: ann });
  } catch (err) {
    next(err);
  }
}

export async function saToggleAnnouncementHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    const ann = await toggleAnnouncement(id as string, isActive);
    if (!ann) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Announcement not found' });
      return;
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_ANNOUNCEMENT_TOGGLE',
      targetType:      'Announcement',
      targetId:        id as string,
      targetLabel:     ann.title,
      metadata:        { isActive },
      req,
    });

    res.status(200).json({ success: true, data: ann });
  } catch (err) {
    next(err);
  }
}

export async function saDeleteAnnouncementHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';

    const deleted = await deleteAnnouncement(id as string);
    if (!deleted) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Announcement not found' });
      return;
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_ANNOUNCEMENT_DELETE',
      targetType:      'Announcement',
      targetId:        id as string,
      req,
    });

    res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    next(err);
  }
}

// ─── SA Changelog CRUD ────────────────────────────────────────────────────────

export async function saListChangelogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const list = await listAllChangelog();
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
}

export async function saCreateChangelogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, description, type, date, isPublished = false } = req.body as {
      title:         string;
      description:   string;
      type:          'new' | 'improved' | 'fixed';
      date?:         string;
      isPublished?:  boolean;
    };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    if (!title || !description || !type) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'title, description, and type are required' });
      return;
    }

    const entry = await createChangelogEntry({
      title, description,
      type:        type as 'new' | 'improved' | 'fixed',
      date:        date ? new Date(date) : new Date(),
      isPublished,
      createdBy:   saEmail,
    });

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_CHANGELOG_CREATE',
      targetType:      'Changelog',
      targetId:        String(entry._id),
      targetLabel:     entry.title,
      metadata:        { type, isPublished },
      req,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function saUpdateChangelogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const patch = req.body as Parameters<typeof updateChangelogEntry>[1];

    const entry = await updateChangelogEntry(id as string, patch);
    if (!entry) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Changelog entry not found' });
      return;
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_CHANGELOG_UPDATE',
      targetType:      'Changelog',
      targetId:        id as string,
      targetLabel:     entry.title,
      req,
    });

    res.status(200).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function saToggleChangelogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { isPublished } = req.body as { isPublished: boolean };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    const entry = await toggleChangelogPublish(id as string, isPublished);
    if (!entry) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Changelog entry not found' });
      return;
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_CHANGELOG_TOGGLE',
      targetType:      'Changelog',
      targetId:        id as string,
      targetLabel:     entry.title,
      metadata:        { isPublished },
      req,
    });

    res.status(200).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function saDeleteChangelogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';

    const deleted = await deleteChangelogEntry(id as string);
    if (!deleted) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Changelog entry not found' });
      return;
    }

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_CHANGELOG_DELETE',
      targetType:      'Changelog',
      targetId:        id as string,
      req,
    });

    res.status(200).json({ success: true, message: 'Changelog entry deleted' });
  } catch (err) {
    next(err);
  }
}

// ─── Public Changelog (no auth) ───────────────────────────────────────────────

export async function publicChangelogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await getPublicChangelog(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function publicChangelogLatestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const date = await getLatestPublishedDate();
    res.status(200).json({ success: true, data: { latestDate: date } });
  } catch (err) {
    next(err);
  }
}

// ─── Broadcast Email ──────────────────────────────────────────────────────────

export async function saBroadcastEmailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { subject, htmlBody, audience, confirmPhrase } = req.body as {
      subject:       string;
      htmlBody:      string;
      audience:      { type: 'all' | 'plan' | 'org'; plan?: string; orgId?: string };
      confirmPhrase: string;
    };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    if (!subject || !htmlBody || !audience) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'subject, htmlBody, and audience are required' });
      return;
    }

    // Safety gate — must type confirmation phrase for all-user sends
    if (audience.type === 'all' && confirmPhrase !== 'send to all users') {
      res.status(400).json({
        success: false, code: 'CONFIRM_REQUIRED',
        message: 'Type the exact phrase "send to all users" to confirm this broadcast',
      });
      return;
    }

    const result = await broadcastEmail(
      audience.type === 'plan'
        ? { type: 'plan', plan: audience.plan! }
        : audience.type === 'org'
        ? { type: 'org', orgId: audience.orgId! }
        : { type: 'all' },
      subject,
      htmlBody,
      saEmail,
    );

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_BROADCAST_EMAIL',
      metadata:        { audience, subject, sent: result.sent, skipped: result.skipped },
      req,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Broadcast Preview (counts + sample recipients, no actual send) ───────────

export async function saBroadcastPreviewHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { audience } = req.body as {
      audience: { type: 'all' | 'plan' | 'org'; plan?: string; orgId?: string };
    };

    if (!audience) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'audience is required' });
      return;
    }

    // Just count — reuse the service but don't send
    const { UserModel: UModel } = await import('../auth/auth.model');
    const { OrganizationModel: OModel, MembershipModel: MModel } = await import('../organization/organization.model');

    let count = 0;
    let sampleEmails: string[] = [];

    if (audience.type === 'all') {
      count = await UModel.countDocuments({ isActive: { $ne: false } });
      const samples = await UModel.find({ isActive: { $ne: false } }).select('email').limit(5).lean();
      sampleEmails = samples.map(u => u.email).filter(Boolean) as string[];
    } else if (audience.type === 'plan' && audience.plan) {
      const orgs = await OModel.find({ plan: audience.plan }).select('_id').lean();
      const orgIds = orgs.map(o => o._id);
      const memberships = await MModel.find({ orgId: { $in: orgIds } }).select('userId').lean();
      const userIds = [...new Set(memberships.map(m => String(m.userId)))];
      count = userIds.length;
      const samples = await UModel.find({ _id: { $in: userIds.slice(0, 5) } }).select('email').lean();
      sampleEmails = samples.map(u => u.email).filter(Boolean) as string[];
    } else if (audience.type === 'org' && audience.orgId) {
      const memberships = await MModel.find({ orgId: audience.orgId }).select('userId').lean();
      count = memberships.length;
      const samples = await UModel.find({ _id: { $in: memberships.slice(0, 5).map(m => m.userId) } }).select('email').lean();
      sampleEmails = samples.map(u => u.email).filter(Boolean) as string[];
    }

    res.status(200).json({ success: true, data: { count, sampleEmails } });
  } catch (err) {
    next(err);
  }
}

// ─── Org Ownership Transfer ───────────────────────────────────────────────────

export async function saTransferOwnershipHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { newOwnerId, confirmPhrase } = req.body as { newOwnerId: string; confirmPhrase: string };
    const saEmail = req.superAdminEmail ?? 'superadmin';

    if (!newOwnerId) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'newOwnerId is required' });
      return;
    }
    if (confirmPhrase !== 'transfer ownership') {
      res.status(400).json({
        success: false, code: 'CONFIRM_REQUIRED',
        message: 'Type the exact phrase "transfer ownership" to confirm',
      });
      return;
    }

    const result = await transferOrgOwnership(id as string, newOwnerId, saEmail);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_ORG_TRANSFER',
      targetType:      'Organization',
      targetId:        id as string,
      targetLabel:     result.orgName,
      metadata:        { previousOwner: result.previousOwner, newOwner: result.newOwner },
      req,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── Admin Access Log (for customer Settings page, auth required) ─────────────

export async function orgAdminAccessLogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Read orgId from X-Organization-ID header (sent by axiosInstance on every dashboard call)
    const orgId = req.headers['x-organization-id'] as string | undefined;
    if (!orgId) {
      res.status(400).json({ success: false, code: 'NO_ORG', message: 'No active org context' });
      return;
    }
    const log = await getAdminAccessLog(orgId, 20);
    res.status(200).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 19 — CEO / FOUNDER STRATEGIC FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

import { computeOrgHealthScore, computeAllOrgHealthScores } from './org-health.service';
import { getFlaggedCalls }                                   from './voice-quality.service';
import { buildReconciliationReport }                         from './vapi-reconciliation.service';
import { listChurnRisks, scoreOrgChurnRisk }                 from './churn-risk.service';
import { streamOrgDataExport }                               from './data-export.service';
import { setWhiteLabel, clearWhiteLabel, getOrgBranding }   from './white-label.service';
import {
  generateReferralCode,
  getReferralTree,
  getTopReferrers,
  applyReferralCode,
} from './referral.service';
import {
  createEnterpriseLink,
  listEnterpriseLinks,
  getEnterpriseLinkByToken,
  revokeEnterpriseLink,
} from './enterprise-link.service';
import {
  createABTest,
  listABTests,
  getABTest,
  updateABTest,
  deleteABTest,
  startABTest,
  pauseABTest,
  endABTest,
  setOrgAssignment,
  recordConversion,
} from './ab-test.service';
import { churnRiskQueue } from '../../jobs/churnRisk.queue';

// ─── 19.2 Org Health Score ────────────────────────────────────────────────────

export async function saOrgHealthListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const scores = await computeAllOrgHealthScores(limit);
    res.status(200).json({ success: true, data: scores });
  } catch (err) { next(err); }
}

export async function saOrgHealthDetailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const score = await computeOrgHealthScore(id as string);
    res.status(200).json({ success: true, data: score });
  } catch (err) { next(err); }
}

// ─── 19.5 Voice Quality ───────────────────────────────────────────────────────

export async function saVoiceQualityHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days   = Number(req.query.days)   || 30;
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const orgId  = req.query.orgId as string | undefined;
    const result = await getFlaggedCalls({ orgId, days, limit, offset });
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ─── 19.10 Vapi Reconciliation ────────────────────────────────────────────────

export async function saVapiReconciliationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days  = Number(req.query.days)  || 30;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const report = await buildReconciliationReport(days, limit);
    res.status(200).json({ success: true, data: report });
  } catch (err) { next(err); }
}

// ─── 19.6 Churn Risk ──────────────────────────────────────────────────────────

export async function saChurnRiskListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tier   = req.query.tier   as 'high' | 'medium' | 'low' | undefined;
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const results = await listChurnRisks({ tier, limit, offset });
    res.status(200).json({ success: true, data: results });
  } catch (err) { next(err); }
}

export async function saChurnRiskScanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = req.body as { orgId?: string };
    if (orgId) {
      // Single org — run inline so SA gets instant feedback
      const result = await scoreOrgChurnRisk(orgId as string);
      res.status(200).json({ success: true, data: result });
    } else {
      // Full scan — enqueue the job so it doesn't time out
      await churnRiskQueue.add('daily-churn-scan', {}, { jobId: `on-demand-${Date.now()}` });
      res.status(202).json({ success: true, message: 'Full churn risk scan enqueued' });
    }
  } catch (err) { next(err); }
}

// ─── 19.4 GDPR Data Export ───────────────────────────────────────────────────

export async function saOrgDataExportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="org-${id as string}-export.zip"`);

    await streamOrgDataExport(id as string, res);

    void writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_ORG_EXPORT',
      targetType:      'Organization',
      targetId:        id as string,
      req,
    });
  } catch (err) { next(err); }
}

// ─── 19.7 White-label ────────────────────────────────────────────────────────

export async function saSetWhiteLabelHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const { enabled, appName, logoUrl, brandColor, supportEmail } = req.body as {
      enabled:       boolean;
      appName?:      string;
      logoUrl?:      string;
      brandColor?:   string;
      supportEmail?: string;
    };
    await setWhiteLabel(id as string, { enabled, appName, logoUrl, brandColor, supportEmail }, saEmail);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_WHITE_LABEL_SET',
      targetType:      'Organization',
      targetId:        id as string,
      metadata:        { enabled, appName, brandColor },
      req,
    });

    res.status(200).json({ success: true, message: 'White-label config updated' });
  } catch (err) { next(err); }
}

export async function saClearWhiteLabelHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await clearWhiteLabel(id as string);
    res.status(200).json({ success: true, message: 'White-label config cleared' });
  } catch (err) { next(err); }
}

/** Public endpoint — no SA auth needed (called by the org's own frontend) */
export async function publicOrgBrandingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.params.orgId as string;
    const branding = await getOrgBranding(orgId);
    res.status(200).json({ success: true, data: branding });
  } catch (err) { next(err); }
}

// ─── 19.8 Referral ───────────────────────────────────────────────────────────

export async function saReferralCodeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const code = await generateReferralCode(id as string);
    res.status(200).json({ success: true, data: { referralCode: code } });
  } catch (err) { next(err); }
}

export async function saReferralTreeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const tree = await getReferralTree(id as string);
    res.status(200).json({ success: true, data: tree });
  } catch (err) { next(err); }
}

export async function saTopReferrersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const top = await getTopReferrers(limit);
    res.status(200).json({ success: true, data: top });
  } catch (err) { next(err); }
}

export async function saApplyReferralCodeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId, referralCode } = req.body as { orgId: string; referralCode: string };
    if (!orgId || !referralCode) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'orgId and referralCode are required' });
      return;
    }
    const ok = await applyReferralCode(orgId, referralCode);
    res.status(200).json({ success: true, data: { applied: ok } });
  } catch (err) { next(err); }
}

// ─── 19.3 Enterprise Links ───────────────────────────────────────────────────

export async function saCreateEnterpriseLinkHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const { plan, trialDays, prefilledName, prefilledEmail, prefilledCompany, prefilledIndustry, note, expiryHours } = req.body as {
      plan:               'free' | 'starter' | 'growth' | 'enterprise';
      trialDays?:         number;
      prefilledName?:     string;
      prefilledEmail?:    string;
      prefilledCompany?:  string;
      prefilledIndustry?: string;
      note?:              string;
      expiryHours?:       number;
    };
    if (!plan) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'plan is required' });
      return;
    }
    const link = await createEnterpriseLink({ plan, trialDays, prefilledName, prefilledEmail, prefilledCompany, prefilledIndustry, note, expiryHours }, saEmail);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_ENTERPRISE_LINK_CREATE',
      metadata:        { plan, trialDays, prefilledEmail },
      req,
    });

    res.status(201).json({ success: true, data: link });
  } catch (err) { next(err); }
}

export async function saListEnterpriseLinksHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query.status as string | undefined;
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const links = await listEnterpriseLinks({ status, limit, offset });
    res.status(200).json({ success: true, data: links });
  } catch (err) { next(err); }
}

/** Public — validate token and return prefill data */
export async function publicEnterpriseLinkHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.params;
    const link = await getEnterpriseLinkByToken(token as string);
    if (!link) {
      res.status(404).json({ success: false, code: 'LINK_INVALID', message: 'Link is invalid, expired, or already used' });
      return;
    }
    res.status(200).json({
      success: true,
      data: {
        plan:              link.plan,
        trialDays:         link.trialDays,
        prefilledName:     link.prefilledName,
        prefilledEmail:    link.prefilledEmail,
        prefilledCompany:  link.prefilledCompany,
        prefilledIndustry: link.prefilledIndustry,
        expiresAt:         link.expiresAt,
      },
    });
  } catch (err) { next(err); }
}

export async function saRevokeEnterpriseLinkHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await revokeEnterpriseLink(id as string);
    res.status(200).json({ success: true, message: 'Link revoked' });
  } catch (err) { next(err); }
}

// ─── 19.9 A/B Tests ──────────────────────────────────────────────────────────

export async function saABTestListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query.status as string | undefined;
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const tests = await listABTests({ status, limit, offset });
    res.status(200).json({ success: true, data: tests });
  } catch (err) { next(err); }
}

export async function saABTestDetailHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const test = await getABTest(req.params.id as string);
    if (!test) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Test not found' });
      return;
    }
    res.status(200).json({ success: true, data: test });
  } catch (err) { next(err); }
}

export async function saABTestCreateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const test = await createABTest(req.body as Parameters<typeof createABTest>[0], saEmail);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_ABTEST_CREATE',
      targetType:      'ABTest',
      targetId:        String(test._id),
      targetLabel:     test.name,
      req,
    });

    res.status(201).json({ success: true, data: test });
  } catch (err) { next(err); }
}

export async function saABTestUpdateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const test = await updateABTest(req.params.id as string, req.body as Parameters<typeof updateABTest>[1]);
    if (!test) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Test not found' });
      return;
    }
    res.status(200).json({ success: true, data: test });
  } catch (err) { next(err); }
}

export async function saABTestDeleteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteABTest(req.params.id as string);
    res.status(200).json({ success: true, message: 'Test deleted' });
  } catch (err) { next(err); }
}

export async function saABTestStartHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const test = await startABTest(req.params.id as string);
    res.status(200).json({ success: true, data: test });
  } catch (err) { next(err); }
}

export async function saABTestPauseHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const test = await pauseABTest(req.params.id as string);
    res.status(200).json({ success: true, data: test });
  } catch (err) { next(err); }
}

export async function saABTestEndHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const test = await endABTest(req.params.id as string);
    res.status(200).json({ success: true, data: test });
  } catch (err) { next(err); }
}

export async function saABTestAssignHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId, variantId } = req.body as { orgId: string; variantId: string };
    if (!orgId || !variantId) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'orgId and variantId are required' });
      return;
    }
    await setOrgAssignment(req.params.id as string, orgId, variantId);
    res.status(200).json({ success: true, message: 'Assignment updated' });
  } catch (err) { next(err); }
}

export async function saABTestConversionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId } = req.body as { orgId: string };
    if (!orgId) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'orgId is required' });
      return;
    }
    await recordConversion(req.params.id as string, orgId);
    res.status(200).json({ success: true, message: 'Conversion recorded' });
  } catch (err) { next(err); }
}
