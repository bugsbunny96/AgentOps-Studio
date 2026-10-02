import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  listTeamHandler,
  inviteMemberHandler,
  resendInvitationHandler,
  revokeInvitationHandler,
  updateMemberPermissionsHandler,
  removeMemberHandler,
  acceptInvitationHandler,
  inviteInfoHandler,
} from './team.controller';
import { orgAdminAccessLogHandler } from '../superadmin/superadmin.controller';
import { orgContext } from '../../middleware/orgContext';

const router = Router();

// ── Public routes (no auth required) ─────────────────────────────────────────
// Must be registered BEFORE router.use(authenticate).

// Preview the invite details before the user logs in.
// AcceptInvitePage calls this on mount to show "You've been invited to <org> as <role>"
// and to pre-fill the email on the login / register form.
router.get('/invite-info/:token', inviteInfoHandler);

// ── Authenticated routes ──────────────────────────────────────────────────────
router.use(authenticate);

// ── Members ──────────────────────────────────────────────────────────────────
router.get('/',                                 orgContext, listTeamHandler);
router.patch('/members/:id/permissions',        orgContext, updateMemberPermissionsHandler);
router.delete('/members/:id',                   orgContext, removeMemberHandler);

// ── Invitations ───────────────────────────────────────────────────────────────
router.post('/invite',                orgContext, inviteMemberHandler);
router.post('/invitations/:id/resend', orgContext, resendInvitationHandler);
router.delete('/invitations/:id',     orgContext, revokeInvitationHandler);

// ── Accept (user must be logged in to bind the invite to their account) ───────
router.post('/accept/:token',         acceptInvitationHandler);

// ── SA Access Log — recent super-admin sessions for this org (transparency) ──
// Returns timestamps + action labels only; SA email is intentionally omitted.
router.get('/admin-access-log',       orgContext, orgAdminAccessLogHandler);

export default router;
