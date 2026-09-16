import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import api from '@/utils/api';

const T = {
  bgC:  'rgba(255,255,255,0.04)',
  bgR:  'rgba(255,255,255,0.02)',
  bdr:  'rgba(255,255,255,0.07)',
  t1:   '#f8fafc',
  t2:   '#94a3b8',
  t3:   '#475569',
  red:  '#ef4444',
  em:   '#10b981',
};

interface User {
  _id: string;
  name: string;
  email: string;
  status: 'Active' | 'Suspended' | 'Pending';
  isVerified: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

interface UserListResponse {
  total: number;
  page: number;
  limit: number;
  users: User[];
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  Active:    { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', color: '#10b981' },
  Suspended: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  color: '#ef4444' },
  Pending:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', color: '#f59e0b' },
};

export default function SuperAdminUsersPage() {
  const navigate = useNavigate();
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);

  const { data, isLoading } = useQuery<UserListResponse>({
    queryKey: ['sa', 'users', page, search, status],
    queryFn: () => api.get('/superadmin/users', {
      params: { page, limit: 20, search: search || undefined, status: status || undefined },
    }).then((r) => r.data?.data ?? r.data),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.t1, margin: '0 0 4px' }}>Users</h1>
        <p style={{ fontSize: 13, color: T.t2, margin: 0 }}>{data?.total ?? '–'} total users</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.t3 }} />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 12px 8px 30px',
              background: T.bgC, border: `1px solid ${T.bdr}`,
              borderRadius: 9, color: T.t1, fontSize: 13, outline: 'none',
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px', background: T.bgC,
            border: `1px solid ${T.bdr}`, borderRadius: 9,
            color: T.t2, fontSize: 13, outline: 'none',
          }}
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 120px 80px 40px',
          padding: '10px 16px',
          borderBottom: `1px solid ${T.bdr}`,
          fontSize: 11, fontWeight: 700, color: T.t3,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <span>User</span>
          <span>Status</span>
          <span>Verified</span>
          <span />
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.t3, fontSize: 13 }}>Loading…</div>
        ) : data?.users.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.t3, fontSize: 13 }}>No users found</div>
        ) : (
          data?.users.map((user) => {
            const ss = STATUS_STYLE[user.status] ?? STATUS_STYLE.Pending;
            return (
              <div
                key={user._id}
                onClick={() => navigate(`/superadmin/users/${user._id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 80px 40px',
                  padding: '11px 16px',
                  borderBottom: `1px solid ${T.bdr}`,
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.bgR; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.t1, margin: 0 }}>{user.name}</p>
                    {user.isSuperAdmin && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                        color: T.red, letterSpacing: '0.06em',
                      }}>
                        SA
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0' }}>{user.email}</p>
                </div>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color,
                  }}>
                    {user.status}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
                  {user.isVerified
                    ? <span style={{ color: T.em }}>✓</span>
                    : <span style={{ color: T.t3 }}>✗</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <ChevronRight size={14} style={{ color: T.t3 }} />
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
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
