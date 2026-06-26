/**
 * L2.F2.M1 — Auth Integration Tests
 * Atomic Tasks: AT1–AT14
 *
 * Covers all 8 auth endpoints against a live Express app + MongoMemoryServer.
 * - Redis replaced with an in-memory Map (no real Redis needed)
 * - Email sending mocked (tokens captured from mock call args)
 * - Rate limiter skipped (NODE_ENV=test)
 * - MongoDB lifecycle managed by backend/src/test-utils/setup.ts (global setupFiles)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '@/app';
import { UserModel } from '@/modules/auth/auth.model';

// ── In-memory Redis store ────────────────────────────────────────────────────
// Replaces the real Redis singleton for all tests in this file.
const redisStore = new Map<string, string>();

vi.mock('@/config/redis', () => ({
  redis: {
    setex: vi.fn((key: string, _ttl: number, value: string) => {
      redisStore.set(key, value);
      return Promise.resolve('OK');
    }),
    get: vi.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    del: vi.fn((key: string) => {
      redisStore.delete(key);
      return Promise.resolve(1);
    }),
  },
}));

// ── Email mocks (capture raw tokens for reset-password tests) ─────────────────
const mockSendVerificationEmail = vi.fn().mockResolvedValue(undefined);
const mockSendPasswordResetEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('@/utils/email', () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

// ── Shared test credentials ───────────────────────────────────────────────────
const VALID_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Password123!',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** POST /register with optional field overrides */
async function registerUser(overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...VALID_USER, ...overrides });
}

/** Retrieve the plaintext verification token stored in the DB (field is select:false) */
async function getVerificationToken(email: string): Promise<string> {
  const user = await UserModel.findOne({ email })
    .select('+emailVerificationToken')
    .lean();
  if (!user?.emailVerificationToken) throw new Error(`No verification token for ${email}`);
  return user.emailVerificationToken;
}

/** Register + verify email → user is Active and ready to login */
async function registerAndVerify(overrides: Record<string, unknown> = {}): Promise<void> {
  const email = (overrides.email as string) ?? VALID_USER.email;
  await registerUser(overrides);
  const token = await getVerificationToken(email);
  await request(app).post('/api/v1/auth/verify-email').send({ token });
}

/** Register + verify + login → returns raw Set-Cookie headers */
async function registerVerifyAndLogin(overrides: Record<string, unknown> = {}): Promise<string[]> {
  const email = (overrides.email as string) ?? VALID_USER.email;
  const password = (overrides.password as string) ?? VALID_USER.password;
  await registerAndVerify(overrides);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return (res.headers['set-cookie'] as unknown as string[]) ?? [];
}

// ── Test lifecycle ─────────────────────────────────────────────────────────────
beforeEach(() => {
  redisStore.clear();
  vi.clearAllMocks();
  // Re-apply default implementations after clearAllMocks wipes call records
  mockSendVerificationEmail.mockResolvedValue(undefined);
  mockSendPasswordResetEmail.mockResolvedValue(undefined);
});

