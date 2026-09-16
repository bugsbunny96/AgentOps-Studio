/**
 * SuperAdminGuard
 * Calls GET /superadmin/auth/me to verify the sas-session cookie.
 * If not authenticated, redirects to /superadmin/login.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';

interface Props {
  children: React.ReactNode;
}

export function SuperAdminGuard({ children }: Props) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/superadmin/auth/me')
      .then(() => setChecking(false))
      .catch(() => navigate('/superadmin/login', { replace: true }));
  }, [navigate]);

  if (checking) {
    return (
      <div style={{
        display: 'flex', height: '100vh',
        alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', color: '#94a3b8', fontSize: 13,
      }}>
        Verifying session…
      </div>
    );
  }

  return <>{children}</>;
}
