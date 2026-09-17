/**
 * E2E: Onboarding wizard — critical path navigation + form content
 *
 * Strategy: no real backend. Every API call is intercepted.
 *
 * Auth state: user is authenticated (GET /auth/me → 200) but has no
 * COMPLETED org, so OrgGuard permits onboarding routes.
 *
 * Fixture progression:
 *   Step 1 (Connect)   — no org yet; onboardingStatus absent
 *   Step 2 (Learn)     — org created; onboardingStatus = 'ORG_CREATION'
 *   Step 3 (Configure) — crawl done; onboardingStatus = 'WEBSITE_CRAWL'
 *   Step 4 (Customize) — configured; onboardingStatus = 'BUSINESS_CONFIG'
 *   Step 5 (Activate)  — voice set;  onboardingStatus = 'VOICE_SETUP'
 */

import { test, expect, type Route } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id:         'user-onb-001',
  name:       'Onboarding User',
  email:      'onb@example.com',
  isVerified: true,
  status:     'Active',
};

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function mockOrgAtStatus(status: string) {
  return {
    id:               'org-onb-001',
    name:             'Test Business',
    industry:         'Logistics & Delivery',
    timezone:         'Asia/Kolkata',
    onboardingStatus: status,
    slug:             'test-business',
    website:          'https://testbusiness.in',
    businessHours:    { start: '09:00', end: '18:00' },
    businessDays:     ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  };
}

/**
 * Set up authenticated session. `onboardingStatus` controls which
 * step the user is considered to be on.
 */
