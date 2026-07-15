import { Request, Response, NextFunction } from 'express';
import { MembershipModel } from '../modules/organization/organization.model';

/**
 * Middleware: validateOrganization
 * Reads the `X-Organization-ID` header, confirms the authenticated user
 * is an active member of that organization, then injects `req.orgId`
 * and `req.userRole` for downstream controllers.
 *
 * Must be used AFTER `authenticate` middleware.
 */
export async function validateOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const orgId = req.headers['x-organization-id'] as string | undefined;

  if (!orgId) {
    res.status(400).json({
      success: false,
      code: 'MISSING_ORG_HEADER',
      message: 'X-Organization-ID header is required',
    });
    return;
  }

  try {
    const membership = await MembershipModel.findOne({
      userId: req.userId,
      organizationId: orgId,
    }).lean();

    if (!membership) {
      res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You do not have access to this organization',
      });
      return;
    }

    req.orgId = orgId;
    req.userRole = membership.role;
    next();
  } catch {
    next(new Error('Organization validation failed'));
  }
}
