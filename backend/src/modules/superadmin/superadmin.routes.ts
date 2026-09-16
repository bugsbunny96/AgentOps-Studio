import { Router } from 'express';
import { requireSuperAdmin } from '../../middleware/superAdminAuthenticate';
import {
  saLoginHandler,
  saLogoutHandler,
  saMeHandler,
  saStatsHandler,
  saHealthHandler,
  saHealthEnhancedHandler,
  // Phase 5
  saListAnnouncementsHandler,
  saCreateAnnouncementHandler,
  saUpdateAnnouncementHandler,
  saToggleAnnouncementHandler,
  saDeleteAnnouncementHandler,
  saListChangelogHandler,
  saCreateChangelogHandler,
  saUpdateChangelogHandler,
  saToggleChangelogHandler,
  saDeleteChangelogHandler,
  saBroadcastEmailHandler,
  saBroadcastPreviewHandler,
  saTransferOwnershipHandler,
  saOrgListHandler,
  saOrgDetailHandler,
  saImpersonateHandler,
  saExitImpersonationHandler,
  saUserListHandler,
  saUserDetailHandler,
  saSuspendUserHandler,
  saDeleteUserHandler,
  saAuditLogsHandler,
  saOverridePlanHandler,
  saRevertPlanOverrideHandler,
  saBillingDashboardHandler,
  saPlatformAnalyticsHandler,
  saRevenueAnalyticsHandler,
  // Phase 4 — Ops Tools
  saListGlobalFlagsHandler,
  saListOrgFlagsHandler,
  saToggleFlagHandler,
  saCreateOrgFlagHandler,
  saDeleteFlagHandler,
  saJobStatsHandler,
  saJobFailedListHandler,
  saJobRetryHandler,
  saJobCleanHandler,
  saJobPauseHandler,
  saJobResumeHandler,
  saErrorLogsHandler,
  saErrorStatsHandler,
  // Phase 19 — CEO Strategic Features
  saOrgHealthListHandler,
  saOrgHealthDetailHandler,
  saVoiceQualityHandler,
  saVapiReconciliationHandler,
  saChurnRiskListHandler,
  saChurnRiskScanHandler,
  saOrgDataExportHandler,
  saSetWhiteLabelHandler,
  saClearWhiteLabelHandler,
  saReferralCodeHandler,
  saReferralTreeHandler,
  saTopReferrersHandler,
  saApplyReferralCodeHandler,
  saCreateEnterpriseLinkHandler,
  saListEnterpriseLinksHandler,
  saRevokeEnterpriseLinkHandler,
  saABTestListHandler,
  saABTestDetailHandler,
  saABTestCreateHandler,
  saABTestUpdateHandler,
  saABTestDeleteHandler,
  saABTestStartHandler,
  saABTestPauseHandler,
  saABTestEndHandler,
  saABTestAssignHandler,
  saABTestConversionHandler,
} from './superadmin.controller';
import {
  saBlogListHandler,
  saBlogGetHandler,
  saBlogCreateHandler,
  saBlogUpdateHandler,
  saBlogToggleHandler,
  saBlogDeleteHandler,
} from '../blog/blog.controller';
import {
  saPromoListHandler,
  saPromoGetHandler,
  saPromoCreateHandler,
  saPromoUpdateHandler,
  saPromoToggleHandler,
  saPromoDeleteHandler,
  saPromoApplyHandler,
} from '../promo/promo.controller';

export const superadminRouter = Router();

// ── Public SA auth (no requireSuperAdmin guard) ───────────────────────────────
superadminRouter.post('/auth/login',  saLoginHandler);
superadminRouter.post('/auth/logout', requireSuperAdmin, saLogoutHandler);
superadminRouter.get('/auth/me',      requireSuperAdmin, saMeHandler);

// ── All routes below require a valid sas-session ──────────────────────────────
superadminRouter.use(requireSuperAdmin);

// Stats + health
superadminRouter.get('/stats',           saStatsHandler);
superadminRouter.get('/health',          saHealthHandler);          // basic (legacy)
superadminRouter.get('/health/enhanced', saHealthEnhancedHandler);  // Phase 4 — full health panel

// Audit logs
superadminRouter.get('/audit-logs', saAuditLogsHandler);

// Orgs
superadminRouter.get('/orgs',                     saOrgListHandler);
superadminRouter.get('/orgs/:id',                 saOrgDetailHandler);
superadminRouter.post('/orgs/:id/impersonate',    saImpersonateHandler);
superadminRouter.post('/exit-impersonation',      saExitImpersonationHandler);
superadminRouter.patch('/orgs/:id/plan-override', saOverridePlanHandler);
superadminRouter.delete('/orgs/:id/plan-override', saRevertPlanOverrideHandler);

// Billing + Analytics
superadminRouter.get('/billing',            saBillingDashboardHandler);
superadminRouter.get('/analytics',          saPlatformAnalyticsHandler);
superadminRouter.get('/analytics/revenue',  saRevenueAnalyticsHandler);

// Users
superadminRouter.get('/users',              saUserListHandler);
superadminRouter.get('/users/:id',          saUserDetailHandler);
superadminRouter.patch('/users/:id/suspend', saSuspendUserHandler);
superadminRouter.delete('/users/:id',       saDeleteUserHandler);

// Blog (SA CRUD — list includes drafts)
superadminRouter.get('/blog',              saBlogListHandler);
superadminRouter.post('/blog',             saBlogCreateHandler);
superadminRouter.get('/blog/:id',          saBlogGetHandler);
superadminRouter.patch('/blog/:id',        saBlogUpdateHandler);
superadminRouter.patch('/blog/:id/toggle', saBlogToggleHandler);
superadminRouter.delete('/blog/:id',       saBlogDeleteHandler);

