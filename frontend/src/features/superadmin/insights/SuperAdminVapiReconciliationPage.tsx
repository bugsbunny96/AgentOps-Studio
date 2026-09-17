/**
 * 19.10 — Vapi Bill Reconciliation
 * Shows actual Vapi cost vs plan revenue per org.
 * At-risk orgs (margin < 40%) are highlighted in red.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, RefreshCw, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  green: '#22c55e', greenD: 'rgba(34,197,94,0.12)',
  red: '#ef4444', redD: 'rgba(239,68,68,0.12)',
  amber: '#f59e0b', amberD: 'rgba(245,158,11,0.12)',
  blue: '#3b82f6', blueD: 'rgba(59,130,246,0.12)',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

interface OrgRecon {
  orgId: string; orgName: string; plan: string;
  planRevenueUsd: number; totalCallSecs: number; totalCallMinutes: number;
  vapiCostUsd: number; marginUsd: number; marginPct: number | null;
  atRisk: boolean; callCount: number;
}
interface Summary {
  totalOrgs: number; atRiskOrgs: number;
  totalVapiCostUsd: number; totalPlanRevenueUsd: number; totalMarginUsd: number;
}
interface ReconReport {
  periodDays: number; generatedAt: string;
  summary: Summary; orgs: OrgRecon[];
}

function formatUsd(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SuperAdminVapiReconciliationPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sa-vapi-reconciliation', days],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: ReconReport }>(
        `/superadmin/vapi-reconciliation?days=${days}`
      );
      return r.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const summary = data?.summary;
  const orgs = data?.orgs ?? [];

  return (
    <div style={{ padding: '32px 40px', background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarSign size={22} color={T.green} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Vapi Bill Reconciliation</h1>
            <p style={{ margin: 0, fontSize: 13, color: T.t2, marginTop: 2 }}>
              Actual Vapi cost vs plan revenue — margin analysis per org
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {data && (
            <span style={{ fontSize: 12, color: T.t3 }}>
              Generated {new Date(data.generatedAt).toLocaleString()}
            </span>
          )}
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
              color: T.t2, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
            {[7, 14, 30, 60, 90].map(d => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
              color: T.t2, cursor: 'pointer', fontSize: 13 }}>
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Orgs analysed',  value: summary?.totalOrgs ?? '–',         color: T.t1 },
          { label: 'At-risk orgs',   value: summary?.atRiskOrgs ?? '–',         color: T.red },
          { label: 'Total Vapi cost', value: summary ? formatUsd(summary.totalVapiCostUsd) : '–', color: T.red },
          { label: 'Total revenue',  value: summary ? formatUsd(summary.totalPlanRevenueUsd) : '–', color: T.green },
          { label: 'Total margin',   value: summary ? formatUsd(summary.totalMarginUsd) : '–',
            color: (summary?.totalMarginUsd ?? 0) >= 0 ? T.green : T.red },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: T.bgS, border: `1px solid ${T.bdr}`,
            borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
              {['Organisation', 'Plan', 'Calls', 'Minutes', 'Vapi Cost', 'Revenue', 'Margin', 'Margin %', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: T.t2 }}>Loading…</td></tr>
            )}
            {!isLoading && orgs.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: T.t2 }}>No call data for this period</td></tr>
            )}
            {orgs.map((org, i) => (
              <tr key={org.orgId}
                style={{ borderBottom: i < orgs.length - 1 ? `1px solid ${T.bdr}` : 'none',
                  background: org.atRisk ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {org.atRisk && <AlertTriangle size={13} color={T.red} />}
                    {org.orgName}
                  </div>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                    background: T.blueD, color: T.blue, fontWeight: 600, textTransform: 'capitalize' }}>
                    {org.plan}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: T.t2 }}>{org.callCount.toLocaleString()}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: T.t2 }}>{org.totalCallMinutes.toFixed(1)}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: T.red }}>{formatUsd(org.vapiCostUsd)}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: T.green }}>{formatUsd(org.planRevenueUsd)}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600,
                  color: org.marginUsd >= 0 ? T.green : T.red }}>
                  {formatUsd(org.marginUsd)}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {org.marginPct === null ? (
                    <span style={{ fontSize: 12, color: T.t3 }}>Free</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {org.marginPct >= 40
                        ? <TrendingUp size={13} color={T.green} />
                        : <TrendingDown size={13} color={T.red} />}
                      <span style={{ fontSize: 13, fontWeight: 600,
                        color: org.marginPct >= 40 ? T.green : T.red }}>
                        {org.marginPct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {org.atRisk ? (
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20,
                      background: T.redD, color: T.red, fontWeight: 600 }}>At Risk</span>
                  ) : (
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20,
                      background: T.greenD, color: T.green, fontWeight: 600 }}>OK</span>
                  )}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <Link to={`/superadmin/orgs/${org.orgId}`}
                    style={{ fontSize: 12, color: T.t2, textDecoration: 'none' }}>View →</Link>
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
