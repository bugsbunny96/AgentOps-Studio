/**
 * Org context + authorization middleware (SEC-05)
 *
 *   router.use(authenticate, orgContext);
 *   router.post('/provision', requireOwner, handler);
 *   router.get('/', requirePermission('calls'), handler);
 *
 * orgContext:
 *   - X-Organization-ID present → must be a valid id the user is a member of (else 400/403)
 *   - header absent → the user's only (oldest) membership; 403 NO_ORGANIZATION if none
 *   Sets req.orgId, req.userRole, req.memberPermissions and runs the rest of the
 *   request inside runWithOrgContext so services resolve the same org.
 *
 * Roles: Owner = full access. Member = per-section permissions set by the Owner
 * (agents, calls, knowledgeBase, team). Settings-type actions are Owner-only.
 */
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { MembershipModel, type IMemberPermissions } from '../modules/organization/organization.model';
import { runWithOrgContext } from '../utils/requestContext';

export type MemberPermission = keyof IMemberPermissions;

export async function orgContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers['x-organization-id'];
    const requested = Array.isArray(header) ? header[0] : header;

    let membership;
    if (requested) {
      if (!mongoose.isValidObjectId(requested)) {
        res.status(400).json({ success: false, code: 'INVALID_ORG_HEADER', message: 'X-Organization-ID is not a valid id' });
        return;
      }
      membership = await MembershipModel.findOne({ userId: req.userId, organizationId: requested }).lean();
      if (!membership) {
        res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You do not have access to this organization' });
        return;
      }
    } else {
      membership = await MembershipModel.findOne({ userId: req.userId }).sort({ createdAt: 1 }).lean();
      if (!membership) {
        res.status(403).json({ success: false, code: 'NO_ORGANIZATION', message: 'You are not a member of any organization' });
        return;
      }
    }

    req.orgId = membership.organizationId.toString();
    req.userRole = membership.role;
    req.memberPermissions = membership.permissions;
    runWithOrgContext(req.orgId, () => next());
  } catch (err) {
    next(err);
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole === 'Owner') return next();
  res.status(403).json({ success: false, code: 'OWNER_ONLY', message: 'Only the organization owner can do this' });
}

export function requirePermission(permission: MemberPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.userRole === 'Owner') return next();
    if (req.userRole === 'Member' && req.memberPermissions?.[permission]) return next();
    res.status(403).json({
      success: false,
      code:    'PERMISSION_DENIED',
      message: `You don't have access to ${permission === 'knowledgeBase' ? 'the knowledge base' : permission}`,
    });
  };
}
