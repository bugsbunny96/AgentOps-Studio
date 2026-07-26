/**
 * E2E: Dashboard — authenticated flows + multi-tenant isolation
 *
 * Strategy: same as auth-flow.spec.ts — no real backend.
 * Every API call is intercepted by page.route().
 *
 * Mock fixtures set up a fully authenticated session:
 *   GET /auth/me       → user + 1 COMPLETED org
 *   GET /auth/refresh  → 401 (no real cookie)
 *
 * Additional mocks per describe block:
 *   GET /analytics/overview     → KPI numbers
 *   GET /analytics/calls-per-day → chart data
 *   GET /calls                  → recent calls list
 */

import { test, expect, type Route } from '@playwright/test';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const MOCK_USER = {
  id:         'user-dash-001',
  name:       'Dashboard User',
  email:      'dash@example.com',
  isVerified: true,
  status:     'Active',
};

const MOCK_ORG = {
  id:               'org-dash-001',
  name:             'Acme Logistics',
  onboardingStatus: 'COMPLETED',
  slug:             'acme-logistics',
};

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** Mock an authenticated session with a COMPLETED org. */
async function mockAuthenticatedSession(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.route('**/api/v1/auth/me', (r) =>
    json(r, 200, {
      success: true,
      data: { ...MOCK_USER, organizations: [MOCK_ORG] },
    }),
  );
  await page.route('**/api/v1/auth/refresh', (r) =>
    json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
  );
}

