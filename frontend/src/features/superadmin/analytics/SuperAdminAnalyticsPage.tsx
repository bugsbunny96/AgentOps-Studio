/**
 * SuperAdminAnalyticsPage
 * Route: /superadmin/analytics
 *
 * Sections (single scrollable page with tab-driven range):
 *  1. Time range selector  — 7d / 30d / 90d
 *  2. Summary KPI strip    — total calls / new orgs / conversion rate / avg duration / failed rate
 *  3. Call volume bar chart (SVG)
 *  4. Direction donut      (SVG)
 *  5. Sign-up trend        (SVG area sparkline)
 *  6. Onboarding funnel    (horizontal bars)
 *  7. Revenue section      — MRR / ARR / ARPU / LTV + plan revenue table + MRR-by-month chart
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Phone, Building2, TrendingUp, Clock, XCircle, DollarSign, BarChart2, Users } from 'lucide-react';
import api from '@/utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayCallStat {
  _id:           string; // "YYYY-MM-DD"
  total:         number;
  failed:        number;
  completed:     number;
  inbound:       number;
  outbound:      number;
  totalDuration: number;
}

interface DaySignupStat { _id: string; count: number; }

interface AnalyticsData {
  callsPerDay:       DayCallStat[];
  signupsPerDay:     DaySignupStat[];
  totalCallsRange:   number;
  failedCallsRange:  number;
  avgDuration:       number;
  totalOrgsRange:    number;
  directionBreakdown: Array<{ _id: string; count: number }>;
  funnelStages:       Array<{ _id: string; count: number }>;
  conversionRate:    number;
  paidOrgs:          number;
  totalOrgs:         number;
}

interface RevenueData {
  totalMrr:      number;
  arr:           number;
  arpu:          number;
  ltv:           number;
  paidOrgs:      number;
  revenueByPlan: Array<{ plan: string; count: number; unitPrice: number; mrr: number }>;
  mrrByMonth:    Array<{ _id: string; starter: number; growth: number; enterprise: number; newOrgs: number }>;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)',
  red: '#ef4444', green: '#10b981', amber: '#f59e0b',
  blue: '#3b82f6', violet: '#8b5cf6', cyan: '#06b6d4',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

const PLAN_COLOR: Record<string, string> = {
  free: T.t3, starter: T.blue, growth: T.green, enterprise: T.violet,
};

const FUNNEL_ORDER = ['REGISTRATION', 'ORG_CREATION', 'WEBSITE_CRAWL', 'BUSINESS_CONFIG', 'VOICE_SETUP', 'COMPLETED'];
const FUNNEL_LABEL: Record<string, string> = {
  REGISTRATION:  'Registered',
  ORG_CREATION:  'Created Org',
  WEBSITE_CRAWL: 'Website Crawl',
  BUSINESS_CONFIG:'Business Config',
  VOICE_SETUP:   'Voice Setup',
  COMPLETED:     'Completed',
};

const fmt    = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000   ? `₹${(n / 1000).toFixed(1)}K`   : `₹${n}`;
const fmtSec = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

// ─── SVG helpers ──────────────────────────────────────────────────────────────

/** Minimal bar chart — renders N vertical bars, coloured by value */
function BarChart({ data, labelKey, valueKey, color, height = 120 }: {
  data: Record<string, number | string>[];
  labelKey: string; valueKey: string;
  color: string; height?: number;
}) {
  if (data.length === 0) {
    return <p style={{ color: T.t3, fontSize: 13, textAlign: 'center', padding: 20 }}>No data in this range.</p>;
  }
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  const W = 700;
  const barW = Math.max(6, Math.floor(W / data.length) - 2);

  return (
    <svg viewBox={`0 0 ${W} ${height + 24}`} style={{ width: '100%', display: 'block' }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]);
        const bh  = Math.max(2, Math.round((val / max) * height));
        const x   = (i / data.length) * W + (W / data.length - barW) / 2;
        const y   = height - bh;
        // Show label every ~7 items
        const showLabel = data.length <= 14 || i % Math.ceil(data.length / 14) === 0;
        const label = String(d[labelKey]).slice(5); // strip "YYYY-"
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={3} fill={color} opacity={0.85} />
            {showLabel && (
              <text x={x + barW / 2} y={height + 18} textAnchor="middle" fontSize={9} fill={T.t3}>{label}</text>
            )}
            {/* Hover tooltip via SVG title */}
            <title>{`${d[labelKey]}: ${val}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/** Donut chart for 2-segment direction breakdown */
function DirectionDonut({ inbound, outbound }: { inbound: number; outbound: number }) {
  const total = inbound + outbound;
  if (total === 0) return <p style={{ color: T.t3, fontSize: 13, textAlign: 'center' }}>No calls.</p>;

  const pctIn = inbound / total;
  const R = 52; const CX = 64; const CY = 64;
  const circ = 2 * Math.PI * R;
  const inLen = pctIn * circ;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        {/* Background ring */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={T.bgC} strokeWidth={18} />
        {/* Inbound arc */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={T.blue} strokeWidth={18}
          strokeDasharray={`${inLen} ${circ - inLen}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round" />
        {/* Outbound arc */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={T.green} strokeWidth={18}
          strokeDasharray={`${circ - inLen} ${inLen}`}
          strokeDashoffset={circ / 4 - inLen}
          strokeLinecap="round" />
        <text x={CX} y={CY - 5}  textAnchor="middle" fontSize={14} fontWeight="800" fill={T.t1}>{total}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize={9}  fill={T.t3}>calls</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: T.blue }} />
            <span style={{ fontSize: 12, color: T.t2 }}>Inbound</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.t1 }}>{inbound.toLocaleString()}</span>
          <span style={{ fontSize: 11, color: T.t3, marginLeft: 6 }}>{Math.round(pctIn * 100)}%</span>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: T.green }} />
            <span style={{ fontSize: 12, color: T.t2 }}>Outbound</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.t1 }}>{outbound.toLocaleString()}</span>
          <span style={{ fontSize: 11, color: T.t3, marginLeft: 6 }}>{Math.round((1 - pctIn) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

/** Stacked MRR bar chart by month */
function MrrChart({ data }: { data: RevenueData['mrrByMonth'] }) {
  if (data.length === 0) {
    return <p style={{ color: T.t3, fontSize: 13, textAlign: 'center', padding: 20 }}>No paid orgs in last 12 months.</p>;
  }

  const maxMrr = Math.max(...data.map((d) => d.starter + d.growth + d.enterprise), 1);
  const H = 100; const W = 700;
  const barW = Math.max(8, Math.floor(W / data.length) - 4);

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} style={{ width: '100%', display: 'block' }}>
      {data.map((d, i) => {
        const total = d.starter + d.growth + d.enterprise;
        const x = (i / data.length) * W + (W / data.length - barW) / 2;
        const totalH = Math.max(2, Math.round((total / maxMrr) * H));
        const growthH = Math.round((d.growth / maxMrr) * H);
        const entH = Math.round((d.enterprise / maxMrr) * H);
        const starterH = Math.max(0, totalH - growthH - entH);

        let yOff = H;
        const segs = [
          { h: starterH, color: T.blue },
          { h: growthH,  color: T.green },
          { h: entH,     color: T.violet },
        ];

        return (
          <g key={i}>
            {segs.map((seg, si) => {
              if (seg.h <= 0) return null;
              yOff -= seg.h;
              return <rect key={si} x={x} y={yOff} width={barW} height={seg.h} rx={si === 0 ? 3 : 0} fill={seg.color} opacity={0.85} />;
            })}
            <text x={x + barW / 2} y={H + 18} textAnchor="middle" fontSize={9} fill={T.t3}>{d._id.slice(5)}</text>
            <title>{`${d._id}: ₹${total.toLocaleString()}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 20, fontWeight: 900, color: T.t1, margin: '3px 0 2px' }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: T.t3, margin: 0 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: '0 0 18px' }}>{title}</h2>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperAdminAnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data: analytics, isLoading: loadingA } = useQuery({
    queryKey: ['sa-analytics', days],
    queryFn:  async () => {
      const r = await api.get(`/superadmin/analytics?days=${days}`);
      return r.data.data as AnalyticsData;
    },
  });

  const { data: revenue, isLoading: loadingR } = useQuery({
    queryKey: ['sa-revenue'],
    queryFn:  async () => {
      const r = await api.get('/superadmin/analytics/revenue');
      return r.data.data as RevenueData;
    },
  });

  const isLoading = loadingA || loadingR;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Loader2 size={28} color={T.red} style={{ animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const a = analytics!;
  const r = revenue!;

  const inbound  = a.directionBreakdown.find((d) => d._id === 'Inbound')?.count  ?? 0;
  const outbound = a.directionBreakdown.find((d) => d._id === 'Outbound')?.count ?? 0;

  const funnelMax = Math.max(...a.funnelStages.map((f) => f.count), 1);
  const sortedFunnel = [...a.funnelStages].sort(
    (a, b) => FUNNEL_ORDER.indexOf(a._id) - FUNNEL_ORDER.indexOf(b._id)
  );

  const failedRate = a.totalCallsRange > 0
    ? Math.round((a.failedCallsRange / a.totalCallsRange) * 100)
    : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: 0 }}>Platform Analytics</h1>
          <p style={{ fontSize: 13, color: T.t2, margin: '4px 0 0' }}>Cross-org call, growth, and revenue metrics.</p>
        </div>
        {/* Range tabs */}
        <div style={{ display: 'flex', gap: 6, background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: 4 }}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                background: days === d ? T.red : 'transparent',
                color:      days === d ? '#fff' : T.t3,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={Phone}     label={`Calls (${days}d)`}   value={a.totalCallsRange.toLocaleString()}   sub="total completed + failed" color={T.blue}   />
        <KpiCard icon={Building2} label={`New Orgs (${days}d)`}value={a.totalOrgsRange.toLocaleString()}    sub="sign-ups in window"       color={T.violet} />
        <KpiCard icon={TrendingUp}label="Conversion"           value={`${a.conversionRate}%`}              sub={`${a.paidOrgs} / ${a.totalOrgs} orgs paid`} color={T.green} />
        <KpiCard icon={Clock}     label="Avg Duration"          value={fmtSec(a.avgDuration)}               sub="completed calls only"     color={T.amber}  />
        <KpiCard icon={XCircle}   label="Failed Rate"           value={`${failedRate}%`}                   sub={`${a.failedCallsRange} failed`} color={failedRate > 20 ? T.red : T.t3} />
      </div>

      {/* Call Volume + Direction side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <Section title={`Daily Call Volume — last ${days} days`}>
          <BarChart
            data={a.callsPerDay as unknown as Record<string, number | string>[]}
            labelKey="_id"
            valueKey="total"
            color={T.blue}
          />
        </Section>
        <Section title="Call Direction">
          <DirectionDonut inbound={inbound} outbound={outbound} />
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.bdr}` }}>
            {a.callsPerDay.length > 0 && (() => {
              const failed = a.callsPerDay.reduce((s, d) => s + d.failed, 0);
              const total  = a.callsPerDay.reduce((s, d) => s + d.total, 0);
              return (
                <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>
                  {total} calls · <span style={{ color: T.red }}>{failed} failed</span>
                </p>
              );
            })()}
          </div>
        </Section>
      </div>

      {/* Sign-up trend + Onboarding funnel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Section title={`New Org Sign-ups — last ${days} days`}>
          <BarChart
            data={a.signupsPerDay as unknown as Record<string, number | string>[]}
            labelKey="_id"
            valueKey="count"
            color={T.violet}
            height={90}
          />
        </Section>

        <Section title="Onboarding Funnel (all-time)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedFunnel.map((stage) => {
              const pct = Math.round((stage.count / funnelMax) * 100);
              const isCompleted = stage._id === 'COMPLETED';
              return (
                <div key={stage._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: isCompleted ? T.green : T.t2 }}>
                      {FUNNEL_LABEL[stage._id] ?? stage._id}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>{stage.count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: T.bgC, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: isCompleted ? T.green : T.blue,
                      borderRadius: 999, transition: 'width .5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* ── Revenue Section ─────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${T.bdr}`, paddingTop: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: T.t1, margin: '0 0 16px' }}>Revenue Analytics</h2>

        {/* Revenue KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          <KpiCard icon={DollarSign} label="MRR"        value={fmt(r.totalMrr)}       sub={`ARR ${fmt(r.arr)}`}           color={T.green}  />
          <KpiCard icon={TrendingUp} label="ARR"        value={fmt(r.arr)}             sub="monthly × 12"                  color={T.blue}   />
          <KpiCard icon={BarChart2}  label="ARPU"       value={fmt(r.arpu)}            sub="per paying org / month"        color={T.amber}  />
          <KpiCard icon={Users}      label="Est. LTV"   value={fmt(r.ltv)}             sub="ARPU ÷ 5% churn assumption"    color={T.violet} />
        </div>

        {/* MRR by month chart + plan revenue table */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
          <Section title="MRR Growth — last 12 months (new paid orgs)">
            <MrrChart data={r.mrrByMonth} />
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              {[{ label: 'Starter', col: T.blue }, { label: 'Growth', col: T.green }, { label: 'Enterprise', col: T.violet }].map(({ label, col }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: col }} />
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Revenue by Plan">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
                  {['Plan', 'Orgs', '₹/mo', 'MRR'].map((h) => (
                    <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T.t3, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.revenueByPlan.map((row) => (
                  <tr key={row.plan} style={{ borderBottom: `1px solid ${T.bdr}` }}>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: PLAN_COLOR[row.plan] ?? T.t3, textTransform: 'capitalize' }}>{row.plan}</span>
                    </td>
                    <td style={{ padding: '10px 0', fontSize: 12, color: T.t2 }}>{row.count}</td>
                    <td style={{ padding: '10px 0', fontSize: 12, color: T.t2 }}>
                      {row.unitPrice > 0 ? `₹${row.unitPrice.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '10px 0', fontSize: 13, fontWeight: 700, color: row.mrr > 0 ? T.green : T.t3 }}>
                      {row.mrr > 0 ? fmt(row.mrr) : '₹0'}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr>
                  <td colSpan={3} style={{ padding: '12px 0 0', fontSize: 12, fontWeight: 700, color: T.t2 }}>Total MRR</td>
                  <td style={{ padding: '12px 0 0', fontSize: 15, fontWeight: 900, color: T.green }}>{fmt(r.totalMrr)}</td>
                </tr>
              </tbody>
            </table>
          </Section>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
