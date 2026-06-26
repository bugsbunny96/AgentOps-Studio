import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { setCredentials, clearCredentials, setAuthLoading } from '@/store/slices/authSlice';
import { setCurrentOrg, setAvailableOrgs, clearCurrentOrg } from '@/store/slices/orgSlice';
import { api } from '@/utils/api';
import type { Organization, UserRole } from '@/types';

// ─── Backend API response shapes ───────────────────────────────────────────
interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  onboardingStatus: string;
  role: UserRole;
}

interface MeData {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  status: string;
  organizations: AuthOrg[];
}

interface LoginData {
  user: {
    id: string;
    name: string;
    email: string;
    isVerified: boolean;
    status: string;
  };
  organizations: AuthOrg[];
}

// ─── Helper: map lean org + role from auth response → Redux state ──────────
function dispatchOrgs(
  dispatch: ReturnType<typeof useAppDispatch>,
  orgs: AuthOrg[]
) {
  // Cast to Organization — extra fields will be undefined (filled on org load)
  const mapped = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    onboardingStatus: o.onboardingStatus,
  })) as Organization[];

  dispatch(setAvailableOrgs(mapped));

  // Restore last active org from localStorage, fallback to first
  const savedId = (() => {
    try { return localStorage.getItem('activeOrgId'); } catch { return null; }
  })();
  const match = orgs.find((o) => o.id === savedId) ?? orgs[0];
  if (match) {
    dispatch(
      setCurrentOrg({ org: mapped.find((o) => o.id === match.id)!, role: match.role })
    );
  }
  return match;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAppSelector((s) => s.auth);
  const { currentOrg, currentRole } = useAppSelector((s) => s.org);

  /**
   * Verify the current session (called on app mount from AuthGuard).
   * On success → populate Redux auth + org slices.
   * On failure → clear state (stays on /login).
   */
  const verifySession = useCallback(async () => {
    dispatch(setAuthLoading(true));
    try {
      const res = await api.get<{ success: boolean; data: MeData }>('/auth/me');
      const { id, name, email, isVerified, status, organizations } = res.data.data;

      dispatch(setCredentials({ id, name, email, isVerified, status: status as 'Active' | 'Suspended' | 'Pending', createdAt: '' }));

      if (organizations.length > 0) {
        dispatchOrgs(dispatch, organizations);
      }
    } catch {
      dispatch(clearCredentials());
      dispatch(clearCurrentOrg());
    }
  }, [dispatch]);

  /** Login — server sets HttpOnly cookies; we just update Redux state */
  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ success: boolean; data: LoginData }>(
        '/auth/login',
        { email, password }
      );
      const { user: u, organizations } = res.data.data;

      dispatch(setCredentials({ ...u, createdAt: '' }));

      if (organizations.length > 0) {
        const active = dispatchOrgs(dispatch, organizations);
        if (active?.onboardingStatus !== 'COMPLETED') {
          navigate('/onboarding');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/onboarding');
      }
    },
    [dispatch, navigate]
  );

  /** Logout — clears server session via cookie invalidation + local Redux state */
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      dispatch(clearCredentials());
      dispatch(clearCurrentOrg());
      navigate('/login');
    }
  }, [dispatch, navigate]);

  return {
    user,
    currentOrg,
    currentRole,
    isAuthenticated,
    isLoading,
    verifySession,
    login,
    logout,
  };
}
