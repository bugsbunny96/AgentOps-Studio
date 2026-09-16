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
  blue: '#60a5fa',
};

interface Org {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  onboardingStatus: string;
  createdAt: string;
  memberCount: number;
}

interface OrgListResponse {
  total: number;
  page: number;
  limit: number;
  orgs: Org[];
}

const PLAN_COLOR: Record<string, string> = {
  free: T.t3,
  starter: '#60a5fa',
  growth: '#a78bfa',
  enterprise: '#f59e0b',
};

export default function SuperAdminOrgsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [plan, setPlan]     = useState('');
  const [page, setPage]     = useState(1);

  const { data, isLoading } = useQuery<OrgListResponse>({
    queryKey: ['sa', 'orgs', page, search, plan],
    queryFn: () => api.get('/superadmin/orgs', {
      params: { page, limit: 20, search: search || undefined, plan: plan || undefined },
    }).then((r) => r.data?.data ?? r.data),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.t1, margin: '0 0 4px' }}>Organisations</h1>
        <p style={{ fontSize: 13, color: T.t2, margin: 0 }}>
          {data?.total ?? '–'} total organisations
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.t3 }} />
          <input
            type="text"
            placeholder="Search by name…"
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
          value={plan}
          onChange={(e) => { setPlan(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px', background: T.bgC,
            border: `1px solid ${T.bdr}`, borderRadius: 9,
            color: T.t2, fontSize: 13, outline: 'none',
          }}
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 100px 120px 80px 40px',
          padding: '10px 16px',
          borderBottom: `1px solid ${T.bdr}`,
          fontSize: 11, fontWeight: 700, color: T.t3,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <span>Organisation</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Members</span>
          <span />
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.t3, fontSize: 13 }}>Loading…</div>
        ) : data?.orgs.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.t3, fontSize: 13 }}>No organisations found</div>
        ) : (
          data?.orgs.map((org) => (
            <div
              key={org._id}
              onClick={() => navigate(`/superadmin/orgs/${org._id}`)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 120px 80px 40px',
                padding: '12px 16px',
                borderBottom: `1px solid ${T.bdr}`,
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.bgR; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.t1, margin: 0 }}>{org.name}</p>
                <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0' }}>{org.slug}</p>
              </div>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                  color: PLAN_COLOR[org.plan] ?? T.t2,
                }}>
                  {org.plan}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 999,
                  background: org.onboardingStatus === 'COMPLETED' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${org.onboardingStatus === 'COMPLETED' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  color: org.onboardingStatus === 'COMPLETED' ? T.em : '#f59e0b',
                }}>
                  {org.onboardingStatus === 'COMPLETED' ? 'Active' : 'Onboarding'}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: T.t2 }}>
                {org.memberCount}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <ChevronRight size={14} style={{ color: T.t3 }} />
              </span>
            </div>
          ))
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
