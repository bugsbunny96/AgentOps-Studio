/**
 * AnalyticsPage — deeper metrics view, separate from the Dashboard's
 * at-a-glance summary.
 *
 * Consumes the dedicated analytics module (org-scoped, JWT-authenticated):
 *   GET /api/v1/analytics/overview
 *   GET /api/v1/analytics/calls-per-day?days=7|30|90
 *   GET /api/v1/analytics/top-callers?limit=10
 *
 * These are distinct from — and more complete than — the narrower
 * /calls/stats endpoints the Dashboard's KPI cards/CallsChart use.
 */

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PhoneCall, Activity, Radio, Timer, CheckCircle2, CalendarDays,
  Trophy, AlertCircle, Loader2,
} from 'lucide-react';
import api from '@/utils/api';

// ── Design tokens (mirrors DashboardPage.tsx) ─────────────────────────────────
const T = {
  bgC: 'rgba(255,255,255,0.035)',
  bgH: 'rgba(255,255,255,0.06)',
  bdr: 'rgba(255,255,255,0.07)',
  bdrH: 'rgba(255,255,255,0.15)',
  blue: '#3b82f6',
  blueL: '#60a5fa',
  violet: '#8b5cf6',
  em: '#10b981',
  amb: '#f59e0b',
  t1: '#f8fafc',
  t2: '#94a3b8',
  t3: '#475569',
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface AnalyticsOverview {
  totalCalls: number;
  callsToday: number;
  callsThisWeek: number;
  activeCalls: number;
  avgDurationSec: number;
  resolutionRate: number;
}
interface CallsPerDayPoint { date: string; count: number }
interface TopCaller { callerNumber: string; count: number; lastCall: string; totalDuration: number }

// ── BentoCard (cursor-glow, matches DashboardPage.tsx) ────────────────────────
function BentoCard({ children, style, glowColor = 'rgba(59,130,246,0.12)' }: {
  children: ReactNode; style?: CSSProperties; glowColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState({ x: 0, y: 0, show: false });

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setGlow({ x: e.clientX - r.left, y: e.clientY - r.top, show: true });
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setGlow((g) => ({ ...g, show: false }))}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16,
        background: T.bgC, border: `1px solid ${T.bdr}`,
        backdropFilter: 'blur(12px)', padding: 24,
        transition: 'border-color 0.2s', ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.bdrH; }}
    >
      {glow.show && (
        <div style={{
          position: 'absolute', pointerEvents: 'none',
          width: 260, height: 260, borderRadius: '50%',
          background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
          left: glow.x - 130, top: glow.y - 130, zIndex: 0,
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>{children}</div>
    </div>
  );
}

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>
        <Icon size={11} style={{ color: T.blueL }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3 }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: T.bdr }} />
    </div>
  );
}

