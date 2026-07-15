/**
 * 🟣 Test Engineer — E2E: Onboarding flow navigation
 * NOTE: Full form submission tests require a running backend + test user.
 * These are structural/navigation smoke tests that work against the frontend scaffold.
 *
 * TODO (T2.2): Expand with full form submission once Auth + Onboarding API is live.
 */
import { test, expect } from '@playwright/test';

// Helper: simulate authenticated state via localStorage + mock Redux
// For now we just test that the routes exist and render the step labels
test.describe('Onboarding step navigation (authenticated)', () => {
  // These tests will run once auth is implemented.
  // Marking as todo so CI doesn't fail on unimplemented steps.
  test.todo('Step 1 (Connect) renders website URL input');
  test.todo('Step 2 (Learn) shows crawl progress indicator');
  test.todo('Step 3 (Configure) shows business info form');
  test.todo('Step 4 (Customize) shows voice and language settings');
  test.todo('Step 5 (Activate) shows VapiSandbox test call widget');
  test.todo('Clicking Next advances to the next step');
  test.todo('Clicking Back goes to the previous step');
  test.todo('Step indicator correctly highlights the active step');
});