// ═════════════════════════════════════════════════════════════════════════════
// AT1 — POST /api/v1/auth/register
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/register', () => {
  it('AT1.1 — 201: creates user with isVerified=false, status=Pending', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(VALID_USER.email);
    expect(res.body.data.name).toBe(VALID_USER.name);
    expect(res.body.data.isVerified).toBe(false);
    expect(res.body.data.status).toBe('Pending');

    // Confirm in DB
    const dbUser = await UserModel.findOne({ email: VALID_USER.email }).lean();
    expect(dbUser).not.toBeNull();
    expect(dbUser!.isVerified).toBe(false);
    expect(dbUser!.status).toBe('Pending');
  });

  it('AT1.2 — 201: fires sendVerificationEmail with correct args', async () => {
    await registerUser();

    expect(mockSendVerificationEmail).toHaveBeenCalledOnce();
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      VALID_USER.email,
      VALID_USER.name,
      expect.any(String), // verification token (32-byte hex)
    );
  });

  it('AT1.3 — 201: does not expose passwordHash in response', async () => {
    const res = await registerUser();
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('password');
  });

  it('AT1.4 — 409: duplicate email returns EMAIL_TAKEN', async () => {
    await registerUser();
    const res = await registerUser(); // same email
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('AT1.5 — 400: invalid email format', async () => {
    const res = await registerUser({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AT1.6 — 400: password missing uppercase letter', async () => {
    const res = await registerUser({ password: 'password123!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AT1.7 — 400: password missing number', async () => {
    const res = await registerUser({ password: 'Password!!!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AT1.8 — 400: password too short (< 8 chars)', async () => {
    const res = await registerUser({ password: 'Pass1!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AT1.9 — 400: name too short (< 2 chars)', async () => {
    const res = await registerUser({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AT1.10 — 400: missing required fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AT2 — POST /api/v1/auth/verify-email
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/verify-email', () => {
  it('AT2.1 — 200: activates user (isVerified=true, status=Active)', async () => {
    await registerUser();
    const token = await getVerificationToken(VALID_USER.email);

    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dbUser = await UserModel.findOne({ email: VALID_USER.email }).lean();
    expect(dbUser!.isVerified).toBe(true);
    expect(dbUser!.status).toBe('Active');
  });

  it('AT2.2 — 200: clears the verification token fields after use', async () => {
    await registerUser();
    const token = await getVerificationToken(VALID_USER.email);
    await request(app).post('/api/v1/auth/verify-email').send({ token });

    const dbUser = await UserModel.findOne({ email: VALID_USER.email })
      .select('+emailVerificationToken +emailVerificationExpires')
      .lean();
    expect(dbUser!.emailVerificationToken).toBeUndefined();
    expect(dbUser!.emailVerificationExpires).toBeUndefined();
  });

  it('AT2.3 — 400: invalid / non-existent token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: 'invalid-hex-token-that-does-not-match-any-user' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_VERIFICATION_TOKEN');
  });

  it('AT2.4 — 400: missing token in body', async () => {
    const res = await request(app).post('/api/v1/auth/verify-email').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AT2.5 — 400: same token cannot be used twice', async () => {
    await registerUser();
    const token = await getVerificationToken(VALID_USER.email);

    // First use — succeeds
    await request(app).post('/api/v1/auth/verify-email').send({ token });

    // Second use — token cleared, should fail
    const res = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_VERIFICATION_TOKEN');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AT3 — POST /api/v1/auth/login
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/login', () => {
  it('AT3.1 — 200: sets HttpOnly accessToken and refreshToken cookies', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('AT3.2 — 200: accessToken cookie is HttpOnly + SameSite=Strict', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='))!;
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie.toLowerCase()).toContain('samesite=strict');
  });

  it('AT3.3 — 200: refreshToken cookie is path-restricted to /api/v1/auth/refresh', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;
    expect(refreshCookie).toContain('Path=/api/v1/auth/refresh');
  });

  it('AT3.4 — 200: returns user object and empty organizations array (no orgs yet)', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.body.data.user).toMatchObject({
      email: VALID_USER.email,
      name: VALID_USER.name,
      isVerified: true,
      status: 'Active',
    });
    expect(Array.isArray(res.body.data.organizations)).toBe(true);
  });

  it('AT3.5 — 200: does not expose passwordHash in response body', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('AT3.6 — 200: persists refresh tokenId in Redis', async () => {
    await registerAndVerify();
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    const hasRefreshKey = [...redisStore.keys()].some((k) => k.startsWith('refresh:'));
    expect(hasRefreshKey).toBe(true);
  });

  it('AT3.7 — 401: wrong password', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: 'WrongPassword999!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('AT3.8 — 401: non-existent email (anti-enumeration: same response as wrong password)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@nowhere.com', password: VALID_USER.password });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('AT3.9 — 401: unverified account returns EMAIL_NOT_VERIFIED', async () => {
    await registerUser(); // NOT verified
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('AT3.10 — 400: missing password field', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email });
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AT4 — POST /api/v1/auth/refresh
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/refresh', () => {
  it('AT4.1 — 200: issues new access + refresh token pair', async () => {
    const cookies = await registerVerifyAndLogin();
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const newCookies = res.headers['set-cookie'] as unknown as string[];
    expect(newCookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(newCookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('AT4.2 — 401: replaying old refresh token after rotation fails (REFRESH_TOKEN_REVOKED)', async () => {
    const cookies = await registerVerifyAndLogin();
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;

    // Use refresh once — rotates tokenId in Redis
    await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie);

    // Replay the same (now-stale) refresh token
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('AT4.3 — 401: no refresh token cookie returns NO_REFRESH_TOKEN', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_REFRESH_TOKEN');
  });

  it('AT4.4 — 401: malformed / invalid JWT returns INVALID_REFRESH_TOKEN', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=definitely.not.valid.jwt');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AT5 — GET /api/v1/auth/me
// ═════════════════════════════════════════════════════════════════════════════
describe('GET /api/v1/auth/me', () => {
  it('AT5.1 — 200: returns user data + organizations array', async () => {
    const cookies = await registerVerifyAndLogin();
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='))!;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', accessCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(VALID_USER.email);
    expect(res.body.data.name).toBe(VALID_USER.name);
    expect(res.body.data.isVerified).toBe(true);
    expect(res.body.data.status).toBe('Active');
    expect(Array.isArray(res.body.data.organizations)).toBe(true);
  });

  it('AT5.2 — 200: does not expose passwordHash in response', async () => {
    const cookies = await registerVerifyAndLogin();
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='))!;

    const res = await request(app).get('/api/v1/auth/me').set('Cookie', accessCookie);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('AT5.3 — 401: no accessToken cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('AT5.4 — 401: invalid / malformed access token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'accessToken=this.is.garbage');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AT6 — POST /api/v1/auth/logout
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/logout', () => {
  it('AT6.1 — 200: deletes Redis refresh key on logout', async () => {
    const cookies = await registerVerifyAndLogin();
    const cookieHeader = cookies.join('; ');

    // Redis should have the session before logout
    expect([...redisStore.keys()].some((k) => k.startsWith('refresh:'))).toBe(true);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect([...redisStore.keys()].some((k) => k.startsWith('refresh:'))).toBe(false);
  });

  it('AT6.2 — 401: old refresh token rejected after logout (REFRESH_TOKEN_REVOKED)', async () => {
    const cookies = await registerVerifyAndLogin();
    const cookieHeader = cookies.join('; ');
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='))!;

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookieHeader);

    // The refresh token's tokenId no longer exists in Redis
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('AT6.3 — 401: calling logout without a valid cookie is rejected by authenticate middleware', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AT7 — POST /api/v1/auth/forgot-password
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/forgot-password', () => {
  const EXPECTED_MSG =
    'If an account exists with this email, you will receive a password reset link shortly.';

  it('AT7.1 — 200: returns safe message for valid registered email', async () => {
    await registerAndVerify();
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: VALID_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe(EXPECTED_MSG);
  });

  it('AT7.2 — 200: returns IDENTICAL message for non-existent email (anti-enumeration)', async () => {
    await registerAndVerify();

    const existingRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: VALID_USER.email });

    const ghostRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@nowhere.com' });

    expect(existingRes.status).toBe(200);
    expect(ghostRes.status).toBe(200);
    expect(existingRes.body.data.message).toBe(ghostRes.body.data.message);
  });

  it('AT7.3 — sends reset email for valid account, skips for non-existent email', async () => {
    await registerAndVerify();

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: VALID_USER.email });
    expect(mockSendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      VALID_USER.email,
      VALID_USER.name,
      expect.any(String),
    );

    vi.clearAllMocks();
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@nowhere.com' });
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('AT7.4 — 400: invalid email format fails validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AT8 — POST /api/v1/auth/reset-password
// ═════════════════════════════════════════════════════════════════════════════
describe('POST /api/v1/auth/reset-password', () => {
  /**
   * Helper: register + verify + trigger forgot-password, then capture the raw
   * reset token from the mocked email call (arg index 2).
   */
  async function setupResetToken(): Promise<string> {
    await registerAndVerify();
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: VALID_USER.email });
    // sendPasswordResetEmail(email, name, rawToken) — rawToken is arg[2]
    return mockSendPasswordResetEmail.mock.calls[0][2] as string;
  }

  const NEW_PASSWORD = 'NewPassword456!';

  it('AT8.1 — 200: changes password with a valid token', async () => {
    const rawToken = await setupResetToken();

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('AT8.2 — 200: new password works for subsequent login', async () => {
    const rawToken = await setupResetToken();
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: NEW_PASSWORD });

    expect(loginRes.status).toBe(200);
  });

  it('AT8.3 — 401: old password no longer works after reset', async () => {
    const rawToken = await setupResetToken();
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password }); // original pw

    expect(loginRes.status).toBe(401);
  });

  it('AT8.4 — 400: invalid / non-existent token returns INVALID_RESET_TOKEN', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'fake-token-000', password: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_RESET_TOKEN');
  });

  it('AT8.5 — 400: token cannot be reused after successful reset', async () => {
    const rawToken = await setupResetToken();
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: 'AnotherPassword789!' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_RESET_TOKEN');
  });

  it('AT8.6 — 400: new password fails strength validation', async () => {
    const rawToken = await setupResetToken();

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: 'weakpassword' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('AT8.7 — 200: reset invalidates active refresh session in Redis', async () => {
    const rawToken = await setupResetToken();

    // Login to create a session in Redis
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect([...redisStore.keys()].some((k) => k.startsWith('refresh:'))).toBe(true);

    // Reset password — should call redis.del on the session key
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: NEW_PASSWORD });

    expect([...redisStore.keys()].some((k) => k.startsWith('refresh:'))).toBe(false);
  });
});