// Promo Codes
superadminRouter.get('/promo',              saPromoListHandler);
superadminRouter.post('/promo',             saPromoCreateHandler);
superadminRouter.get('/promo/:id',          saPromoGetHandler);
superadminRouter.patch('/promo/:id',        saPromoUpdateHandler);
superadminRouter.patch('/promo/:id/toggle', saPromoToggleHandler);
superadminRouter.delete('/promo/:id',       saPromoDeleteHandler);
superadminRouter.post('/promo/:id/apply',   saPromoApplyHandler);

// ── Phase 4 — Ops Tools ───────────────────────────────────────────────────────

// Feature Flags
superadminRouter.get('/flags',                   saListGlobalFlagsHandler);
superadminRouter.get('/flags/org/:orgId',        saListOrgFlagsHandler);
superadminRouter.patch('/flags/:id/toggle',      saToggleFlagHandler);
superadminRouter.post('/flags/org',              saCreateOrgFlagHandler);
superadminRouter.delete('/flags/:id',            saDeleteFlagHandler);

// BullMQ Job Inspector
superadminRouter.get('/jobs',                              saJobStatsHandler);
superadminRouter.get('/jobs/:queueId/failed',              saJobFailedListHandler);
superadminRouter.post('/jobs/:queueId/retry',              saJobRetryHandler);
superadminRouter.post('/jobs/:queueId/clean',              saJobCleanHandler);
superadminRouter.post('/jobs/:queueId/pause',              saJobPauseHandler);
superadminRouter.post('/jobs/:queueId/resume',             saJobResumeHandler);

// Error Logs
superadminRouter.get('/error-logs',       saErrorLogsHandler);
superadminRouter.get('/error-logs/stats', saErrorStatsHandler);

// ── Phase 5 — Communications + Polish ────────────────────────────────────────

// Announcements
superadminRouter.get('/announcements',              saListAnnouncementsHandler);
superadminRouter.post('/announcements',             saCreateAnnouncementHandler);
superadminRouter.patch('/announcements/:id',        saUpdateAnnouncementHandler);
superadminRouter.patch('/announcements/:id/toggle', saToggleAnnouncementHandler);
superadminRouter.delete('/announcements/:id',       saDeleteAnnouncementHandler);

// Changelog
superadminRouter.get('/changelog',                saListChangelogHandler);
superadminRouter.post('/changelog',               saCreateChangelogHandler);
superadminRouter.patch('/changelog/:id',          saUpdateChangelogHandler);
superadminRouter.patch('/changelog/:id/toggle',   saToggleChangelogHandler);
superadminRouter.delete('/changelog/:id',         saDeleteChangelogHandler);

// Broadcast Email
superadminRouter.post('/broadcast-email',         saBroadcastEmailHandler);
superadminRouter.post('/broadcast-email/preview', saBroadcastPreviewHandler);

// Org Ownership Transfer
superadminRouter.post('/orgs/:id/transfer-ownership', saTransferOwnershipHandler);

// ── Phase 19 — CEO Strategic Features ────────────────────────────────────────

// 19.2 Org Health Score
superadminRouter.get('/org-health',       saOrgHealthListHandler);
superadminRouter.get('/org-health/:id',   saOrgHealthDetailHandler);

// 19.5 Voice Quality
superadminRouter.get('/voice-quality',    saVoiceQualityHandler);

// 19.10 Vapi Reconciliation
superadminRouter.get('/vapi-reconciliation', saVapiReconciliationHandler);

// 19.6 Churn Risk
superadminRouter.get('/churn-risk',       saChurnRiskListHandler);
superadminRouter.post('/churn-risk/scan', saChurnRiskScanHandler);

// 19.4 GDPR Data Export
superadminRouter.get('/orgs/:id/export',  saOrgDataExportHandler);

// 19.7 White-label
superadminRouter.put('/orgs/:id/white-label',    saSetWhiteLabelHandler);
superadminRouter.delete('/orgs/:id/white-label', saClearWhiteLabelHandler);

// 19.8 Referral
superadminRouter.post('/orgs/:id/referral-code', saReferralCodeHandler);
superadminRouter.get('/orgs/:id/referral-tree',  saReferralTreeHandler);
superadminRouter.get('/referrals/top',           saTopReferrersHandler);
superadminRouter.post('/referrals/apply',        saApplyReferralCodeHandler);

// 19.3 Enterprise Links
superadminRouter.get('/enterprise-links',           saListEnterpriseLinksHandler);
superadminRouter.post('/enterprise-links',          saCreateEnterpriseLinkHandler);
superadminRouter.delete('/enterprise-links/:id',    saRevokeEnterpriseLinkHandler);

// 19.9 A/B Tests
superadminRouter.get('/ab-tests',                      saABTestListHandler);
superadminRouter.post('/ab-tests',                     saABTestCreateHandler);
superadminRouter.get('/ab-tests/:id',                  saABTestDetailHandler);
superadminRouter.patch('/ab-tests/:id',                saABTestUpdateHandler);
superadminRouter.delete('/ab-tests/:id',               saABTestDeleteHandler);
superadminRouter.post('/ab-tests/:id/start',           saABTestStartHandler);
superadminRouter.post('/ab-tests/:id/pause',           saABTestPauseHandler);
superadminRouter.post('/ab-tests/:id/end',             saABTestEndHandler);
superadminRouter.post('/ab-tests/:id/assign',          saABTestAssignHandler);
superadminRouter.post('/ab-tests/:id/conversion',      saABTestConversionHandler);
