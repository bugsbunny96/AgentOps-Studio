import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

const T = {
  bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)',
  t1:  '#f8fafc',
  t2:  '#94a3b8',
  t3:  '#475569',
  red: '#ef4444',
};

interface AuditLog {
  _id: string;
  superAdminEmail: string;
  action: string;
  targetType?: string;
  targetLabel?: string;
  ip?: string;
  createdAt: string;
}

interface AuditResponse {
  total: number;
  page: number;
  limit: number;
  logs: AuditLog[];
}

const ACTION_COLOR: Record<string, string> = {
  SA_LOGIN:               '#60a5fa',
  SA_LOGOUT:              '#94a3b8',
  SA_ORG_IMPERSONATE:     '#f59e0b',
  SA_ORG_EXIT_IMPERSONATION: '#10b981',
  SA_USER_SUSPEND:        '#ef4444',
  SA_USER_UNSUSPEND:      '#10b981',
  SA_USER_DELETE:         '#ef4444',
};

export default function SuperAdminAuditPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ['sa', 'audit', page],
    queryFn: () => api.get('/superadmin/audit-logs', { params: { page, limit: 50 } })
      .then((r) => r.data?.data ?? r.data),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.t1, margin: '0 0 4px' }}>Audit Log</h1>
        <p style={{ fontSize: 13, color: T.t2, margin: 0 }}>
          All super admin actions — immutable, append-only
        </p>
      </div>

      <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '160px 1fr 180px 120px',
          padding: '10px 16px',
          borderBottom: `1px solid ${T.bdr}`,
          fontSize: 11, fontWeight: 700, color: T.t3,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <span>Timestamp</span>
          <span>Action</span>
          <span>Admin</span>
          <span>Target</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.t3, fontSize: 13 }}>Loading…</div>
        ) : data?.logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.t3, fontSize: 13 }}>No audit logs yet</div>
        ) : (
          data?.logs.map((log) => (
            <div
              key={log._id}
              style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 180px 120px',
                padding: '10px 16px',
                borderBottom: `1px solid ${T.bdr}`,
                fontSize: 12,
              }}
            >
              <span style={{ color: T.t3 }}>
                {new Date(log.createdAt).toLocaleString('en-IN', {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid rgba(255,255,255,0.1)`,
                  color: ACTION_COLOR[log.action] ?? T.t2,
                  letterSpacing: '0.04em',
                }}>
                  {log.action}
                </span>
              </span>
              <span style={{ color: T.t2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.superAdminEmail}
              </span>
              <span style={{ color: T.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.targetLabel ?? log.targetType ?? '—'}
              </span>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${T.bdr}`,
              background: T.bgC, color: T.t2, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.4 : 1,
            }}
          >
            ← Prev
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: T.t2 }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${T.bdr}`,
              background: T.bgC, color: T.t2, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
              opacity: page === totalPages ? 0.4 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
