/**
 * 🟣 Test Engineer — E2E: Dashboard (authenticated flows)
 * TODO (T2.1): Expand once auth API is live and we can set up test users.
 */
import { test } from '@playwright/test';

test.describe('Dashboard (authenticated)', () => {
  test.todo('Sidebar renders all nav items');
  test.todo('Dashboard shows KPI cards');
  test.todo('Navigating to /agents renders agents page');
  test.todo('Navigating to /calls renders calls page');
  test.todo('Navigating to /knowledge-base renders KB page');
  test.todo('Navigating to /team renders team page');
  test.todo('Navigating to /settings renders settings page');
  test.todo('Sign out clears session and redirects to /login');
});

test.describe('Multi-tenant isolation (critical)', () => {
  test.todo('Org A cannot access Org B calls via direct URL');
  test.todo('Org A cannot access Org B agents via API');
  test.todo('Switching orgs updates X-Organization-ID header');
});
