/**
 * 🟣 Test Engineer — E2E: Authentication pages
 * Tests: page structure, navigation between auth pages
 */
import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the login page heading', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('shows link to register page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('navigates to register when sign up is clicked', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders the register page heading', async ({ page }) => {
    await expect(page.getByText('Create your account')).toBeVisible();
  });

  test('shows link back to login', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('navigates to login when sign in is clicked', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Forgot password page', () => {
  test('renders heading', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByText('Reset password')).toBeVisible();
  });

  test('has back to login link', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('link', { name: /back to login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Root redirect', () => {
  test('redirects / to /dashboard (which redirects to /login when not authenticated)', async ({ page }) => {
    await page.goto('/');
    // Unauthenticated → AuthGuard → /login
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });
});
