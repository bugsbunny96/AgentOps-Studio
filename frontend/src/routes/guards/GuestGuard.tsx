import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: React.ReactNode;
}

/**
 * Prevents authenticated users from accessing login/register pages.
 * Calls verifySession() on mount to resolve initial loading state,
 * then redirects to /dashboard if the user is already authenticated.
 */
export function GuestGuard({ children }: Props) {
  const { isAuthenticated, isLoading, verifySession } = useAuth();

  useEffect(() => {
    verifySession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
