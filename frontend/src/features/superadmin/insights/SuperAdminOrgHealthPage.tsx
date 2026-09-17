/**
 * 19.2 — Org Health Score
 * Lists every org ranked by health score (lowest first = most at risk).
 * Colour-coded tier: healthy (green), warning (amber), critical (red).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, RefreshCw, CheckCircle, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  green: '#22c55e', greenL: '#bbf7d0', greenD: 'rgba(34,197,94,0.12)',
  amber: '#f59e0b', amberL: '#fde68a', amberD: 'rgba(245,158,11,0.12)',
  red: '#ef4444', redL: '#fca5a5', redD: 'rgba(239,68,68,0.12)',
  blue: '#3b82f6', blueD: 'rgba(59,130,246,0.12)',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

type Tier = 'healthy' | 'warning' | 'critical';

interface OrgHealthScore {
  orgId:   string;
  orgName: string;
  plan:    string;
  score:   number;
  tier:    Tier;
  breakdown: {
    agentLive:    boolean;
    hasKBDocs:    boolean;
    callsThisWeek:boolean;
    multiMember:  boolean;
    paidPlan:     boolean;
  };
}

const tierConfig: Record<Tier, { label: string; color: string; bg: string; Icon: typeof CheckCircle }> = {
  healthy: { label: 'Healthy', color: T.green, bg: T.greenD, Icon: CheckCircle },
  warning: { label: 'Warning', color: T.amber, bg: T.amberD, Icon: AlertTriangle },
  critical: { label: 'Critical', color: T.red,  bg: T.redD,  Icon: XCircle },
};

const breakdownLabels: Record<keyof OrgHealthScore['breakdown'], string> = {
  agentLive:    'Agent live',
  hasKBDocs:    'KB docs',
  callsThisWeek:'Calls this week',
  multiMember:  'Team > 1',
  paidPlan:     'Paid plan',
};
const breakdownPoints: Record<keyof OrgHealthScore['breakdown'], number> = {
  agentLive: 30, hasKBDocs: 20, callsThisWeek: 20, multiMember: 10, paidPlan: 20,
};

export default function SuperAdminOrgHealthPage() {
  const [filter, setFilter] = useState<Tier | 'all'>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sa-org-health'],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: OrgHealthScore[] }>('/superadmin/org-health?limit=100');
      return r.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const orgs = (data ?? []).filter(o => filter === 'all' || o.tier === filter);
  const counts = { healthy: 0, warning: 0, critical: 0 };
  (data ?? []).forEach(o => counts[o.tier]++);

  return (
    <div style={{ padding: '32px 40px', background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Heart size={22} color={T.red} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Org Health Scores</h1>
            <p style={{ margin: 0, fontSize: 13, color: T.t2, marginTop: 2 }}>
              Composite 0–100 score per org — sorted lowest first
            </p>
          </div>
        </div>
        <button onClick={() => refetch()}
          disabled={isFetching}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
            color: T.t2, cursor: 'pointer', fontSize: 13 }}>
          <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {(['critical', 'warning', 'healthy'] as Tier[]).map(tier => {
          const cfg = tierConfig[tier];
          return (
            <button key={tier} onClick={() => setFilter(filter === tier ? 'all' : tier)}
              style={{ background: filter === tier ? cfg.bg : T.bgS,
                border: `1px solid ${filter === tier ? cfg.color : T.bdr}`,
                borderRadius: 12, padding: '18px 20px', cursor: 'pointer',
                textAlign: 'left', transition: 'all .15s' }}>
              <cfg.Icon size={18} color={cfg.color} />
              <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color, marginTop: 8, lineHeight: 1 }}>
                {isLoading ? '–' : counts[tier]}
              </div>
              <div style={{ fontSize: 13, color: T.t2, marginTop: 4 }}>{cfg.label} orgs</div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
              {['Organisation', 'Plan', 'Score', 'Tier', 'Breakdown', ''].map(h => (
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
            {!isLoading && orgs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: T.t2 }}>No orgs found</td></tr>
            )}
            {orgs.map((org, i) => {
              const cfg = tierConfig[org.tier];
              return (
                <tr key={org.orgId}
                  style={{ borderBottom: i < orgs.length - 1 ? `1px solid ${T.bdr}` : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600 }}>{org.orgName}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                      background: T.blueD, color: T.blue, fontWeight: 600, textTransform: 'capitalize' }}>
                      {org.plan}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Score bar */}
                      <div style={{ width: 80, height: 6, borderRadius: 99,
                        background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ width: `${org.score}%`, height: '100%', borderRadius: 99,
                          background: cfg.color, transition: 'width .3s' }} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: cfg.color, minWidth: 28 }}>
                        {org.score}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, padding: '4px 10px', borderRadius: 20,
                      background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
                      <cfg.Icon size={11} />
                      {cfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(Object.keys(org.breakdown) as Array<keyof OrgHealthScore['breakdown']>).map(k => (
                        <span key={k} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          background: org.breakdown[k] ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                          color: org.breakdown[k] ? T.green : T.red, fontWeight: 500 }}>
                          {org.breakdown[k] ? '✓' : '✗'} {breakdownLabels[k]} {org.breakdown[k] ? `+${breakdownPoints[k]}` : `+0`}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Link to={`/superadmin/orgs/${org.orgId}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, color: T.t2, textDecoration: 'none' }}>
                      View <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
