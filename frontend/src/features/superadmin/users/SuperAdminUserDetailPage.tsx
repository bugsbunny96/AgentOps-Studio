import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldOff, Trash2 } from 'lucide-react';
import api from '@/utils/api';

const T = {
  bgC:  'rgba(255,255,255,0.04)',
  bdr:  'rgba(255,255,255,0.07)',
  red:  '#ef4444',
  redL: '#fca5a5',
  t1:   '#f8fafc',
  t2:   '#94a3b8',
  t3:   '#475569',
  em:   '#10b981',
  warn: '#f59e0b',
};

interface UserDetail {
  user: {
    id: string; name: string; email: string;
    isVerified: boolean; isSuperAdmin: boolean;
    status: string; createdAt: string; updatedAt: string;
  };
  memberships: Array<{
    membershipId: string;
    role: string;
    org: { id: string; name: string; slug: string; plan: string } | null;
  }>;
}

export default function SuperAdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: ['sa', 'users', id],
    queryFn: () => api.get(`/superadmin/users/${id}`).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const suspendMut = useMutation({
    mutationFn: (suspend: boolean) => api.patch(`/superadmin/users/${id}/suspend`, { suspend }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa', 'users', id] });
      qc.invalidateQueries({ queryKey: ['sa', 'users'] });
      setActionError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Action failed');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/superadmin/users/${id}`),
    onSuccess: () => navigate('/superadmin/users', { replace: true }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(msg ?? 'Delete failed');
      setConfirmDelete(false);
    },
  });

  if (isLoading) return <p style={{ color: T.t3, fontSize: 13 }}>Loading user…</p>;
  if (!data)     return <p style={{ color: T.red, fontSize: 13 }}>User not found</p>;

  const { user, memberships } = data;
  const isSuspended = user.status === 'Suspended';

  const Row = ({ label, value }: { label: string; value: string | undefined | boolean }) => (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${T.bdr}` }}>
      <span style={{ width: 140, flexShrink: 0, fontSize: 12, color: T.t3, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, color: T.t2, wordBreak: 'break-all' }}>
        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value ?? '—')}
      </span>
    </div>
  );

  return (
    <div>
      <button
        onClick={() => navigate('/superadmin/users')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 20, padding: '6px 12px',
          background: T.bgC, border: `1px solid ${T.bdr}`,
          borderRadius: 8, color: T.t2, fontSize: 12, cursor: 'pointer',
        }}
      >
        <ArrowLeft size={12} />
        All Users
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: T.t1, margin: 0 }}>{user.name}</h1>
            {user.isSuperAdmin && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                color: T.red,
              }}>SUPER ADMIN</span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: isSuspended ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
              border: `1px solid ${isSuspended ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
              color: isSuspended ? T.red : T.em,
            }}>
              {user.status}
            </span>
          </div>
          <p style={{ fontSize: 12, color: T.t3, margin: '4px 0 0' }}>{user.email}</p>
        </div>

        {/* Actions — disabled for super admins */}
        {!user.isSuperAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => suspendMut.mutate(!isSuspended)}
              disabled={suspendMut.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: isSuspended ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: isSuspended ? T.em : T.warn,
                fontSize: 12, fontWeight: 700,
                opacity: suspendMut.isPending ? 0.6 : 1,
              }}
            >
              <ShieldOff size={13} />
              {isSuspended ? 'Unsuspend' : 'Suspend'}
            </button>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: 'rgba(239,68,68,0.1)', color: T.red,
                  fontSize: 12, fontWeight: 700,
                }}
              >
                <Trash2 size={13} />
                Delete
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => deleteMut.mutate()}
                  disabled={deleteMut.isPending}
                  style={{
                    padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: T.red, color: '#fff',
                    fontSize: 12, fontWeight: 700,
                    opacity: deleteMut.isPending ? 0.6 : 1,
                  }}
                >
                  {deleteMut.isPending ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    padding: '8px 14px', borderRadius: 9, border: `1px solid ${T.bdr}`,
                    background: 'transparent', color: T.t2,
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div style={{
          padding: '8px 14px', borderRadius: 9, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 12, color: T.redL,
        }}>
          {actionError}
        </div>
      )}

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.t1, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Account
          </p>
          <Row label="ID"           value={user.id} />
          <Row label="Email"        value={user.email} />
          <Row label="Verified"     value={user.isVerified} />
          <Row label="Super Admin"  value={user.isSuperAdmin} />
          <Row label="Status"       value={user.status} />
          <Row label="Created"      value={new Date(user.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} />
        </div>

        <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.t1, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Organisations ({memberships.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {memberships.map((m) => (
              <div key={m.membershipId} style={{
                padding: '8px 12px', borderRadius: 9,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.bdr}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.t1, margin: 0 }}>{m.org?.name ?? 'Unknown'}</p>
                    <p style={{ fontSize: 11, color: T.t3, margin: '1px 0 0' }}>/{m.org?.slug} · {m.org?.plan}</p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: m.role === 'Owner' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${m.role === 'Owner' ? 'rgba(245,158,11,0.25)' : T.bdr}`,
                    color: m.role === 'Owner' ? T.warn : T.t2,
                  }}>
                    {m.role}
                  </span>
                </div>
              </div>
            ))}
            {memberships.length === 0 && (
              <p style={{ fontSize: 12, color: T.t3 }}>No org memberships</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
