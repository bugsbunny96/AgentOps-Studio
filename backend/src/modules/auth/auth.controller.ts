import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { ACCESS_COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from './auth.service';
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from './auth.validation';

// POST /api/v1/auth/register
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = RegisterSchema.parse(req.body);
    const data = await authService.register(dto);
    res.status(201).json({
      success: true,
      data,
      message: 'Account created. Please check your email to verify your account.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/verify-email
export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = VerifyEmailSchema.parse(req.body);
    const data = await authService.verifyEmail(dto);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/login
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = LoginSchema.parse(req.body);
    const result = await authService.login(dto);

    res.cookie('accessToken', result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        organizations: result.organizations,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/refresh
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token: string | undefined = req.cookies?.refreshToken;
    if (!token) {
      res
        .status(401)
        .json({ success: false, code: 'NO_REFRESH_TOKEN', message: 'Refresh token not found' });
      return;
    }

    const result = await authService.refreshTokens(token);

    res.cookie('accessToken', result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({ success: true, data: { message: 'Tokens refreshed' } });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/logout
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userId) {
      await authService.logout(req.userId);
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

    res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/me
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }
    const data = await authService.getMe(req.userId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/forgot-password
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dto = ForgotPasswordSchema.parse(req.body);
    const data = await authService.forgotPassword(dto);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/reset-password
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dto = ResetPasswordSchema.parse(req.body);
    const data = await authService.resetPassword(dto);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
