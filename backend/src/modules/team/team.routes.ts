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
router.get('/',                                 listTeamHandler);
router.patch('/members/:id/permissions',        updateMemberPermissionsHandler);
router.delete('/members/:id',                   removeMemberHandler);

// ── Invitations ───────────────────────────────────────────────────────────────
router.post('/invite',                inviteMemberHandler);
router.post('/invitations/:id/resend', resendInvitationHandler);
router.delete('/invitations/:id',     revokeInvitationHandler);

// ── Accept (user must be logged in to bind the invite to their account) ───────
router.post('/accept/:token',         acceptInvitationHandler);

export default router;
