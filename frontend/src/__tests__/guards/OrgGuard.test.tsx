/**
 * 🟣 Test Engineer — OrgGuard tests
 * Verifies: no org → redirect, incomplete onboarding → redirect, completed → render
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { OrgGuard } from '@/routes/guards/OrgGuard';
import type { RootState, Organization } from '@/types';
import type { RootState as StoreState } from '@/store';

const baseOrg: Organization = {
  id: 'org-1',
  name: 'Test Corp',
  slug: 'test-corp',
  timezone: 'Asia/Kolkata',
  industry: 'Technology',
  onboardingStatus: 'COMPLETED',
  hasWebsite: true,
  supportedLanguages: ['en-US'],
  businessHours: { start: '09:00', end: '18:00' },
  createdAt: '',
};

const DashboardContent = () => <div>Dashboard</div>;

describe('OrgGuard', () => {
  it('does not render children when no org is set', () => {
    const preloadedState: Partial<StoreState> = {
      org: {
        currentOrg: null,
        currentRole: null,
        availableOrgs: [],
        onboarding: { activeStep: 0, tempOrgId: null },
      },
    };

    renderWithProviders(
      <OrgGuard><DashboardContent /></OrgGuard>,
      { preloadedState }
    );

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('does not render children when onboarding is not COMPLETED', () => {
    const preloadedState: Partial<StoreState> = {
      org: {
        currentOrg: { ...baseOrg, onboardingStatus: 'WEBSITE_CRAWL' },
        currentRole: 'Owner',
        availableOrgs: [],
        onboarding: { activeStep: 2, tempOrgId: null },
      },
    };

    renderWithProviders(
      <OrgGuard><DashboardContent /></OrgGuard>,
      { preloadedState }
    );

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders children when org is COMPLETED', () => {
    const preloadedState: Partial<StoreState> = {
      org: {
        currentOrg: baseOrg,
        currentRole: 'Owner',
        availableOrgs: [baseOrg],
        onboarding: { activeStep: 0, tempOrgId: null },
      },
    };

    renderWithProviders(
      <OrgGuard><DashboardContent /></OrgGuard>,
      { preloadedState }
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
