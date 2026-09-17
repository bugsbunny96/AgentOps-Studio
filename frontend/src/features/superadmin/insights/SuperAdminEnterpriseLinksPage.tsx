/**
 * 19.3 — Self-serve Enterprise Onboarding Portal
 * SA generates magic links; orgs can use them to self-onboard as enterprise.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, Trash2, RefreshCw, Clock, CheckCircle, Copy } from 'lucide-react';
import api from '@/utils/api';

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  red: '#ef4444', redD: 'rgba(239,68,68,0.12)',
  green: '#22c55e', greenD: 'rgba(34,197,94,0.12)',
  amber: '#f59e0b', amberD: 'rgba(245,158,11,0.12)',
  blue: '#3b82f6', blueD: 'rgba(59,130,246,0.12)',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

type LinkStatus = 'pending' | 'used' | 'expired' | 'revoked';

interface EnterpriseLink {
  _id: string; token: string; status: LinkStatus;
  label?: string; notes?: string;
  expiresAt?: string; usedAt?: string; usedByOrgId?: string;
  createdAt: string; createdBy: string;
}

const statusConfig: Record<LinkStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: T.amber, bg: T.amberD },
  used:     { label: 'Used',     color: T.green, bg: T.greenD },
  expired:  { label: 'Expired',  color: T.t3,    bg: T.bgC    },
  revoked:  { label: 'Revoked',  color: T.red,   bg: T.redD   },
};

function LinkBadge({ status }: { status: LinkStatus }) {
  const cfg = statusConfig[status];
  return (
    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600,
      background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

export default function SuperAdminEnterpriseLinksPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ label: '', notes: '', ttlHours: 72 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sa-enterprise-links'],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: { links: EnterpriseLink[]; total: number } }>(
        '/superadmin/enterprise-links?limit=50'
      );
      return r.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await api.post<{ success: boolean; data: EnterpriseLink }>(
        '/superadmin/enterprise-links', { ...form }
      );
      return r.data.data;
    },
    onSuccess: () => {
      setForm({ label: '', notes: '', ttlHours: 72 });
      setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ['sa-enterprise-links'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/superadmin/enterprise-links/${id}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sa-enterprise-links'] }),
  });

  function copyToken(token: string, id: string) {
    const url = `${window.location.origin}/enterprise-onboarding/${token}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const links = data?.links ?? [];

  return (
    <div style={{ padding: '32px 40px', background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link2 size={22} color={T.blue} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Enterprise Onboarding Links</h1>
            <p style={{ margin: 0, fontSize: 13, color: T.t2, marginTop: 2 }}>
              Time-limited magic links for self-serve enterprise onboarding
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
              color: T.t2, cursor: 'pointer', fontSize: 13 }}>
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button onClick={() => setShowCreate(!showCreate)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: T.blueD, border: `1px solid ${T.blue}`, borderRadius: 8,
              color: T.blue, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Plus size={14} /> Generate Link
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: T.bgS, border: `1px solid ${T.blue}55`, borderRadius: 12,
          padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700 }}>New Enterprise Link</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: T.t2, fontWeight: 600, marginBottom: 5 }}>
                Label (optional)
              </label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Acme Corp trial"
                style={{ width: '100%', padding: '9px 12px', background: T.bgC,
                  border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.t1,
                  fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: T.t2, fontWeight: 600, marginBottom: 5 }}>
                TTL (hours)
              </label>
              <input type="number" min="1" max="720" value={form.ttlHours}
                onChange={e => setForm(f => ({ ...f, ttlHours: Number(e.target.value) }))}
                style={{ width: '100%', padding: '9px 12px', background: T.bgC,
                  border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.t1,
                  fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
              style={{ padding: '9px 18px', background: T.blueD, border: `1px solid ${T.blue}`,
                borderRadius: 8, color: T.blue, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                whiteSpace: 'nowrap' }}>
              {createMutation.isPending ? 'Creating…' : 'Create Link'}
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: T.t2, fontWeight: 600, marginBottom: 5 }}>
              Notes (optional)
            </label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes about this link…" rows={2}
              style={{ width: '100%', padding: '9px 12px', background: T.bgC,
                border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.t1,
                fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          {createMutation.isError && (
            <div style={{ marginTop: 10, fontSize: 13, color: T.red }}>
              Failed to create link. Please try again.
            </div>
          )}
        </div>
      )}

      {/* Links table */}
      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
              {['Label', 'Token', 'Status', 'Expires', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: T.t3, textTransform: 'uppercase',
                  letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.t2 }}>Loading…</td></tr>
            )}
            {!isLoading && links.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.t2 }}>
                No enterprise links yet. Generate one above.
              </td></tr>
            )}
            {links.map((link, i) => (
              <tr key={link._id} style={{ borderBottom: i < links.length - 1 ? `1px solid ${T.bdr}` : 'none' }}>
                <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 600 }}>
                  {link.label || <span style={{ color: T.t3, fontStyle: 'italic' }}>No label</span>}
                  {link.notes && (
                    <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{link.notes}</div>
                  )}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <code style={{ fontSize: 11, color: T.t2, background: T.bgC,
                    padding: '3px 7px', borderRadius: 4 }}>
                    {link.token.slice(0, 14)}…
                  </code>
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <LinkBadge status={link.status} />
                  {link.status === 'used' && link.usedByOrgId && (
                    <div style={{ fontSize: 10, color: T.t3, marginTop: 3 }}>
                      org: {link.usedByOrgId.slice(-6)}
                    </div>
                  )}
                </td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: T.t2 }}>
                  {link.expiresAt ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />
                      {new Date(link.expiresAt).toLocaleDateString()}
                    </div>
                  ) : '—'}
                </td>
                <td style={{ padding: '13px 16px', fontSize: 12, color: T.t3 }}>
                  {new Date(link.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {link.status === 'pending' && (
                      <>
                        <button onClick={() => copyToken(link.token, link._id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                            background: copiedId === link._id ? T.greenD : T.bgC,
                            border: `1px solid ${copiedId === link._id ? T.green : T.bdr}`,
                            borderRadius: 6, color: copiedId === link._id ? T.green : T.t2,
                            cursor: 'pointer', fontSize: 11 }}>
                          {copiedId === link._id ? <CheckCircle size={11} /> : <Copy size={11} />}
                          {copiedId === link._id ? 'Copied' : 'Copy URL'}
                        </button>
                        <button onClick={() => { if (confirm('Revoke this link?')) revokeMutation.mutate(link._id); }}
                          disabled={revokeMutation.isPending}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                            background: T.redD, border: `1px solid ${T.red}55`,
                            borderRadius: 6, color: T.red, cursor: 'pointer', fontSize: 11 }}>
                          <Trash2 size={11} /> Revoke
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
