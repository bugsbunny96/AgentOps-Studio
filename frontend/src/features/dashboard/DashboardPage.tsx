/**
 * DashboardPage — home screen after onboarding.
 *
 * Data sources (all via TanStack Query):
 *   GET /api/v1/agents                     → agent record + Vapi IDs
 *   GET /api/v1/analytics/overview          → KPI numbers
 *   GET /api/v1/analytics/calls-per-day     → bar chart data
 *   GET /api/v1/calls?limit=5               → recent calls mini-table
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Zap,
  Bot,
  Globe,
  PhoneCall,
  BookOpen,
  Users,
  ArrowRight,
  Copy,
  CheckCheck,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronRight,
  Activity,
  Phone,
  Timer,
  CheckCircle2,
  BarChart2,
} from 'lucide-react';
import { useAppSelector } from '@/store';
import { api } from '@/utils/api';
import type { VoiceAgent, Call } from '@/types';

// ─── API response shapes ──────────────────────────────────────────────────────

interface AgentListResponse {
  agents: VoiceAgent[];
  vapiPublicKey: string | null;
  vapiAssistantId: string | null;
}

interface AnalyticsOverview {
  totalCalls:     number;
  callsToday:     number;
  callsThisWeek:  number;
  activeCalls:    number;
  avgDurationSec: number;
  totalCostUsd:   number;
  resolutionRate: number;
}

interface CallsPerDayPoint {
  date:  string;
  count: number;
}

interface CallListResponse {
  data:       Call[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  'en-US': 'English',
  'hi-IN': 'Hindi',
  'pa-IN': 'Punjabi',
};

function fmtDuration(sec: number): string {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    hour:  '2-digit',
    minute:'2-digit',
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="ml-1.5 rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      title="Copy"
    >
      {copied ? <CheckCheck size={12} className="text-emerald-500" /> : <Copy size={12} />}
    </button>
  );
}

// ─── KPI Stat Card ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
  loading = false,
}: {
  label:    string;
  value:    string;
  sub?:     string;
  accent:   'emerald' | 'brand' | 'violet' | 'amber';
  icon:     React.ElementType;
  loading?: boolean;
}) {
  const styles: Record<string, string> = {
    emerald: 'from-emerald-50 to-teal-50   border-emerald-100 text-emerald-600 bg-emerald-100',
    brand:   'from-brand-50  to-indigo-50  border-brand-100   text-brand-600   bg-brand-100',
    violet:  'from-violet-50 to-purple-50  border-violet-100  text-violet-600  bg-violet-100',
    amber:   'from-amber-50  to-orange-50  border-amber-100   text-amber-600   bg-amber-100',
  };
  const [gf, gt, bdr, ic, ibg] = styles[accent].split(/\s+/);
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${gf} ${gt} ${bdr} p-5
      hover:shadow-md transition-all duration-200 cursor-default`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
          {loading
            ? <div className="h-7 w-16 rounded-md bg-slate-200 animate-pulse" />
            : <p className="text-xl font-bold text-slate-900 truncate">{value}</p>
          }
          {sub && !loading && <p className="text-xs text-slate-500 mt-1 truncate">{sub}</p>}
        </div>
        <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${ibg} ${ic}`}>
          <Icon size={17} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

function CallsBarChart({
  data,
  loading,
}: {
  data:    CallsPerDayPoint[];
  loading: boolean;
}) {
  const W = 680;
  const H = 140;
  const PAD_L = 28;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 32;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const maxCount = data.length > 0 ? Math.max(...data.map((d) => d.count), 1) : 1;
  const barW     = data.length > 0 ? Math.max((chartW / data.length) - 2, 4) : 8;
  const gap      = data.length > 0 ? (chartW - barW * data.length) / Math.max(data.length - 1, 1) : 0;

  // Y-axis ticks (0, max/2, max)
  const yTicks = [0, Math.round(maxCount / 2), maxCount];

  if (loading) {
    return (
      <div className="flex items-end gap-1 h-[140px] px-1 pt-3">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-slate-100 animate-pulse"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[140px] text-sm text-slate-400">
        No call data yet
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      role="img"
      aria-label="Calls per day bar chart"
    >
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Y-axis gridlines + labels */}
      {yTicks.map((tick) => {
        const y = PAD_T + chartH - (tick / maxCount) * chartH;
        return (
          <g key={tick}>
            <line
              x1={PAD_L} y1={y}
              x2={PAD_L + chartW} y2={y}
              stroke="#e2e8f0" strokeWidth="1"
              strokeDasharray={tick === 0 ? '0' : '4 3'}
            />
            <text
              x={PAD_L - 4} y={y + 4}
              fontSize="9" fill="#94a3b8"
              textAnchor="end"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((pt, i) => {
        const x = PAD_L + i * (barW + gap);
        const barH2 = Math.max((pt.count / maxCount) * chartH, pt.count > 0 ? 2 : 0);
        const y = PAD_T + chartH - barH2;

        // Show date label every 5 days for 30-day range, or every 3 for shorter
        const labelEvery = data.length >= 20 ? 5 : data.length >= 10 ? 3 : 1;
        const showLabel = i % labelEvery === 0 || i === data.length - 1;
        const dateLabel = pt.date.slice(5); // MM-DD

        return (
          <g key={pt.date}>
            <rect
              x={x} y={y}
              width={barW} height={barH2}
              rx="2" ry="2"
              fill={pt.count > 0 ? 'url(#barGrad)' : '#f1f5f9'}
            />
            {showLabel && (
              <text
                x={x + barW / 2}
                y={PAD_T + chartH + 16}
                fontSize="8.5"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {dateLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Setup checklist item ─────────────────────────────────────────────────────

function NextStep({
  done, label, description, action, href,
}: {
  done: boolean; label: string; description: string; action?: string; href?: string;
}) {
  return (
    <div className={`flex items-start gap-4 rounded-xl border p-4 transition-all duration-150
      ${done
        ? 'border-emerald-100 bg-emerald-50/60'
        : 'border-slate-200 bg-white hover:border-brand-200 hover:shadow-sm'
      }`}>
      <div className={`flex-shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full
        ${done ? 'bg-emerald-500' : 'border-2 border-slate-200 bg-white'}`}>
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-emerald-700' : 'text-slate-800'}`}>{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      {!done && action && href && (
        <Link
          to={href}
          className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-brand-600
            hover:text-brand-700 transition-colors"
        >
          {action}
          <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

// ─── Recent Calls mini-table ──────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  active:    'bg-blue-100 text-blue-700',
  failed:    'bg-red-100 text-red-700',
};

function RecentCallsPanel({ calls, loading }: { calls: Call[]; loading: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h2 className="text-sm font-bold text-slate-700">Recent Calls</h2>
        </div>
        <Link to="/calls" className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="divide-y divide-slate-50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-slate-100 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
                <div className="h-2.5 w-24 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="h-5 w-16 rounded-full bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-4 text-center px-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl
            bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-100">
            <Sparkles size={22} className="text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-600">No calls yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Once you connect a phone number, all incoming calls will appear here with transcripts and analytics.
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600
              hover:text-brand-700 border border-brand-200 bg-brand-50 rounded-lg px-3 py-1.5
              hover:bg-brand-100 transition-all"
          >
            Connect a phone number
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {calls.map((call) => (
            <Link
              key={call.id}
              to={`/calls/${call.id}`}
              className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50/60 transition-colors group"
            >
              <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-50">
                <Phone size={13} className="text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{call.callerNumber}</p>
                <p className="text-xs text-slate-400">{fmtDate(call.createdAt)} · {fmtDuration(call.duration)}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[call.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {call.status}
              </span>
              <ChevronRight size={13} className="text-slate-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { currentOrg } = useAppSelector((s) => s.org);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: agentData, isLoading: agentLoading } = useQuery({
    queryKey: ['agents'],
    queryFn:  () => api.get<{ success: boolean; data: AgentListResponse }>('/agents').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn:  () => api.get<{ success: boolean; data: AnalyticsOverview }>('/analytics/overview').then((r) => r.data.data),
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: chartData = [], isLoading: chartLoading } = useQuery({
    queryKey: ['analytics', 'calls-per-day'],
    queryFn:  () => api.get<{ success: boolean; data: CallsPerDayPoint[] }>('/analytics/calls-per-day?days=30').then((r) => r.data.data),
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: recentCalls = [], isLoading: callsLoading } = useQuery({
    queryKey: ['calls', 'recent'],
    queryFn:  () =>
      api.get<CallListResponse>('/calls?limit=5&page=1').then((r) => r.data.data ?? []),
    staleTime: 30 * 1000,
    retry: false,
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const agent          = agentData?.agents?.[0] ?? null;
  const vapiId         = agentData?.vapiAssistantId ?? agent?.vapiAssistantId;
  const vapiIdShort    = vapiId ? `${vapiId.slice(0, 8)}…${vapiId.slice(-4)}` : '—';
  const agentName      = agent?.name ?? currentOrg?.agentName ?? 'Your AI Agent';
  const langs          = (currentOrg?.supportedLanguages ?? [])
    .map((l) => LANG_LABELS[l] ?? l).join(', ') || 'English';

  const setupScore = (() => {
    let s = 0;
    if (agent)                                          s += 40;
    if (currentOrg?.businessDescription)                s += 15;
    if ((currentOrg?.services?.length ?? 0) > 0)       s += 15;
    if ((currentOrg?.faqs?.length ?? 0) > 0)           s += 15;
    if (currentOrg?.fallbackNumber)                     s += 15;
    return s;
  })();

  return (
    <div className="space-y-8">

      {/* ── Hero Banner ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br
        from-slate-900 via-brand-900 to-slate-900 p-8 text-white shadow-xl shadow-brand-900/20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }} />
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64
          rounded-full bg-brand-500 opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48
          rounded-full bg-violet-500 opacity-15 blur-3xl" />

        <div className="relative flex items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30
              bg-emerald-500/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400 tracking-wide">AGENT LIVE</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {agentLoading ? 'Loading…' : agentName}
              </h1>
              <p className="mt-1.5 text-sm text-slate-300 max-w-md">
                {currentOrg?.name
                  ? `${currentOrg.name}'s AI receptionist is active and ready to handle calls.`
                  : 'Your AI receptionist is active and ready to handle calls.'}
              </p>
            </div>
            {vapiId && (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10
                bg-white/5 px-3 py-1.5">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Agent ID</span>
                <code className="text-xs text-slate-200 font-mono">{vapiIdShort}</code>
                <CopyButton text={vapiId} />
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex h-16 w-16 items-center justify-center rounded-2xl
            bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/40">
            <Bot size={30} strokeWidth={1.5} className="text-white" />
          </div>
        </div>
      </div>

      {/* ── KPI Cards (live analytics) ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Calls"
          value={overview ? String(overview.totalCalls) : '—'}
          sub={overview ? `${overview.callsToday} today · ${overview.callsThisWeek} this week` : undefined}
          accent="brand"
          icon={PhoneCall}
          loading={overviewLoading}
        />
        <StatCard
          label="Avg Duration"
          value={overview ? fmtDuration(overview.avgDurationSec) : '—'}
          sub={overview ? `Cost: $${overview.totalCostUsd.toFixed(3)} total` : undefined}
          accent="violet"
          icon={Timer}
          loading={overviewLoading}
        />
        <StatCard
          label="Resolution Rate"
          value={overview ? `${overview.resolutionRate}%` : '—'}
          sub={overview?.activeCalls ? `${overview.activeCalls} active now` : 'Completed calls with AI summary'}
          accent="emerald"
          icon={CheckCircle2}
          loading={overviewLoading}
        />
        <StatCard
          label="Languages"
          value={`${currentOrg?.supportedLanguages?.length ?? 1}`}
          sub={langs}
          accent="amber"
          icon={Globe}
          loading={agentLoading}
        />
      </div>

      {/* ── Calls per Day Chart ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-700">Calls — Last 30 Days</h2>
          </div>
          {overview && (
            <span className="text-xs text-slate-400 font-medium">
              {overview.totalCalls} total
            </span>
          )}
        </div>
        <CallsBarChart data={chartData} loading={chartLoading} />
      </div>

      {/* ── Middle: Quick Actions + Setup Checklist ────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Quick Actions</h2>

          {(
            [
              { to: '/agents',         icon: Bot,      color: 'brand',  label: 'View Agent',      sub: 'Config, prompt & voice' },
              { to: '/agents',         icon: PhoneCall,color: 'indigo', label: 'Test Call',        sub: 'Browser call with your agent' },
              { to: '/settings',       icon: Users,    color: 'violet', label: 'Settings',         sub: 'Phone number & configuration' },
              { to: '/knowledge-base', icon: BookOpen, color: 'amber',  label: 'Knowledge Base',   sub: 'Add docs & FAQs' },
            ] as const
          ).map(({ to, icon: Icon, color, label, sub }) => (
            <Link
              key={to + label}
              to={to}
              className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white
                p-4 hover:border-${color}-300 hover:shadow-md hover:shadow-${color}-500/5 transition-all group`}
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg
                bg-${color}-50 text-${color}-600 group-hover:bg-${color}-100 transition-colors`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{sub}</p>
              </div>
              <ArrowRight size={15} className={`text-slate-300 group-hover:text-${color}-500 transition-colors`} />
            </Link>
          ))}
        </div>

        {/* Setup Checklist */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Complete your setup</h2>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-700"
                  style={{ width: `${setupScore}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-500">{setupScore}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <NextStep
              done={!!agent}
              label="AI agent created"
              description="Your receptionist is live and ready to take calls"
            />
            <NextStep
              done={!!(currentOrg?.businessDescription && (currentOrg.services?.length ?? 0) > 0)}
              label="Business configured"
              description="Description, services, hours and contact info added"
              action="Configure"
              href="/settings"
            />
            <NextStep
              done={(currentOrg?.faqs?.length ?? 0) > 0}
              label="FAQs loaded"
              description="Add common questions to make your agent smarter"
              action="Add FAQs"
              href="/knowledge-base"
            />
            <NextStep
              done={false}
              label="Phone number connected"
              description="Connect an Exotel number so customers can call your agent"
              action="Set up"
              href="/settings"
            />
            <NextStep
              done={(currentOrg?.supportedLanguages?.length ?? 0) > 1}
              label="Multi-language enabled"
              description="Support Hindi and Punjabi callers automatically"
              action="Add languages"
              href="/settings"
            />
            <NextStep
              done={false}
              label="Invite your team"
              description="Add team members to monitor calls and manage the agent"
              action="Invite"
              href="/team"
            />
          </div>
        </div>
      </div>

      {/* ── Recent Calls ───────────────────────────────────────────────────── */}
      <RecentCallsPanel calls={recentCalls as Call[]} loading={callsLoading} />

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      {agent && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2">
          <div className="flex items-center gap-4">
            <span>Agent: <code className="font-mono">{agent.id.slice(-8)}</code></span>
            <span>Lang: <code className="font-mono">{agent.primaryLanguage}</code></span>
            {overview && <span>Active calls: <code className="font-mono">{overview.activeCalls}</code></span>}
          </div>
          <div className="flex items-center gap-1.5">
            <Zap size={10} className="text-brand-400" />
            <span>Powered by AgentOps Studio</span>
          </div>
        </div>
      )}
    </div>
  );
}
