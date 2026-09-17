import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

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
  return jwt.verify(token, env.SA_JWT_SECRET) as SuperAdminTokenPayload;
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

  try {
    const payload = verifySuperAdminToken(token);
    req.superAdminId    = payload.superAdminId;
    req.superAdminEmail = payload.email;
    req.superAdminRole  = payload.role;
    next();
  } catch {
    res.status(401).json({
      success: false,
      code: 'SA_INVALID_TOKEN',
      message: 'Invalid or expired super admin session',
    });
  }
}
