import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserModel } from '../modules/auth/auth.model';

export interface SuperAdminTokenPayload {
  superAdminId: string;
  email: string;
  role: 'root';
}

// Augment Express Request with super admin context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      superAdminId?: string;
      superAdminEmail?: string;
      superAdminRole?: 'root';
    }
  }
}

const SA_COOKIE = 'sas-session';

export function signSuperAdminToken(payload: SuperAdminTokenPayload): string {
  return jwt.sign(payload, env.SA_JWT_SECRET, { expiresIn: '12h' });
}

export function verifySuperAdminToken(token: string): SuperAdminTokenPayload {
  return jwt.verify(token, env.SA_JWT_SECRET, { algorithms: ['HS256'] }) as SuperAdminTokenPayload;
}

export const SA_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/superadmin',
  maxAge: 12 * 60 * 60 * 1000, // 12 hours
};

/**
 * Middleware: requireSuperAdmin
 * Reads the HttpOnly `sas-session` cookie, verifies the SA JWT,
 * and injects req.superAdminId + req.superAdminEmail for downstream handlers.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[SA_COOKIE];

  if (!token) {
    res.status(401).json({
      success: false,
      code: 'SA_UNAUTHORIZED',
      message: 'Super admin authentication required',
    });
    return;
  }

  let payload: SuperAdminTokenPayload;
  try {
    payload = verifySuperAdminToken(token);
  } catch {
    res.status(401).json({
      success: false,
      code: 'SA_INVALID_TOKEN',
      message: 'Invalid or expired super admin session',
    });
    return;
  }

  // Re-check the account on every request, so removing super-admin rights or
  // suspending the account ends a 12-hour session immediately.
  UserModel.findById(payload.superAdminId)
    .select('isSuperAdmin status')
    .lean<{ isSuperAdmin?: boolean; status?: string } | null>()
    .then((user) => {
      if (!user || !user.isSuperAdmin || user.status === 'Suspended') {
        res.status(401).json({
          success: false,
          code: 'SA_INVALID_TOKEN',
          message: 'Invalid or expired super admin session',
        });
        return;
      }
      req.superAdminId    = payload.superAdminId;
      req.superAdminEmail = payload.email;
      req.superAdminRole  = payload.role;
      next();
    })
    .catch(next);
}
