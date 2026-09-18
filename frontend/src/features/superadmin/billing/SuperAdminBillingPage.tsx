/**
 * SuperAdminBillingPage
 * Route: /superadmin/billing
 *
 * Sections:
 *  1. KPI strip   — MRR / ARR / Paying orgs / ARPU
 *  2. Plan breakdown — colour-coded bar chart
 *  3. Active plan overrides table
 *  4. Recently churned orgs
 *  5. Top orgs by call volume (30 d)
 *  6. Plan Override modal — select org → pick plan → optional expiry
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, TrendingUp, DollarSign, Users, BarChart2, AlertTriangle, RotateCcw, Edit2 } from 'lucide-react';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingData {
  mrr:          number;
  arr:          number;
  paidOrgs:     number;
  arpu:         number;
  plans:        Record<string, number>;
  topOrgsByVolume: Array<{ _id: string; callCount: number; totalDuration: number; orgName: string; orgPlan: string }>;
  recentlyChurned: Array<{ _id: string; name: string; slug: string; plan: string; updatedAt: string }>;
  activeOverrides: Array<{
    _id: string; name: string; slug: string; plan: string;
    planOverride: string; planOverrideExpiry: string | null;
    planOverrideBy: string; planOverrideAt: string;
  }>;
  allOrgs: Array<{ _id: string; name: string; slug: string; plan: string; planOverride?: string }>;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  red: '#ef4444', redL: '#fca5a5', green: '#10b981', amber: '#f59e0b',
  blue: '#3b82f6', violet: '#8b5cf6',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

const PLAN_COLOR: Record<string, string> = {
  free:       T.t3,
  starter:    T.blue,
  growth:     T.green,
  enterprise: T.violet,
};

// Source of truth: AgentOps Studio — SaaS Pricing & Stripe Setup (2026-09-17)
// Internal `plan` enum values are unchanged (starter/growth/enterprise);
// customer-facing names are Basic/Standard/Pro.
const PLAN_LABEL: Record<string, string> = {
  free:       'Free',
  starter:    'Basic  ₹9,999/mo',
  growth:     'Standard  ₹17,999/mo',
  enterprise: 'Pro  ₹25,999/mo',
};

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000   ? `₹${(n / 1000).toFixed(1)}K`   : `₹${n}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 900, color: T.t1, margin: '4px 0 2px' }}>{value}</p>
        {sub && <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Plan Override Modal ───────────────────────────────────────────────────────

function PlanOverrideModal({
  orgs,
  initialOrgId,
  onClose,
  onSave,
  isPending,
}: {
  orgs: BillingData['allOrgs'];
  initialOrgId: string;
  onClose: () => void;
  onSave: (orgId: string, plan: string, expiry: string | null) => void;
  isPending: boolean;
}) {
  const [orgId,  setOrgId]  = useState(initialOrgId);
  const [plan,   setPlan]   = useState('');
  const [expiry, setExpiry] = useState('');
  const [err,    setErr]    = useState('');

  const selected = orgs.find((o) => o._id === orgId);

  const handleSave = () => {
    if (!orgId || !plan) { setErr('Please select an org and a plan.'); return; }
    onSave(orgId, plan, expiry || null);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t1,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 16, padding: 32, width: '90%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.t1, margin: '0 0 6px' }}>Override Plan</h3>
        <p style={{ fontSize: 13, color: T.t2, margin: '0 0 24px' }}>
          Directly set any org's plan without Stripe. Audit-logged.
        </p>

        {err && <p style={{ fontSize: 13, color: T.red, margin: '0 0 14px' }}>{err}</p>}

        {/* Org picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            Organisation
          </label>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
            <option value="">— select —</option>
            {orgs.map((o) => (
              <option key={o._id} value={o._id}>{o.name} ({o.plan})</option>
            ))}
          </select>
          {selected && (
            <p style={{ fontSize: 11, color: T.t3, margin: '4px 0 0' }}>
              Current plan: <strong style={{ color: PLAN_COLOR[selected.plan] }}>{selected.plan}</strong>
              {selected.planOverride && <span style={{ color: T.amber }}> · Override active: {selected.planOverride}</span>}
            </p>
          )}
        </div>

        {/* Plan picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            New Plan
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['free', 'starter', 'growth', 'enterprise'].map((p) => {
              const active = plan === p;
              const col    = PLAN_COLOR[p];
              return (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  style={{
                    padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                    border:     `1px solid ${active ? col : T.bdr}`,
                    background: active ? `${col}18` : T.bgC,
                    color:      active ? col : T.t2,
                    fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expiry date */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
            Override Expiry <span style={{ color: T.t3, fontWeight: 400 }}>(blank = perpetual)</span>
          </label>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || !orgId || !plan}
            style={{
              padding: '9px 20px', borderRadius: 8, background: T.red, border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: (!orgId || !plan) ? 0.5 : 1,
            }}
          >
            {isPending && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
            Apply Override
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdminBillingPage() {
  const qc = useQueryClient();
  const [modalOrgId, setModalOrgId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sa-billing'],
    queryFn:  async () => {
      const r = await api.get('/superadmin/billing');
      return r.data.data as BillingData;
    },
  });

  const overrideMut = useMutation({
    mutationFn: ({ orgId, plan, expiry }: { orgId: string; plan: string; expiry: string | null }) =>
      api.patch(`/superadmin/orgs/${orgId}/plan-override`, { plan, expiryDate: expiry }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-billing'] });
      setModalOrgId(null);
    },
  });

  const revertMut = useMutation({
    mutationFn: (orgId: string) => api.delete(`/superadmin/orgs/${orgId}/plan-override`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['sa-billing'] }),
  });

  if (isLoading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Loader2 size={28} color={T.red} style={{ animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const totalOrgs = Object.values(data.plans).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: 0 }}>Billing Overview</h1>
        <p style={{ fontSize: 13, color: T.t2, margin: '4px 0 0' }}>
          Real-time subscription metrics across all organisations.
        </p>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard icon={DollarSign} label="MRR"         value={fmt(data.mrr)}         sub={`ARR ${fmt(data.arr)}`}       color={T.green}  />
        <KpiCard icon={TrendingUp} label="ARR"         value={fmt(data.arr)}          sub="Monthly × 12"                color={T.blue}   />
        <KpiCard icon={Users}      label="Paying Orgs" value={String(data.paidOrgs)} sub={`of ${totalOrgs} total`}      color={T.violet} />
        <KpiCard icon={BarChart2}  label="ARPU"        value={fmt(data.arpu)}         sub="avg revenue / paying org"    color={T.amber}  />
      </div>

      {/* Plan Breakdown */}
      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: T.t1, margin: 0 }}>Plan Distribution</h2>
          <button
            onClick={() => setModalOrgId('')}
            style={{ padding: '7px 16px', borderRadius: 8, background: T.red, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            + Override Plan
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(['free', 'starter', 'growth', 'enterprise'] as const).map((plan) => {
            const count = data.plans[plan] ?? 0;
            const pct   = totalOrgs > 0 ? Math.round((count / totalOrgs) * 100) : 0;
            const col   = PLAN_COLOR[plan];
            return (
              <div key={plan}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: col, textTransform: 'capitalize' }}>{plan}</span>
                  <span style={{ fontSize: 12, color: T.t2 }}>{count} org{count !== 1 ? 's' : ''} · {pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: T.bgC, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 999, transition: 'width .6s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
        {/* Plan price reference */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.bdr}`, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {Object.entries(PLAN_LABEL).map(([p, label]) => (
            <span key={p} style={{ fontSize: 11, color: T.t3 }}>
              <span style={{ color: PLAN_COLOR[p], fontWeight: 700, textTransform: 'capitalize' }}>{p}</span>
              {' '}— {label.split('  ')[1] ?? 'free'}
            </span>
          ))}
        </div>
      </div>

      {/* Two-column: Active Overrides + Churned */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Active Overrides */}
        <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Edit2 size={14} color={T.amber} />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: 0 }}>Active Plan Overrides</h2>
            {data.activeOverrides.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: T.amber, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 999, padding: '2px 8px' }}>
                {data.activeOverrides.length}
              </span>
            )}
          </div>
          {data.activeOverrides.length === 0 ? (
            <p style={{ padding: '24px 20px', color: T.t3, fontSize: 13, margin: 0 }}>No active overrides.</p>
          ) : (
            <div>
              {data.activeOverrides.map((o) => (
                <div key={o._id} style={{ padding: '12px 20px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</p>
                    <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0' }}>
                      <span style={{ color: PLAN_COLOR[o.planOverride], fontWeight: 700 }}>{o.planOverride}</span>
                      {o.planOverrideExpiry
                        ? ` · expires ${fmtDate(o.planOverrideExpiry)}`
                        : ' · perpetual'}
                      {' · by '}{o.planOverrideBy?.split('@')[0]}
                    </p>
                  </div>
                  <button
                    onClick={() => revertMut.mutate(o._id)}
                    disabled={revertMut.isPending}
                    title="Revert override"
                    style={{ padding: '5px 8px', borderRadius: 6, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Churned */}
        <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} color={T.red} />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: 0 }}>Recently Churned</h2>
            <span style={{ fontSize: 11, color: T.t3, marginLeft: 4 }}>(last 30 d)</span>
          </div>
          {data.recentlyChurned.length === 0 ? (
            <p style={{ padding: '24px 20px', color: T.t3, fontSize: 13, margin: 0 }}>No churn detected recently. 🎉</p>
          ) : (
            <div>
              {data.recentlyChurned.map((o) => (
                <div key={o._id} style={{ padding: '12px 20px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: 0 }}>{o.name}</p>
                    <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0' }}>
                      Downgraded {fmtDate(o.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setModalOrgId(o._id)}
                    style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.25)`, color: T.redL, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Re-activate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Orgs by Call Volume */}
      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.bdr}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: 0 }}>
            Top Orgs by Call Volume <span style={{ fontSize: 11, color: T.t3, fontWeight: 400 }}>(30 days)</span>
          </h2>
        </div>
        {data.topOrgsByVolume.length === 0 ? (
          <p style={{ padding: '24px 20px', color: T.t3, fontSize: 13, margin: 0 }}>No calls in the last 30 days.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
                {['#', 'Organisation', 'Plan', 'Calls (30d)', 'Avg Duration'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topOrgsByVolume.map((row, i) => {
                const avgDur = row.callCount > 0 ? Math.round(row.totalDuration / row.callCount) : 0;
                const m = Math.floor(avgDur / 60);
                const s = avgDur % 60;
                return (
                  <tr
                    key={row._id}
                    style={{ borderBottom: `1px solid ${T.bdr}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.bgC)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', color: T.t3, fontSize: 13 }}>#{i + 1}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: T.t1 }}>{row.orgName ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: PLAN_COLOR[row.orgPlan] ?? T.t3, textTransform: 'capitalize' }}>{row.orgPlan}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: T.t1, fontWeight: 600 }}>{row.callCount.toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: T.t2 }}>{`${m}m ${s}s`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Plan Override Modal */}
      {modalOrgId !== null && (
        <PlanOverrideModal
          orgs={data.allOrgs}
          initialOrgId={modalOrgId}
          onClose={() => setModalOrgId(null)}
          onSave={(orgId, plan, expiry) => overrideMut.mutate({ orgId, plan, expiry })}
          isPending={overrideMut.isPending}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
