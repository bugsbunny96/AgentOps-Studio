import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  children: React.ReactNode;
}

/**
 * Protects routes that require authentication.
 * - On first mount: calls verifySession() to validate the cookie-based session.
 * - While loading: shows a full-screen spinner.
 * - If not authenticated: redirects to /login.
 */
export function AuthGuard({ children }: Props) {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
