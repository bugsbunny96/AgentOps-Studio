/**
 * L2.F2.M3 — Auth E2E Flow Tests
 * Atomic Tasks: AT1 (full auth flow), AT2 (forgot-password flow)
 *
 * There is NO backend running in Playwright E2E — only the frontend dev server.
 * Every API call is intercepted with page.route() and served from mock fixtures.
 *
 * Interceptor note: the axios interceptor in @/utils/api retries any 401 response
 * by calling POST /auth/refresh before re-throwing. Tests that start in the
 * "unauthenticated" state must mock POST /auth/refresh → 401 so the interceptor
 * fails fast and does not hang waiting for a backend that isn't running.
 *
 * Route matching: requests go to /api/v1/... (proxied by Vite). The pattern
 * '**/api/v1/**' matches both http://localhost:5173/api/v1/... and any proxied form.
 *
 * Guard behaviour recap:
 *   GuestGuard  — calls verifySession() on mount; redirects to /dashboard if authenticated
 *   AuthGuard   — calls verifySession() on mount; redirects to /login   if NOT authenticated
 *   login() in useAuth — navigates to /onboarding when organizations[] is empty
 */

import { test, expect, type Route } from '@playwright/test';

// ─── Shared mock fixtures ─────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user-e2e-001',
  name: 'E2E User',
  email: 'e2e@example.com',
  isVerified: true,
  status: 'Active',
};

