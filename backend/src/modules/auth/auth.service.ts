import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserModel } from './auth.model';
import { MembershipModel } from '../organization/organization.model';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/email';
import { Unauthorized, BadRequest, Conflict } from '../../middleware/errorHandler';
import type {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.validation';
import type { IOrganization } from '../organization/organization.model';

// ─── Cookie Configuration ──────────────────────────────────────────────────
export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 15 * 60 * 1000, // 15 minutes
};

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const REFRESH_PREFIX = 'refresh:';

// ─── Helpers ───────────────────────────────────────────────────────────────
function buildOrgList(
  memberships: Array<{ organizationId: unknown; role: string }>
) {
  return memberships.map((m) => {
    const org = m.organizationId as IOrganization;
    return {
      id: org._id.toString(),
      name: org.name,
      slug: org.slug,
      onboardingStatus: org.onboardingStatus,
      role: m.role as 'Owner' | 'Admin' | 'Member',
    };
  });
}

// ─── Register ──────────────────────────────────────────────────────────────
export async function register(dto: RegisterDto) {
  const existing = await UserModel.findOne({ email: dto.email }).lean();
  if (existing) {
    throw Conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(dto.password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const user = await UserModel.create({
    name: dto.name,
    email: dto.email,
    passwordHash,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
  });

  // Fire-and-forget email (don't block registration on email failure in dev)
  sendVerificationEmail(user.email, user.name, verificationToken).catch(() => {
    // logged inside sendEmail
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    status: user.status,
  };
}

// ─── Verify Email ──────────────────────────────────────────────────────────
export async function verifyEmail(dto: VerifyEmailDto) {
  const user = await UserModel.findOne({
    emailVerificationToken: dto.token,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    throw BadRequest('Invalid or expired verification token', 'INVALID_VERIFICATION_TOKEN');
  }

  user.isVerified = true;
  user.status = 'Active';
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return { message: 'Email verified successfully. You can now log in.' };
}

// ─── Login ─────────────────────────────────────────────────────────────────
export async function login(dto: LoginDto) {
  const user = await UserModel.findOne({ email: dto.email }).select('+passwordHash');
  if (!user) throw Unauthorized('Invalid email or password');

  const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
  if (!passwordMatch) throw Unauthorized('Invalid email or password');

  if (!user.isVerified) {
    throw Unauthorized('Please verify your email before logging in', 'EMAIL_NOT_VERIFIED');
  }
  if (user.status === 'Suspended') {
    throw Unauthorized('Your account has been suspended. Contact support.', 'ACCOUNT_SUSPENDED');
  }

  // Load user's organizations via memberships
  const memberships = await MembershipModel.find({ userId: user._id })
    .populate<{ organizationId: IOrganization }>('organizationId')
    .lean();

  // Issue token pair
  const tokenId = crypto.randomUUID();
  const accessToken = signAccessToken({ userId: user._id.toString(), email: user.email });
  const refreshToken = signRefreshToken({ userId: user._id.toString(), tokenId });

  // Persist refresh tokenId in Redis (7 days)
  await redis.setex(`${REFRESH_PREFIX}${user._id.toString()}`, 7 * 24 * 60 * 60, tokenId);

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      status: user.status,
    },
    organizations: buildOrgList(memberships),
    accessToken,
    refreshToken,
  };
}

// ─── Refresh Token ─────────────────────────────────────────────────────────
export async function refreshTokens(token: string) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw Unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Check Redis to ensure token hasn't been revoked
  const storedTokenId = await redis.get(`${REFRESH_PREFIX}${payload.userId}`);
  if (!storedTokenId || storedTokenId !== payload.tokenId) {
    throw Unauthorized('Refresh token has been revoked', 'REFRESH_TOKEN_REVOKED');
  }

  const user = await UserModel.findById(payload.userId).lean();
  if (!user) throw Unauthorized('User not found', 'USER_NOT_FOUND');

  // Rotate: issue a fresh pair and update Redis
  const newTokenId = crypto.randomUUID();
  const accessToken = signAccessToken({ userId: user._id.toString(), email: user.email });
  const newRefreshToken = signRefreshToken({ userId: user._id.toString(), tokenId: newTokenId });

  await redis.setex(`${REFRESH_PREFIX}${user._id.toString()}`, 7 * 24 * 60 * 60, newTokenId);

  return { accessToken, refreshToken: newRefreshToken };
}

// ─── Logout ────────────────────────────────────────────────────────────────
export async function logout(userId: string) {
  await redis.del(`${REFRESH_PREFIX}${userId}`);
}

// ─── Get Me ────────────────────────────────────────────────────────────────
export async function getMe(userId: string) {
  const user = await UserModel.findById(userId).lean();
  if (!user) throw Unauthorized('User not found', 'USER_NOT_FOUND');

  const memberships = await MembershipModel.find({ userId: user._id })
    .populate<{ organizationId: IOrganization }>('organizationId')
    .lean();

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    status: user.status,
    organizations: buildOrgList(memberships),
  };
}

// ─── Forgot Password ───────────────────────────────────────────────────────
export async function forgotPassword(dto: ForgotPasswordDto) {
  // Always return the same message to prevent user enumeration
  const SAFE_MSG =
    'If an account exists with this email, you will receive a password reset link shortly.';

  const user = await UserModel.findOne({ email: dto.email }).select('+passwordResetToken +passwordResetExpires');
  if (!user) return { message: SAFE_MSG };

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await user.save();

  sendPasswordResetEmail(user.email, user.name, rawToken).catch(() => {
    // logged inside sendEmail
  });

  return { message: SAFE_MSG };
}

// ─── Reset Password ────────────────────────────────────────────────────────
export async function resetPassword(dto: ResetPasswordDto) {
  const hashedToken = crypto.createHash('sha256').update(dto.token).digest('hex');

  const user = await UserModel.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw BadRequest('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
  }

  user.passwordHash = await bcrypt.hash(dto.password, 12);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.status = 'Active';
  await user.save();

  // Invalidate any active sessions
  await redis.del(`${REFRESH_PREFIX}${user._id.toString()}`);

  return { message: 'Password reset successfully. Please log in with your new password.' };
}