function fmtDuration(sec: number): string {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ── API ──────────────────────────────────────────────────────────────────────
async function fetchOverview(): Promise<AnalyticsOverview> {
  const { data } = await api.get<{ success: boolean; data: AnalyticsOverview }>('/analytics/overview');
  return data.data;
}
async function fetchCallsPerDay(days: number): Promise<CallsPerDayPoint[]> {
  const { data } = await api.get<{ success: boolean; data: CallsPerDayPoint[] }>('/analytics/calls-per-day', { params: { days } });
  return data.data;
}
async function fetchTopCallers(): Promise<TopCaller[]> {
  const { data } = await api.get<{ success: boolean; data: TopCaller[] }>('/analytics/top-callers', { params: { limit: 10 } });
  return data.data;
}

const DAY_RANGES = [7, 30, 90] as const;

// ── Calls-per-day bar chart ────────────────────────────────────────────────────
function CallsPerDayChart({ data }: { data: CallsPerDayPoint[] }) {
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <p style={{ fontSize: 12, color: T.t3 }}>No call data in this range</p>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  // Thin out labels when the range is wide, so they stay legible.
  const labelEvery = data.length > 30 ? 7 : data.length > 14 ? 3 : 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 200 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: data.length > 40 ? 2 : 4 }}>
        {data.map((d, i) => {
          const pct = (d.count / max) * 100;
          const isLatest = i === data.length - 1;
          return (
            <div key={d.date} title={`${d.date}: ${d.count} calls`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%', height: `${Math.max(pct, 3)}%`,
                borderRadius: '3px 3px 1px 1px',
                background: isLatest ? `linear-gradient(to top, ${T.blue}, ${T.blueL})` : 'rgba(59,130,246,0.35)',
                boxShadow: isLatest ? '0 0 10px rgba(59,130,246,0.4)' : 'none',
                transition: 'height 0.3s ease',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: data.length > 40 ? 2 : 4 }}>
        {data.map((d, i) => (
          <div key={d.date} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: T.t3 }}>
            {i % labelEvery === 0 ? new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [days, setDays] = useState<(typeof DAY_RANGES)[number]>(30);

  const overview = useQuery({ queryKey: ['analytics', 'overview'], queryFn: fetchOverview, staleTime: 30_000 });
  const callsPerDay = useQuery({ queryKey: ['analytics', 'calls-per-day', days], queryFn: () => fetchCallsPerDay(days), staleTime: 30_000 });
  const topCallers = useQuery({ queryKey: ['analytics', 'top-callers'], queryFn: fetchTopCallers, staleTime: 30_000 });

  if (overview.isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
        <Loader2 size={28} style={{ color: T.blue, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (overview.isError) {
    const msg = overview.error instanceof Error ? overview.error.message : 'Failed to load analytics';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: 320 }}>
        <AlertCircle size={32} style={{ color: '#ef4444' }} />
        <p style={{ color: '#ef4444', fontSize: 14 }}>{msg}</p>
      </div>
    );
  }

  const o = overview.data!;

  const primaryCards = [
    { label: 'Total Calls', value: o.totalCalls, unit: '', icon: PhoneCall, rgb: '59,130,246' },
    { label: 'Calls Today', value: o.callsToday, unit: '', icon: Activity, rgb: '139,92,246' },
    { label: 'Active Now', value: o.activeCalls, unit: '', icon: Radio, rgb: '16,185,129' },
    { label: 'Resolution Rate', value: o.resolutionRate, unit: '%', icon: CheckCircle2, rgb: '16,185,129' },
  ];
  const secondaryCards = [
    { label: 'Calls This Week', value: o.callsThisWeek, unit: '', icon: CalendarDays, rgb: '96,165,250' },
    { label: 'Avg Duration', value: fmtDuration(o.avgDurationSec), unit: '', icon: Timer, rgb: '245,158,11' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: T.t1, margin: 0 }}>Analytics</h2>
        <p style={{ fontSize: 13, color: T.t3, margin: '4px 0 0' }}>
          Deeper metrics across your voice agent operations
        </p>
      </div>

      {/* Primary KPI row — 4 cards, span 3 of 12 each */}
      <div>
        <SectionLabel icon={Activity}>Overview</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
          {primaryCards.map(({ label, value, unit, icon: Icon, rgb }) => (
            <div key={label} style={{ gridColumn: 'span 3' }}>
              <BentoCard glowColor={`rgba(${rgb},0.12)`}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 8, marginBottom: 14,
                  background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.2)`,
                }}>
                  <Icon size={14} style={{ color: `rgb(${rgb})` }} />
                </div>
                <div style={{
                  fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 6,
                  fontFamily: 'ui-monospace, "SF Mono", monospace',
                  color: T.t1,
                }}>
                  {value}{unit}
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.t2, margin: 0 }}>{label}</p>
              </BentoCard>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary KPI row — 2 cards, span 6 of 12 each */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
        {secondaryCards.map(({ label, value, unit, icon: Icon, rgb }) => (
          <div key={label} style={{ gridColumn: 'span 6' }}>
            <BentoCard glowColor={`rgba(${rgb},0.1)`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.2)`,
                }}>
                  <Icon size={16} style={{ color: `rgb(${rgb})` }} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, fontFamily: 'ui-monospace, "SF Mono", monospace' }}>{value}{unit}</div>
                  <p style={{ fontSize: 11.5, color: T.t3, margin: 0 }}>{label}</p>
                </div>
              </div>
            </BentoCard>
          </div>
        ))}
      </div>

      {/* Calls per day chart */}
      <BentoCard glowColor="rgba(59,130,246,0.07)">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: 0 }}>Call Volume</p>
            <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0' }}>Calls per day</p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 }}>
            {DAY_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 600,
                  background: days === r ? 'rgba(59,130,246,0.2)' : 'transparent',
                  color: days === r ? T.blueL : T.t3,
                  transition: 'all 0.15s',
                }}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        {callsPerDay.isLoading
          ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><Loader2 size={20} style={{ color: T.blue, animation: 'spin 1s linear infinite' }} /></div>
          : <CallsPerDayChart data={callsPerDay.data ?? []} />}
      </BentoCard>

      {/* Top callers */}
      <BentoCard glowColor="rgba(139,92,246,0.07)">
        <div style={{ marginBottom: 4 }}>
          <SectionLabel icon={Trophy}>Top Callers</SectionLabel>
        </div>
        {topCallers.isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <Loader2 size={20} style={{ color: T.blue, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (topCallers.data ?? []).length === 0 ? (
          <p style={{ fontSize: 12, color: T.t3, padding: '20px 0', textAlign: 'center' }}>No caller data yet</p>
        ) : (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 100px 140px 160px',
              padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: T.t3, borderBottom: `1px solid ${T.bdr}`,
            }}>
              <span>#</span>
              <span>Caller</span>
              <span>Calls</span>
              <span>Total Duration</span>
              <span>Last Call</span>
            </div>
            {(topCallers.data ?? []).map((c, i) => (
              <div key={c.callerNumber} style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 100px 140px 160px',
                padding: '10px 8px', fontSize: 12.5, color: T.t2,
                borderBottom: i < (topCallers.data?.length ?? 0) - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none',
                alignItems: 'center',
              }}>
                <span style={{ fontWeight: 700, color: i < 3 ? T.amb : T.t3 }}>{i + 1}</span>
                <span style={{ fontFamily: 'ui-monospace, "SF Mono", monospace', color: T.t1, fontWeight: 600 }}>{c.callerNumber}</span>
                <span>{c.count}</span>
                <span>{fmtDuration(c.totalDuration)}</span>
                <span style={{ color: T.t3, fontSize: 11.5 }}>{new Date(c.lastCall).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            ))}
          </div>
        )}
      </BentoCard>
    </div>
  );
}
