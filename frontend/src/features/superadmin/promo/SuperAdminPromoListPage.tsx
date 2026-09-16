/**
 * SuperAdminPromoListPage
 * Lists all promo codes with inline active toggle, redemption counts,
 * and create/edit/delete actions.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, Tag, ToggleLeft, ToggleRight, Trash2, Edit2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromoCode {
  _id:           string;
  code:          string;
  discountType:  'percent' | 'fixed_inr';
  discountValue: number;
  appliesTo:     string;
  billingCycle:  string;
  maxUses:       number | null;
  usedCount:     number;
  validFrom:     string;
  validUntil:    string | null;
  active:        boolean;
  notes:         string;
  createdAt:     string;
}

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)',
  red: '#ef4444', green: '#10b981', amber: '#f59e0b',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function discountLabel(p: PromoCode) {
  return p.discountType === 'percent'
    ? `${p.discountValue}% off`
    : `₹${p.discountValue.toLocaleString()} off`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminPromoListPage() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [page, setPage]           = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['sa-promo', page],
    queryFn:  async () => {
      const r = await api.get(`/superadmin/promo?page=${page}&limit=20`);
      return r.data.data as { promos: PromoCode[]; total: number; page: number; limit: number };
    },
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => api.patch(`/superadmin/promo/${id}/toggle`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['sa-promo'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/promo/${id}`),
    onSuccess:  () => { setDeleteId(null); qc.invalidateQueries({ queryKey: ['sa-promo'] }); },
  });

  const promos     = data?.promos ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: 0 }}>Promo Codes</h1>
          <p style={{ fontSize: 13, color: T.t2, margin: '4px 0 0' }}>{total} code{total !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => navigate('/superadmin/promo/new')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, background: T.red, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <PlusCircle size={15} /> New Code
        </button>
      </div>

      {/* Table */}
      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={24} color={T.red} style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : promos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <Tag size={32} color={T.t3} style={{ marginBottom: 12 }} />
            <p style={{ color: T.t2, fontSize: 14, margin: '0 0 12px' }}>No promo codes yet.</p>
            <button
              onClick={() => navigate('/superadmin/promo/new')}
              style={{ padding: '8px 18px', borderRadius: 8, background: T.red, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Create your first code
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
                {['Code', 'Discount', 'Applies To', 'Uses', 'Valid Until', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <>
                  <tr
                    key={promo._id}
                    style={{ borderBottom: `1px solid ${T.bdr}`, transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.bgC)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Code */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: T.t1, background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 6, padding: '3px 10px', letterSpacing: '0.08em', cursor: 'pointer' }}
                          onClick={() => navigator.clipboard.writeText(promo.code)}
                          title="Click to copy"
                        >
                          {promo.code}
                        </span>
                        {promo.notes && (
                          <button
                            onClick={() => setExpanded(expanded === promo._id ? null : promo._id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', alignItems: 'center' }}
                          >
                            {expanded === promo._id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Discount */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.green }}>{discountLabel(promo)}</span>
                    </td>

                    {/* Applies To */}
                    <td style={{ padding: '14px 16px' }}>
                      <div>
                        <span style={{ fontSize: 12, color: T.t2, textTransform: 'capitalize' }}>{promo.appliesTo}</span>
                        <span style={{ fontSize: 11, color: T.t3, display: 'block' }}>{promo.billingCycle}</span>
                      </div>
                    </td>

                    {/* Uses */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 13, color: T.t1, fontWeight: 600 }}>{promo.usedCount}</span>
                      {promo.maxUses !== null && (
                        <span style={{ fontSize: 11, color: T.t3 }}> / {promo.maxUses}</span>
                      )}
                      {promo.maxUses === null && (
                        <span style={{ fontSize: 11, color: T.t3 }}> / ∞</span>
                      )}
                    </td>

                    {/* Valid Until */}
                    <td style={{ padding: '14px 16px', fontSize: 12, color: T.t2, whiteSpace: 'nowrap' }}>
                      {promo.validUntil ? fmt(promo.validUntil) : <span style={{ color: T.t3 }}>No expiry</span>}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                        fontSize: 11, fontWeight: 700,
                        background: promo.active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                        color:      promo.active ? T.green : T.red,
                        border:     `1px solid ${promo.active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {promo.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* Toggle */}
                        <button
                          onClick={() => toggleMut.mutate(promo._id)}
                          disabled={toggleMut.isPending}
                          title={promo.active ? 'Disable' : 'Enable'}
                          style={{ padding: '5px 8px', borderRadius: 6, background: T.bgC, border: `1px solid ${T.bdr}`, cursor: 'pointer', color: promo.active ? T.red : T.green, display: 'flex', alignItems: 'center' }}
                        >
                          {promo.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => navigate(`/superadmin/promo/${promo._id}/edit`)}
                          style={{ padding: '5px 8px', borderRadius: 6, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteId(promo._id)}
                          disabled={promo.usedCount > 0}
                          style={{ padding: '5px 8px', borderRadius: 6, background: T.bgC, border: `1px solid ${T.bdr}`, color: promo.usedCount > 0 ? T.t3 : T.red, cursor: promo.usedCount > 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                          title={promo.usedCount > 0 ? 'Cannot delete — has redemptions. Disable instead.' : 'Delete'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded notes row */}
                  {expanded === promo._id && (
                    <tr key={`${promo._id}-notes`} style={{ background: T.bgC }}>
                      <td colSpan={7} style={{ padding: '10px 16px 14px 16px', fontSize: 12, color: T.t2, fontStyle: 'italic' }}>
                        📝 {promo.notes}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{ width: 32, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: page === p ? T.red : T.bgC, border: `1px solid ${page === p ? T.red : T.bdr}`, color: page === p ? '#fff' : T.t2 }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setDeleteId(null)}>
          <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 32, maxWidth: 360, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.t1, margin: '0 0 8px' }}>Delete promo code?</h3>
            <p style={{ fontSize: 13, color: T.t2, margin: '0 0 24px' }}>This permanently removes the code. It cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '8px 18px', borderRadius: 8, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => deleteMut.mutate(deleteId)}
                disabled={deleteMut.isPending}
                style={{ padding: '8px 18px', borderRadius: 8, background: T.red, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {deleteMut.isPending && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
