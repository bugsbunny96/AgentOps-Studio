import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store';

interface Props {
  children: React.ReactNode;
}

/**
 * Ensures an organization with COMPLETED onboarding is active.
 * Placed inside <AuthGuard> so we know the user is authenticated.
 * - No org → redirect to /onboarding
 * - Org onboarding not completed → redirect to /onboarding
 * - Org ready → render children
 */
export function OrgGuard({ children }: Props) {
  const { currentOrg } = useAppSelector((s) => s.org);

  if (!currentOrg) {
    return <Navigate to="/onboarding" replace />;
  }

  if (currentOrg.onboardingStatus !== 'COMPLETED') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
