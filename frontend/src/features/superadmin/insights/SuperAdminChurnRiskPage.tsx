/**
 * 19.6 — Automated Churn Risk
 * Shows the latest churn risk snapshot per org.
 * On-demand scan button (single org or all orgs).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingDown, RefreshCw, Zap, CheckCircle } from 'lucide-react';
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

type ChurnTier = 'high' | 'medium' | 'low';

interface ChurnSignal {
  key: string; label: string; severity: 'high' | 'medium' | 'low';
}
interface ChurnRisk {
  orgId: string; orgName: string; plan: string;
  score: number; signals: ChurnSignal[]; scannedAt: string;
}

const tierConfig: Record<ChurnTier, { label: string; color: string; bg: string; range: string }> = {
  high:   { label: 'High',   color: T.red,   bg: T.redD,   range: '60–100' },
  medium: { label: 'Medium', color: T.amber, bg: T.amberD, range: '30–59' },
  low:    { label: 'Low',    color: T.green, bg: T.greenD, range: '0–29' },
};
const severityColor: Record<string, string> = {
  high: T.red, medium: T.amber, low: T.blue,
};

function getTier(score: number): ChurnTier {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

export default function SuperAdminChurnRiskPage() {
  const [filter, setFilter] = useState<ChurnTier | 'all'>('all');
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sa-churn-risk', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?tier=${filter}&limit=100` : '?limit=100';
      const r = await api.get<{ success: boolean; data: ChurnRisk[] }>(
        `/superadmin/churn-risk${params}`
      );
      return r.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      await api.post('/superadmin/churn-risk/scan', {});
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sa-churn-risk'] });
    },
  });

  const orgs = data ?? [];

  return (
    <div style={{ padding: '32px 40px', background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TrendingDown size={22} color={T.red} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Churn Risk Alerts</h1>
            <p style={{ margin: 0, fontSize: 13, color: T.t2, marginTop: 2 }}>
              Daily automated scoring — high score = high churn risk
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'rgba(239,68,68,0.12)', border: `1px solid ${T.red}`,
              borderRadius: 8, color: T.red, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Zap size={14} />
            {scanMutation.isPending ? 'Scanning…' : 'Run Full Scan'}
          </button>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
              color: T.t2, cursor: 'pointer', fontSize: 13 }}>
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tier filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {(['all', 'high', 'medium', 'low'] as const).map(t => {
          const cfg = t !== 'all' ? tierConfig[t] : null;
          return (
            <button key={t} onClick={() => setFilter(t)}
              style={{ padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, border: '1px solid',
                borderColor: filter === t ? (cfg?.color ?? T.bdrB) : T.bdr,
                background: filter === t ? (cfg?.bg ?? T.bgC) : 'transparent',
                color: filter === t ? (cfg?.color ?? T.t1) : T.t2 }}>
              {t === 'all' ? `All (${orgs.length})` : `${cfg!.label} · ${cfg!.range}`}
            </button>
          );
        })}
      </div>

      {/* Org cards */}
      {isLoading && (
        <div style={{ padding: 40, textAlign: 'center', color: T.t2 }}>Loading…</div>
      )}
      {!isLoading && orgs.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: T.t2 }}>
          <CheckCircle size={32} color={T.green} style={{ marginBottom: 12 }} />
          <p>No churn risk data yet. Run a full scan first.</p>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orgs.map(org => {
          const tier = getTier(org.score);
          const cfg = tierConfig[tier];
          return (
            <div key={org.orgId} style={{ background: T.bgS, border: `1px solid ${T.bdr}`,
              borderRadius: 12, padding: '16px 20px',
              borderLeft: `3px solid ${cfg.color}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{org.orgName}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6,
                      background: T.blueD, color: T.blue, fontWeight: 600, textTransform: 'capitalize' }}>
                      {org.plan}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
                      background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
                      {cfg.label} Risk
                    </span>
                  </div>
                  {/* Signals */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {org.signals.map(s => (
                      <span key={s.key} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)', color: severityColor[s.severity],
                        border: `1px solid rgba(255,255,255,0.06)` }}>
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                  {/* Score gauge */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>
                      {org.score}
                    </div>
                    <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>/ 100</div>
                  </div>
                  <div style={{ height: 48, width: 1, background: T.bdr }} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: T.t3 }}>
                      Scanned {new Date(org.scannedAt).toLocaleDateString()}
                    </div>
                    <Link to={`/superadmin/orgs/${org.orgId}`}
                      style={{ fontSize: 12, color: T.blue, textDecoration: 'none' }}>
                      View org →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
