import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Middleware: authenticate
 * Reads the HttpOnly `accessToken` cookie, verifies the JWT,
 * and injects `req.userId` + `req.userEmail` for downstream handlers.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.accessToken;

  if (!token) {
    res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired access token',
    });
  }
}