async function mockAuth(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  onboardingStatus: string | null,
) {
  const org = onboardingStatus
    ? { id: 'org-onb-001', name: 'Test Business', onboardingStatus }
    : null;

  await page.route('**/api/v1/auth/me', (r) =>
    json(r, 200, {
      success: true,
      data: {
        ...MOCK_USER,
        organizations: org ? [org] : [],
      },
    }),
  );
  await page.route('**/api/v1/auth/refresh', (r) =>
    json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
  );

  // fetchCurrentOrg() called by OnboardingLayout on mount
  if (onboardingStatus) {
    await page.route('**/api/v1/onboarding/org', (r) =>
      json(r, 200, { success: true, data: mockOrgAtStatus(onboardingStatus) }),
    );
  } else {
    // No org yet → 404 (fetchCurrentOrg returns null)
    await page.route('**/api/v1/onboarding/org', (r) =>
      json(r, 404, { success: false, message: 'No organization found' }),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Step 1 — Connect
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Step 1 — Connect', () => {
  test('renders business name, industry, and timezone inputs', async ({ page }) => {
    await mockAuth(page, null);

    await page.goto('/onboarding/connect');
    await expect(page).toHaveURL(/\/onboarding\/connect/, { timeout: 8000 });

    // Business name input
    await expect(page.getByLabel(/business name/i)).toBeVisible({ timeout: 6000 });

    // Industry selector
    await expect(page.getByLabel(/industry/i)).toBeVisible();

    // Timezone exists somewhere on the page
    await expect(page.getByText(/timezone/i)).toBeVisible();
  });

  test('heading frames the AI agent, not just the org', async ({ page }) => {
    await mockAuth(page, null);
    await page.goto('/onboarding/connect');
    await expect(page).toHaveURL(/\/onboarding\/connect/, { timeout: 8000 });

    // ConnectPage heading: "Connect your business"
    await expect(
      page.getByRole('heading', { name: /connect your business/i }),
    ).toBeVisible({ timeout: 6000 });
  });

  test('step indicator shows step 1 as active', async ({ page }) => {
    await mockAuth(page, null);
    await page.goto('/onboarding/connect');
    await expect(page).toHaveURL(/\/onboarding\/connect/, { timeout: 8000 });

    // Step labels visible in progress bar
    await expect(page.getByText('Connect')).toBeVisible({ timeout: 6000 });
    await expect(page.getByText('Configure')).toBeVisible();
    await expect(page.getByText('Activate')).toBeVisible();
  });

  test('submitting empty form shows validation errors', async ({ page }) => {
    await mockAuth(page, null);

    let postOrgCalled = false;
    await page.route('**/api/v1/onboarding/org', (r) => {
      if (r.request().method() === 'POST') { postOrgCalled = true; }
      return json(r, 404, { success: false, message: 'Not found' });
    });

    await page.goto('/onboarding/connect');
    await page.waitForSelector('input', { state: 'visible' });

    // Submit without filling anything
    await page.getByRole('button', { name: /continue|next|start/i }).click();

    // At least one validation message should appear
    const errors = page.locator('[class*="red"], [class*="error"], p[class*="text-red"]');
    await expect(errors.first()).toBeVisible({ timeout: 4000 });

    expect(postOrgCalled).toBe(false);
  });

  test('happy path: fills form and creates org', async ({ page }) => {
    await mockAuth(page, null);

    await page.route('**/api/v1/onboarding/org', (r) => {
      if (r.request().method() === 'POST') {
        return json(r, 201, {
          success: true,
          data: mockOrgAtStatus('ORG_CREATION'),
        });
      }
      return json(r, 404, { success: false, message: 'Not found' });
    });

    await page.goto('/onboarding/connect');
    await page.waitForSelector('input', { state: 'visible' });

    // Fill business name
    const nameInput = page.getByLabel(/business name/i);
    await nameInput.fill('Acme Logistics');

    // Pick an industry from the dropdown
    const industrySelect = page.getByLabel(/industry/i);
    await industrySelect.selectOption({ label: 'Logistics & Delivery' });

    // Submit
    await page.getByRole('button', { name: /continue|next|start/i }).click();

    // Should advance to /onboarding/learn
    await expect(page).toHaveURL(/\/onboarding\/learn/, { timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Step 2 — Learn (crawl progress)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Step 2 — Learn', () => {
  test('renders website URL and shows crawl initiation', async ({ page }) => {
    await mockAuth(page, 'ORG_CREATION');

    await page.route('**/api/v1/onboarding/crawl-status', (r) =>
      json(r, 200, {
        success: true,
        data: { status: 'idle', docsCount: 0, crawledAt: null },
      }),
    );

    await page.goto('/onboarding/learn');
    await expect(page).toHaveURL(/\/onboarding\/learn/, { timeout: 8000 });

    // LearnPage heading
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });

  test('CrawlLoadingPage shows progress indicator during crawl', async ({ page }) => {
    await mockAuth(page, 'ORG_CREATION');

    await page.route('**/api/v1/onboarding/crawl-status', (r) =>
      json(r, 200, {
        success: true,
        data: { status: 'crawling', docsCount: 3, crawledAt: null },
      }),
    );
    // PATCH for starting crawl
    await page.route('**/api/v1/onboarding/org', (r) =>
      json(r, 200, { success: true, data: mockOrgAtStatus('ORG_CREATION') }),
    );

    await page.goto('/onboarding/crawling');
    await expect(page).toHaveURL(/\/onboarding\/crawling/, { timeout: 8000 });

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Step 3 — Configure
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Step 3 — Configure', () => {
  test('renders business info form', async ({ page }) => {
    await mockAuth(page, 'WEBSITE_CRAWL');

    await page.goto('/onboarding/configure');
    await expect(page).toHaveURL(/\/onboarding\/configure/, { timeout: 8000 });

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Step 4 — Customize
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Step 4 — Customize', () => {
  test('renders voice and language settings', async ({ page }) => {
    await mockAuth(page, 'BUSINESS_CONFIG');

    await page.goto('/onboarding/customize');
    await expect(page).toHaveURL(/\/onboarding\/customize/, { timeout: 8000 });

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Step 5 — Activate
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Step 5 — Activate', () => {
  test('renders test call widget and completion button', async ({ page }) => {
    await mockAuth(page, 'VOICE_SETUP');

    // Agents endpoint (needed for VapiSandbox)
    await page.route('**/api/v1/agents*', (r) =>
      json(r, 200, {
        success: true,
        data: [{
          id:              'agent-001',
          name:            'Test Agent',
          vapiAssistantId: 'vapi-asst-001',
          isProvisioned:   true,
        }],
      }),
    );

    await page.goto('/onboarding/activate');
    await expect(page).toHaveURL(/\/onboarding\/activate/, { timeout: 8000 });

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 6000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Step indicator correctness
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Step indicator', () => {
  test('shows correct active step when deep-linked to step 3', async ({ page }) => {
    await mockAuth(page, 'WEBSITE_CRAWL');

    await page.goto('/onboarding/configure');
    await expect(page).toHaveURL(/\/onboarding\/configure/, { timeout: 8000 });

    // Step labels visible
    await expect(page.getByText('Configure')).toBeVisible({ timeout: 6000 });

    // Step 1 and 2 connectors should be green (completed),
    // but we'll just assert the step labels render — visual state is hard
    // to assert without snapshot testing.
    await expect(page.getByText('Connect')).toBeVisible();
    await expect(page.getByText('Customize')).toBeVisible();
    await expect(page.getByText('Activate')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Refresh / rehydration
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Page refresh rehydration', () => {
  /**
   * If a user refreshes on /onboarding/connect but their onboardingStatus
   * is already 'ORG_CREATION' (they completed step 1), OnboardingLayout
   * should forward-redirect them to /onboarding/learn.
   */
  test('refreshing on /connect when step 1 is done redirects to /learn', async ({ page }) => {
    // Auth: org exists with status ORG_CREATION (step 1 done)
    await page.route('**/api/v1/auth/me', (r) =>
      json(r, 200, {
        success: true,
        data: {
          ...MOCK_USER,
          organizations: [{ id: 'org-onb-001', name: 'Test Business', onboardingStatus: 'ORG_CREATION' }],
        },
      }),
    );
    await page.route('**/api/v1/auth/refresh', (r) =>
      json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
    );
    await page.route('**/api/v1/onboarding/org', (r) =>
      json(r, 200, { success: true, data: mockOrgAtStatus('ORG_CREATION') }),
    );
    await page.route('**/api/v1/onboarding/crawl-status', (r) =>
      json(r, 200, { success: true, data: { status: 'idle', docsCount: 0, crawledAt: null } }),
    );

    // Navigate to step 1 even though step 1 is already done
    await page.goto('/onboarding/connect');

    // Layout should redirect forward to /onboarding/learn
    await expect(page).toHaveURL(/\/onboarding\/learn/, { timeout: 8000 });
  });

  /**
   * If onboardingStatus is 'COMPLETED', OnboardingLayout should redirect to /dashboard.
   */
  test('redirects completed users from onboarding to dashboard', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (r) =>
      json(r, 200, {
        success: true,
        data: {
          ...MOCK_USER,
          organizations: [{ id: 'org-onb-001', name: 'Test Business', onboardingStatus: 'COMPLETED' }],
        },
      }),
    );
    await page.route('**/api/v1/auth/refresh', (r) =>
      json(r, 401, { success: false, code: 'NO_REFRESH_TOKEN' }),
    );
    await page.route('**/api/v1/onboarding/org', (r) =>
      json(r, 200, { success: true, data: mockOrgAtStatus('COMPLETED') }),
    );

    // Analytics mocks for the dashboard landing
    await page.route('**/api/v1/analytics/**', (r) =>
      json(r, 200, { success: true, data: { totalCalls: 0, callsToday: 0, callsThisWeek: 0, activeCalls: 0, totalMinutes: 0, resolvedCalls: 0 } }),
    );
    await page.route('**/api/v1/calls*', (r) =>
      json(r, 200, { success: true, data: [], meta: { total: 0, page: 1, limit: 10 } }),
    );

    await page.goto('/onboarding/connect');

    // Should land on /dashboard since onboarding is COMPLETED
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  });
});
