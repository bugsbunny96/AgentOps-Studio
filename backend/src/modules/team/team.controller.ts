import { Request, Response, NextFunction } from 'express';
import {
  listTeam,
  inviteMember,
  resendInvitation,
  revokeInvitation,
  updateMemberPermissions,
  removeMember,
  acceptInvitation,
  getInviteInfo,
} from './team.service';

// ─── GET /api/v1/team ─────────────────────────────────────────────────────────

export async function listTeamHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listTeam(req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/team/invite ─────────────────────────────────────────────────

export async function inviteMemberHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email } = req.body as { email: string };
    const invitation = await inviteMember(req.userId!, { email });
    res.status(201).json({ success: true, data: invitation });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/team/invitations/:id/resend ─────────────────────────────────

export async function resendInvitationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    await resendInvitation(req.userId!, id);
    res.json({ success: true, message: 'Invitation resent' });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/v1/team/invitations/:id ──────────────────────────────────────

export async function revokeInvitationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    await revokeInvitation(req.userId!, id);
    res.json({ success: true, message: 'Invitation revoked' });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/v1/team/members/:id/permissions ──────────────────────────────

export async function updateMemberPermissionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    const member = await updateMemberPermissions(req.userId!, id, req.body);
    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/v1/team/members/:id ─────────────────────────────────────────

export async function removeMemberHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    await removeMember(req.userId!, id);
    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/team/accept/:token ─────────────────────────────────────────
// Public endpoint — JWT auth still required (user must be logged in to accept).

export async function acceptInvitationHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = Array.isArray(req.params['token']) ? req.params['token'][0] : req.params['token'];
    const result = await acceptInvitation(req.userId!, token);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/team/invite-info/:token ─────────────────────────────────────
// PUBLIC — no auth required. Returns email, orgName, role for the landing page.

export async function inviteInfoHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = Array.isArray(req.params['token']) ? req.params['token'][0] : req.params['token'];
    const info  = await getInviteInfo(token);
    res.json({ success: true, data: info });
  } catch (err) {
    next(err);
  }
}