/** Fulfils any route with a JSON body */
async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** GET /auth/me → 401 + POST /auth/refresh → 401 (safe unauthenticated base state) */
async function mockUnauthenticated(page: ReturnType<typeof test['info']> extends never ? never : Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.route('**/api/v1/auth/me', (r) =>
    json(r, 401, { success: false, code: 'UNAUTHORIZED', message: 'Not authenticated' }),
  );
  await page.route('**/api/v1/auth/refresh', (r) =>
    json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN', message: 'No refresh token' }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AT1 — Register → inbox success screen → login → /onboarding/connect
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('AT1 — Full auth flow: register → login → onboarding', () => {
  /**
   * AT1.1 — Happy path
   * 1. Visit /register  (GuestGuard calls verifySession → 401 → shows register form)
   * 2. Fill and submit registration form
   * 3. Server returns 201 → success screen "Check your inbox"
   * 4. Click "Back to sign in" → /login
   * 5. Fill login form; server returns 200 with empty organizations[]
   * 6. useAuth.login() navigates to /onboarding → /onboarding/connect
   * 7. AuthGuard calls verifySession → 200 (sessionState flipped by login mock)
   * 8. ConnectPage heading "Connect your business" is visible
   */
  test('AT1.1 — happy path: register → inbox → login → /onboarding/connect', async ({ page }) => {
    // Closure variable so GET /auth/me can return 200 after login fires
    let sessionState: 'unauthenticated' | 'authenticated' = 'unauthenticated';

    // GET /auth/me: dynamic based on sessionState
    await page.route('**/api/v1/auth/me', (route) => {
      if (sessionState === 'authenticated') {
        return json(route, 200, {
          success: true,
          data: { ...MOCK_USER, organizations: [] },
        });
      }
      return json(route, 401, {
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    });

    // POST /auth/refresh: always 401 (no real session cookies)
    await page.route('**/api/v1/auth/refresh', (r) =>
      json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
    );

    // POST /auth/register: returns 201 Created
    await page.route('**/api/v1/auth/register', (r) =>
      json(r, 201, {
        success: true,
        data: {
          id: MOCK_USER.id,
          name: MOCK_USER.name,
          email: MOCK_USER.email,
          isVerified: false,
          status: 'Pending',
        },
        message: 'Account created. Please check your email to verify your account.',
      }),
    );

    // POST /auth/login: flips sessionState then returns 200 with no orgs
    await page.route('**/api/v1/auth/login', (route) => {
      sessionState = 'authenticated';
      return json(route, 200, {
        success: true,
        data: {
          user: MOCK_USER,
          organizations: [], // triggers navigation to /onboarding
        },
      });
    });

    // ── Step 1: visit /register ──────────────────────────────────────────────
    await page.goto('/register');

    // Wait for GuestGuard's verifySession to resolve before the form renders
    await page.waitForSelector('#name', { state: 'visible' });
    await expect(page.locator('h1')).toHaveText('Create your account');

    // ── Step 2: fill and submit registration form ────────────────────────────
    await page.locator('#name').fill('E2E User');
    await page.locator('#reg-email').fill(MOCK_USER.email);
    await page.locator('#reg-password').fill('Password123!');
    await page.locator('#confirmPassword').fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    // ── Step 3: success screen ───────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    await expect(
      page.getByText(/We.ve sent a verification email/),
    ).toBeVisible();

    // ── Step 4: navigate to /login via "Back to sign in" button ─────────────
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/login/);

    // ── Step 5: login page renders ───────────────────────────────────────────
    await page.waitForSelector('#email', { state: 'visible' });
    await expect(page.locator('h1')).toHaveText('Welcome back');

    // ── Step 6: fill and submit login form ───────────────────────────────────
    await page.locator('#email').fill(MOCK_USER.email);
    await page.locator('#password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // ── Step 7 + 8: assert redirection to /onboarding/connect ────────────────
    await expect(page).toHaveURL(/\/onboarding\/connect/, { timeout: 8000 });
    await expect(page.getByRole('heading', { name: 'Connect your business' })).toBeVisible();

    // Onboarding layout: step indicators rendered
    await expect(page.getByText('AgentOps Studio')).toBeVisible();
    await expect(page.getByText('Connect')).toBeVisible();
  });

  /**
   * AT1.2 — Duplicate email → server error displayed
   * Server returns 409 EMAIL_TAKEN → RegisterPage shows inline error.
   */
  test('AT1.2 — duplicate email shows "already exists" server error', async ({ page }) => {
    await mockUnauthenticated(page);

    await page.route('**/api/v1/auth/register', (r) =>
      json(r, 409, {
        success: false,
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists.',
      }),
    );

    await page.goto('/register');
    await page.waitForSelector('#name', { state: 'visible' });

    await page.locator('#name').fill('E2E User');
    await page.locator('#reg-email').fill('taken@example.com');
    await page.locator('#reg-password').fill('Password123!');
    await page.locator('#confirmPassword').fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    // RegisterPage maps EMAIL_TAKEN → custom message
    await expect(
      page.getByText('An account with this email already exists. Try signing in.'),
    ).toBeVisible();

    // Must NOT show the success screen
    await expect(page.getByText('Check your inbox')).not.toBeVisible();
  });

  /**
   * AT1.3 — Password mismatch → Zod client-side error, no API call made
   */
  test('AT1.3 — password mismatch shows client-side validation error', async ({ page }) => {
    await mockUnauthenticated(page);

    // We assert the register API is never called
    let registerCalled = false;
    await page.route('**/api/v1/auth/register', (r) => {
      registerCalled = true;
      return json(r, 201, { success: true });
    });

    await page.goto('/register');
    await page.waitForSelector('#name', { state: 'visible' });

    await page.locator('#name').fill('E2E User');
    await page.locator('#reg-email').fill('e2e@example.com');
    await page.locator('#reg-password').fill('Password123!');
    await page.locator('#confirmPassword').fill('DifferentPass456!'); // mismatch
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
    expect(registerCalled).toBe(false);
  });

  /**
   * AT1.4 — Short name → Zod client-side validation error
   */
  test('AT1.4 — name too short shows client-side validation error', async ({ page }) => {
    await mockUnauthenticated(page);

    let registerCalled = false;
    await page.route('**/api/v1/auth/register', () => { registerCalled = true; });

    await page.goto('/register');
    await page.waitForSelector('#name', { state: 'visible' });

    await page.locator('#name').fill('A'); // too short (<2 chars)
    await page.locator('#reg-email').fill('e2e@example.com');
    await page.locator('#reg-password').fill('Password123!');
    await page.locator('#confirmPassword').fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();
    expect(registerCalled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AT1 sub — Login error states (tested via /login directly)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('AT1 sub — Login error states', () => {
  /**
   * AT1.5 — Wrong credentials → INVALID_CREDENTIALS error message
   * LoginPage shows the message from the server response.
   */
  test('AT1.5 — wrong credentials shows error message', async ({ page }) => {
    await mockUnauthenticated(page);

    await page.route('**/api/v1/auth/login', (r) =>
      json(r, 401, {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      }),
    );

    await page.goto('/login');
    await page.waitForSelector('#email', { state: 'visible' });

    await page.locator('#email').fill('wrong@example.com');
    await page.locator('#password').fill('WrongPass123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email or password.')).toBeVisible();
  });

  /**
   * AT1.6 — Unverified email → EMAIL_NOT_VERIFIED message
   * LoginPage maps this code to a specific UX message.
   */
  test('AT1.6 — unverified email shows EMAIL_NOT_VERIFIED message', async ({ page }) => {
    await mockUnauthenticated(page);

    await page.route('**/api/v1/auth/login', (r) =>
      json(r, 403, {
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email not verified.',
      }),
    );

    await page.goto('/login');
    await page.waitForSelector('#email', { state: 'visible' });

    await page.locator('#email').fill('unverified@example.com');
    await page.locator('#password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
      page.getByText('Please verify your email before signing in. Check your inbox.'),
    ).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AT2 — Forgot-password flow
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('AT2 — Forgot-password flow', () => {
  /**
   * AT2.1 — Happy path
   * 1. Visit /forgot-password
   * 2. Fill email and submit
   * 3. Server returns 200 (anti-enumeration safe message)
   * 4. Success state renders: "Check your email" heading, submitted email in text,
   *    "expires in 1 hour" copy, and "← Back to sign in" link
   */
  test('AT2.1 — happy path: form → success state with email and expiry', async ({ page }) => {
    const TEST_EMAIL = 'user@example.com';

    await mockUnauthenticated(page);

    await page.route('**/api/v1/auth/forgot-password', (r) =>
      json(r, 200, {
        success: true,
        data: {
          message:
            'If an account exists with this email, you will receive a password reset link shortly.',
        },
      }),
    );

    await page.goto('/forgot-password');
    await page.waitForSelector('#forgot-email', { state: 'visible' });
    await expect(page.locator('h1')).toHaveText('Reset password');

    // Submit the form
    await page.locator('#forgot-email').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Send reset link' }).click();

    // Success state assertions
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    // ForgotPasswordPage success copy:
    // "If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly. It expires in 1 hour."
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
    await expect(page.getByText(/expires in 1 hour/i)).toBeVisible();

    // "← Back to sign in" link present
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible();
  });

  /**
   * AT2.2 — "← Back to sign in" link navigates to /login
   */
  test('AT2.2 — success state "Back to sign in" link navigates to /login', async ({ page }) => {
    await mockUnauthenticated(page);

    await page.route('**/api/v1/auth/forgot-password', (r) =>
      json(r, 200, {
        success: true,
        data: { message: 'If an account exists with this email, you will receive a password reset link shortly.' },
      }),
    );

    await page.goto('/forgot-password');
    await page.waitForSelector('#forgot-email', { state: 'visible' });

    await page.locator('#forgot-email').fill('any@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    // Click link and assert navigation
    await page.getByRole('link', { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toHaveText('Welcome back');
  });

  /**
   * AT2.3 — Invalid email → Zod client-side validation, no API call
   */
  test('AT2.3 — invalid email format shows client-side validation error', async ({ page }) => {
    await mockUnauthenticated(page);

    let forgotCalled = false;
    await page.route('**/api/v1/auth/forgot-password', () => { forgotCalled = true; });

    await page.goto('/forgot-password');
    await page.waitForSelector('#forgot-email', { state: 'visible' });

    await page.locator('#forgot-email').fill('not-an-email');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    expect(forgotCalled).toBe(false);
  });

  /**
   * AT2.4 — Empty submit → Zod client-side validation, no API call
   */
  test('AT2.4 — empty email submit shows validation error', async ({ page }) => {
    await mockUnauthenticated(page);

    let forgotCalled = false;
    await page.route('**/api/v1/auth/forgot-password', () => { forgotCalled = true; });

    await page.goto('/forgot-password');
    await page.waitForSelector('#forgot-email', { state: 'visible' });

    // Submit without filling any field
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    expect(forgotCalled).toBe(false);
  });

  /**
   * AT2.5 — Pre-form "← Back to sign in" link (not the success-state one) also navigates
   * The ForgotPasswordPage renders a back link both in the form view AND the success state.
   */
  test('AT2.5 — pre-submission "Back to sign in" link navigates to /login', async ({ page }) => {
    await mockUnauthenticated(page);

    await page.goto('/forgot-password');
    await page.waitForSelector('#forgot-email', { state: 'visible' });

    await page.getByRole('link', { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Guard behaviour: GuestGuard redirect when already authenticated
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('GuestGuard — redirects authenticated users', () => {
  /**
   * AT1.7 — Visiting /register while authenticated redirects to /dashboard.
   * GuestGuard sees verifySession → 200 → isAuthenticated=true → navigate('/dashboard').
   * No org with COMPLETED status → OrgGuard redirects to /onboarding.
   * (We mock GET /auth/me with an org that has onboardingStatus COMPLETED to reach /dashboard.)
   */
  test('AT1.7 — authenticated user visiting /register is redirected to /dashboard', async ({ page }) => {
    // Mock GET /auth/me → 200 with a COMPLETED org (so AuthGuard+OrgGuard allow /dashboard)
    await page.route('**/api/v1/auth/me', (r) =>
      json(r, 200, {
        success: true,
        data: {
          ...MOCK_USER,
          organizations: [
            {
              id: 'org-001',
              name: 'E2E Corp',
              onboardingStatus: 'COMPLETED',
            },
          ],
        },
      }),
    );
    await page.route('**/api/v1/auth/refresh', (r) =>
      json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
    );

    await page.goto('/register');

    // GuestGuard should redirect away from /register
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  });
});