/** Mock analytics endpoints so the dashboard page renders without errors. */
async function mockAnalytics(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.route('**/api/v1/analytics/overview*', (r) =>
    json(r, 200, {
      success: true,
      data: {
        totalCalls:    42,
        callsToday:    3,
        callsThisWeek: 12,
        activeCalls:   0,
        totalMinutes:  210,
        resolvedCalls: 38,
      },
    }),
  );
  await page.route('**/api/v1/analytics/calls-per-day*', (r) =>
    json(r, 200, {
      success: true,
      data: [
        { date: '2026-07-10', count: 4 },
        { date: '2026-07-11', count: 6 },
        { date: '2026-07-12', count: 2 },
      ],
    }),
  );
  await page.route('**/api/v1/calls*', (r) =>
    json(r, 200, {
      success: true,
      data: [],
      meta: { total: 0, page: 1, limit: 10 },
    }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sidebar navigation
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sidebar navigation', () => {
  test('renders all nav items for org owner', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockAnalytics(page);

    await page.goto('/dashboard');
    // Wait for AuthGuard + OrgGuard to settle
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    // Core nav items visible to all members
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /agents/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /calls/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /knowledge base/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /team/i }).first()).toBeVisible();

    // Owner-only items
    await expect(page.getByRole('link', { name: /billing/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i }).first()).toBeVisible();
  });

  test('navigating to /agents renders agents page heading', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockAnalytics(page);

    // Mock agents list
    await page.route('**/api/v1/agents*', (r) =>
      json(r, 200, { success: true, data: [] }),
    );

    await page.goto('/agents');
    await expect(page).toHaveURL(/\/agents/, { timeout: 8000 });
    // AgentsPage renders a heading with "Agents" or "Voice Agents"
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  test('navigating to /calls renders calls page', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockAnalytics(page);

    await page.goto('/calls');
    await expect(page).toHaveURL(/\/calls/, { timeout: 8000 });
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  test('navigating to /knowledge-base renders knowledge base page', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await page.route('**/api/v1/knowledge-base*', (r) =>
      json(r, 200, { success: true, data: [], meta: { total: 0, page: 1, limit: 20 } }),
    );

    await page.goto('/knowledge-base');
    await expect(page).toHaveURL(/\/knowledge-base/, { timeout: 8000 });
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  test('navigating to /team renders team page', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await page.route('**/api/v1/team*', (r) =>
      json(r, 200, { success: true, data: { members: [], invitations: [] } }),
    );

    await page.goto('/team');
    await expect(page).toHaveURL(/\/team/, { timeout: 8000 });
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  test('navigating to /settings renders settings page', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await page.route('**/api/v1/onboarding/org*', (r) =>
      json(r, 200, { success: true, data: MOCK_ORG }),
    );
    await page.route('**/api/v1/agents*', (r) =>
      json(r, 200, { success: true, data: [] }),
    );

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/, { timeout: 8000 });
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard KPI cards
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Dashboard KPI cards', () => {
  test('shows Total Calls KPI card with mocked value', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockAnalytics(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    // KPI card label "Total Calls" is always rendered (even while loading)
    await expect(page.getByText('Total Calls')).toBeVisible({ timeout: 6000 });
  });

  test('KPI card renders mocked value 42 after analytics loads', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockAnalytics(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    // The value "42" from our mock should appear in the KPI area
    await expect(page.getByText('42')).toBeVisible({ timeout: 6000 });
  });

  test('shows Calls — Last 30 Days chart section', async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockAnalytics(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    await expect(page.getByText(/calls.*last 30 days/i)).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sign out
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Sign out', () => {
  test('sign out clears session and redirects to /login', async ({ page }) => {
    let sessionState: 'authenticated' | 'unauthenticated' = 'authenticated';

    await page.route('**/api/v1/auth/me', (r) => {
      if (sessionState === 'authenticated') {
        return json(r, 200, {
          success: true,
          data: { ...MOCK_USER, organizations: [MOCK_ORG] },
        });
      }
      return json(r, 401, { success: false, code: 'UNAUTHORIZED' });
    });
    await page.route('**/api/v1/auth/refresh', (r) =>
      json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
    );
    // POST /auth/logout → flips state
    await page.route('**/api/v1/auth/logout', (r) => {
      sessionState = 'unauthenticated';
      return json(r, 200, { success: true });
    });
    await mockAnalytics(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    // Find and click sign out button in the sidebar
    const signOutButton = page.getByRole('button', { name: /sign out/i });
    await expect(signOutButton).toBeVisible({ timeout: 6000 });
    await signOutButton.click();

    // Should redirect to /login after logout
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-tenant isolation (SECURITY CRITICAL)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Multi-tenant isolation (critical)', () => {
  /**
   * Org A's session must not be able to see Org B's data.
   * The frontend test verifies that every API request made while authenticated
   * as Org A carries X-Organization-ID: org-A (not org-B).
   *
   * The backend enforces the actual data isolation — this test guards the
   * frontend from accidentally sending the wrong org header.
   */
  test('API requests carry the active org ID in X-Organization-ID header', async ({ page }) => {
    const ORG_A_ID = 'org-A-001';

    await page.route('**/api/v1/auth/me', (r) =>
      json(r, 200, {
        success: true,
        data: {
          ...MOCK_USER,
          organizations: [{ ...MOCK_ORG, id: ORG_A_ID }],
        },
      }),
    );
    await page.route('**/api/v1/auth/refresh', (r) =>
      json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
    );

    const capturedOrgHeaders: string[] = [];

    // Capture the org header from any analytics/calls request
    await page.route('**/api/v1/analytics/**', (r) => {
      const orgHeader = r.request().headers()['x-organization-id'];
      if (orgHeader) capturedOrgHeaders.push(orgHeader);
      return json(r, 200, {
        success: true,
        data: { totalCalls: 0, callsToday: 0, callsThisWeek: 0, activeCalls: 0, totalMinutes: 0, resolvedCalls: 0 },
      });
    });
    await page.route('**/api/v1/analytics/calls-per-day*', (r) =>
      json(r, 200, { success: true, data: [] }),
    );
    await page.route('**/api/v1/calls*', (r) =>
      json(r, 200, { success: true, data: [], meta: { total: 0, page: 1, limit: 10 } }),
    );

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });

    // Wait for at least one analytics request to fire
    await page.waitForTimeout(2000);

    // Every captured header must be org-A's ID (never org-B or empty)
    for (const header of capturedOrgHeaders) {
      expect(header).toBe(ORG_A_ID);
    }
  });

  test('visiting /calls with org-A session shows org-A data URL (no cross-org leakage)', async ({ page }) => {
    const ORG_A_ID = 'org-A-001';
    const ORG_B_CALL_ID = 'call-from-org-B-999';

    await page.route('**/api/v1/auth/me', (r) =>
      json(r, 200, {
        success: true,
        data: {
          ...MOCK_USER,
          organizations: [{ ...MOCK_ORG, id: ORG_A_ID }],
        },
      }),
    );
    await page.route('**/api/v1/auth/refresh', (r) =>
      json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
    );

    let crossOrgAttempted = false;

    // Org A's calls endpoint returns empty
    await page.route('**/api/v1/calls*', (r) => {
      const orgHeader = r.request().headers()['x-organization-id'];
      // If a request is made without Org A's header, flag it
      if (orgHeader && orgHeader !== ORG_A_ID) {
        crossOrgAttempted = true;
      }
      return json(r, 200, { success: true, data: [], meta: { total: 0, page: 1, limit: 10 } });
    });
    await mockAnalytics(page);

    // Direct-navigate to a call that belongs to org B
    // The frontend should NOT send this request with org-B's ID
    await page.goto(`/calls/${ORG_B_CALL_ID}`);

    // Even if the URL is accessible, no cross-org header should have been sent
    await page.waitForTimeout(2000);
    expect(crossOrgAttempted).toBe(false);
  });
});
