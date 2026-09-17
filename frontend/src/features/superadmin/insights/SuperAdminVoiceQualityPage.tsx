/**
 * 19.5 — Voice Quality Monitor
 * Lists flagged calls (poor / short / failed) across all orgs.
 * Filters: time window, org, quality tier.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mic, RefreshCw, AlertTriangle, Clock, XCircle, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/utils/api';

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  red: '#ef4444', redD: 'rgba(239,68,68,0.12)',
  amber: '#f59e0b', amberD: 'rgba(245,158,11,0.12)',
  blue: '#3b82f6', blueD: 'rgba(59,130,246,0.12)',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

type Quality = 'poor' | 'short' | 'failed';

interface FlaggedCall {
  callId: string; orgId: string; vapiCallId: string;
  direction: string; durationSecs: number;
  status: string; endedReason?: string;
  quality: Quality; qualityReason: string;
  cost: number; createdAt: string;
}

interface VoiceQualityData {
  totalFlagged: number;
  byQuality: Record<Quality, number>;
  byEndedReason: Record<string, number>;
  flaggedCalls: FlaggedCall[];
}

const qualityConfig: Record<Quality, { label: string; color: string; bg: string; Icon: typeof AlertTriangle }> = {
  poor:   { label: 'Poor',   color: T.amber, bg: T.amberD, Icon: AlertTriangle },
  short:  { label: 'Short',  color: T.blue,  bg: T.blueD,  Icon: Clock },
  failed: { label: 'Failed', color: T.red,   bg: T.redD,   Icon: XCircle },
};

export default function SuperAdminVoiceQualityPage() {
  const [days, setDays] = useState(30);
  const [qualityFilter, setQualityFilter] = useState<Quality | 'all'>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sa-voice-quality', days],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: VoiceQualityData }>(
        `/superadmin/voice-quality?days=${days}&limit=100`
      );
      return r.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const calls = (data?.flaggedCalls ?? []).filter(
    c => qualityFilter === 'all' || c.quality === qualityFilter
  );

  const topReasons = Object.entries(data?.byEndedReason ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ padding: '32px 40px', background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Mic size={22} color={T.red} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Voice Quality Monitor</h1>
            <p style={{ margin: 0, fontSize: 13, color: T.t2, marginTop: 2 }}>
              Flagged calls with quality issues — failed, poor endedReason, phantom calls
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
              color: T.t2, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
            {[7, 14, 30, 60, 90].map(d => (
              <option key={d} value={d}>{d}d</option>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        <div>
          {/* Quality filter chips */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {(['all', 'poor', 'short', 'failed'] as const).map(q => {
              const cfg = q !== 'all' ? qualityConfig[q] : null;
              const count = q === 'all' ? (data?.totalFlagged ?? 0) :
                (data?.byQuality[q] ?? 0);
              return (
                <button key={q} onClick={() => setQualityFilter(q)}
                  style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, border: '1px solid',
                    borderColor: qualityFilter === q ? (cfg?.color ?? T.bdrB) : T.bdr,
                    background: qualityFilter === q ? (cfg?.bg ?? T.bgC) : 'transparent',
                    color: qualityFilter === q ? (cfg?.color ?? T.t1) : T.t2 }}>
                  {q === 'all' ? 'All' : cfg?.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Calls table */}
          <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
                  {['Vapi Call ID', 'Direction', 'Duration', 'Issue', 'Reason', 'Cost', 'Date'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: T.t2 }}>Loading…</td></tr>
                )}
                {!isLoading && calls.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: T.t2 }}>
                    No flagged calls in the last {days} days 🎉
                  </td></tr>
                )}
                {calls.map((c, i) => {
                  const cfg = qualityConfig[c.quality];
                  return (
                    <tr key={c.callId}
                      style={{ borderBottom: i < calls.length - 1 ? `1px solid ${T.bdr}` : 'none' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: T.t2 }}>
                        {c.vapiCallId.slice(0, 16)}…
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: T.t2, textTransform: 'capitalize' }}>
                        {c.direction}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: T.t1 }}>
                        {c.durationSecs}s
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, padding: '3px 8px', borderRadius: 20,
                          background: cfg.bg, color: cfg.color, fontWeight: 600 }}>
                          <cfg.Icon size={10} />{cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: T.t2, maxWidth: 200 }}>
                        <span title={c.qualityReason} style={{ overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', display: 'block' }}>
                          {c.endedReason ?? c.qualityReason}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: T.t2 }}>
                        ${c.cost.toFixed(4)}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: T.t3 }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar: top ended reasons */}
        <div>
          <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: T.t2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Top EndedReasons
            </h3>
            {topReasons.length === 0 && !isLoading && (
              <p style={{ color: T.t3, fontSize: 13, margin: 0 }}>No data yet</p>
            )}
            {topReasons.map(([reason, count]) => (
              <div key={reason} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: T.t2, fontFamily: 'monospace' }}>{reason}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{count}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: T.red,
                    width: `${Math.min(100, (count / (topReasons[0]?.[1] ?? 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
