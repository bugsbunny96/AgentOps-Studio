import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, LogIn, ArrowRightLeft, AlertTriangle, Download, Palette } from 'lucide-react';
import api from '@/utils/api';

const T = {
  bg:   '#07070f',
  bgS:  '#0e0e1a',
  bgC:  'rgba(255,255,255,0.04)',
  bdr:  'rgba(255,255,255,0.07)',
  bdrB: 'rgba(255,255,255,0.12)',
  red:  '#ef4444',
  redL: '#fca5a5',
  green:'#22c55e',
  amber:'#f59e0b',
  blue: '#3b82f6',
  t1:   '#f8fafc',
  t2:   '#94a3b8',
  t3:   '#475569',
  em:   '#10b981',
};

interface OrgMember {
  membershipId: string;
  role: string;
  user: {
    id: string; name: string; email: string; status: string; isSuperAdmin: boolean;
  } | null;
}

interface OrgDetail {
  org: {
    _id: string; name: string; slug: string; plan: string;
    onboardingStatus: string; createdAt: string; industry: string;
    vapiAssistantId?: string; stripeSubscriptionId?: string;
    planOverride?: string;
  };
  members: OrgMember[];
}

// ─── Transfer Ownership Modal ──────────────────────────────────────────────────

function TransferOwnershipModal({
  members,
  orgId,
  onClose,
  onSuccess,
}: {
  members: OrgMember[];
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const CONFIRM_PHRASE = 'transfer ownership';
  const [newOwnerId, setNewOwnerId] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState('');

  const eligible = members.filter(m => m.role !== 'Owner' && m.user?.status !== 'Suspended' && m.user);

  const transferMut = useMutation({
    mutationFn: ({ orgId, newOwnerId }: { orgId: string; newOwnerId: string }) =>
      api.post(`/superadmin/orgs/${orgId}/transfer-ownership`, { newOwnerId }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Transfer failed. Please try again.');
    },
  });

  const canSubmit = newOwnerId && phrase.trim().toLowerCase() === CONFIRM_PHRASE && !transferMut.isPending;
  const newOwnerName = eligible.find(m => m.user?.id === newOwnerId)?.user?.name;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 440, background: T.bgS, border: `1px solid rgba(239,68,68,0.3)`,
        borderRadius: 14, padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <AlertTriangle size={20} color={T.amber} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h3 style={{ margin: '0 0 4px', color: T.t1, fontSize: 16, fontWeight: 700 }}>Transfer Ownership</h3>
            <p style={{ margin: 0, fontSize: 12, color: T.t2 }}>
              The current owner will be downgraded to Member. The new owner will receive full admin access.
            </p>
          </div>
        </div>

        {/* New owner selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.t2, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            New Owner
          </label>
          {eligible.length === 0 ? (
            <p style={{ fontSize: 12, color: T.redL }}>No eligible members to transfer to (need at least one non-owner, non-suspended member).</p>
          ) : (
            <select
              value={newOwnerId}
              onChange={e => setNewOwnerId(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
                padding: '9px 12px', color: T.t1, fontSize: 13, outline: 'none',
              }}
            >
              <option value="">— Select member —</option>
              {eligible.map(m => (
                <option key={m.user!.id} value={m.user!.id}>
                  {m.user!.name} ({m.user!.email}) · {m.role}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Confirmation phrase */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.t2, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Type <code style={{ background: T.bgC, padding: '2px 6px', borderRadius: 4, color: T.t1 }}>transfer ownership</code> to confirm
          </label>
          <input
            value={phrase}
            onChange={e => { setPhrase(e.target.value); setError(''); }}
            placeholder="transfer ownership"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.bgC, borderRadius: 8, padding: '9px 12px',
              color: T.t1, fontSize: 13, outline: 'none',
              border: `1px solid ${phrase.trim().toLowerCase() === CONFIRM_PHRASE ? T.green : T.bdr}`,
            }}
          />
        </div>

        {error && (
          <p style={{ color: T.redL, fontSize: 12, marginBottom: 14 }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 8,
            border: `1px solid ${T.bdr}`, background: 'transparent',
            color: T.t2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (canSubmit) {
                transferMut.mutate({ orgId, newOwnerId });
              }
            }}
            disabled={!canSubmit}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: canSubmit ? T.amber : T.t3,
              color: canSubmit ? '#000' : T.t2,
              fontSize: 13, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: transferMut.isPending ? 0.7 : 1,
            }}
          >
            {transferMut.isPending
              ? 'Transferring…'
              : newOwnerName
                ? `Transfer to ${newOwnerName}`
                : 'Transfer Ownership'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SuperAdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [impersonating, setImpersonating] = useState(false);
  const [impError, setImpError] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery<OrgDetail>({
    queryKey: ['sa', 'orgs', id],
    queryFn: () => api.get(`/superadmin/orgs/${id}`).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const impersonateMut = useMutation({
    mutationFn: () => api.post(`/superadmin/orgs/${id}/impersonate`),
    onMutate: () => { setImpersonating(true); setImpError(''); },
    onSuccess: () => {
      window.location.href = '/dashboard';
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setImpError(msg ?? 'Impersonation failed');
      setImpersonating(false);
    },
  });

  if (isLoading) {
    return <p style={{ color: T.t3, fontSize: 13 }}>Loading org…</p>;
  }

  if (!data) {
    return <p style={{ color: T.red, fontSize: 13 }}>Organisation not found</p>;
  }

  const { org, members } = data;

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await api.get(`/superadmin/orgs/${id}/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `org-${id}-export.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  const Row = ({ label, value }: { label: string; value: string | undefined }) => (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${T.bdr}` }}>
      <span style={{ width: 160, flexShrink: 0, fontSize: 12, color: T.t3, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, color: T.t2, wordBreak: 'break-all' }}>{value ?? '—'}</span>
    </div>
  );

  const effectivePlan = org.planOverride ?? org.plan;

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate('/superadmin/orgs')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 20, padding: '6px 12px',
          background: T.bgC, border: `1px solid ${T.bdr}`,
          borderRadius: 8, color: T.t2, fontSize: 12, cursor: 'pointer',
        }}
      >
        <ArrowLeft size={12} />
        All Organisations
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.t1, margin: '0 0 4px' }}>{org.name}</h1>
          <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>
            /{org.slug} · {effectivePlan.toUpperCase()} plan
            {org.planOverride && (
              <span style={{ marginLeft: 6, fontSize: 10, color: T.amber, fontWeight: 700 }}>OVERRIDDEN</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Export Data (GDPR ZIP) */}
          <button
            onClick={() => void handleExport()}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, cursor: exporting ? 'not-allowed' : 'pointer',
              border: `1px solid rgba(59,130,246,0.35)`,
              background: 'rgba(59,130,246,0.08)',
              color: T.blue, fontSize: 13, fontWeight: 600,
              opacity: exporting ? 0.7 : 1,
            }}
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Export Data'}
          </button>
          {/* White-label config */}
          <Link
            to={`/superadmin/orgs/${id}/white-label`}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, textDecoration: 'none',
              border: `1px solid rgba(168,85,247,0.35)`,
              background: 'rgba(168,85,247,0.08)',
              color: '#a855f7', fontSize: 13, fontWeight: 600,
            }}
          >
            <Palette size={13} />
            White-label
          </Link>
          <button
            onClick={() => setTransferOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
              border: `1px solid rgba(245,158,11,0.35)`,
              background: 'rgba(245,158,11,0.08)',
              color: T.amber, fontSize: 13, fontWeight: 600,
            }}
          >
            <ArrowRightLeft size={13} />
            Transfer Ownership
          </button>
          <button
            onClick={() => impersonateMut.mutate()}
            disabled={impersonating}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 9, border: 'none', cursor: impersonating ? 'not-allowed' : 'pointer',
              background: impersonating ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              opacity: impersonating ? 0.7 : 1,
            }}
          >
            <LogIn size={14} />
            {impersonating ? 'Switching…' : 'Impersonate Org'}
          </button>
        </div>
      </div>

      {impError && (
        <div style={{
          padding: '8px 14px', borderRadius: 9, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 12, color: T.redL,
        }}>
          {impError}
        </div>
      )}

      {transferSuccess && (
        <div style={{
          padding: '8px 14px', borderRadius: 9, marginBottom: 16,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
          fontSize: 12, color: '#bbf7d0',
        }}>
          Ownership transferred successfully. The member list has been refreshed.
        </div>
      )}

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.t1, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Organisation Details
          </p>
          <Row label="ID"               value={org._id} />
          <Row label="Industry"         value={org.industry} />
          <Row label="Onboarding"       value={org.onboardingStatus} />
          <Row label="Vapi Assistant"   value={org.vapiAssistantId} />
          <Row label="Stripe Sub"       value={org.stripeSubscriptionId} />
          <Row label="Created"          value={new Date(org.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} />
        </div>

        <div style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: T.t1, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Members ({members.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m) => (
              <div key={m.membershipId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 9,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.bdr}`,
              }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: T.t1, margin: 0 }}>{m.user?.name ?? 'Unknown'}</p>
                  <p style={{ fontSize: 11, color: T.t3, margin: '1px 0 0' }}>{m.user?.email}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: m.role === 'Owner' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${m.role === 'Owner' ? 'rgba(245,158,11,0.25)' : T.bdr}`,
                    color: m.role === 'Owner' ? T.amber : T.t2,
                  }}>
                    {m.role}
                  </span>
                  {m.user?.status === 'Suspended' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                      color: T.red,
                    }}>
                      Suspended
                    </span>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p style={{ fontSize: 12, color: T.t3 }}>No members found</p>
            )}
          </div>
        </div>
      </div>

      {/* Transfer modal */}
      {transferOpen && (
        <TransferOwnershipModal
          members={members}
          orgId={org._id}
          onClose={() => setTransferOpen(false)}
          onSuccess={() => {
            setTransferSuccess(true);
            void qc.invalidateQueries({ queryKey: ['sa', 'orgs', id] });
          }}
        />
      )}
    </div>
  );
}
