/**
 * DashboardPage — futuristic dark redesign
 * Mirrors the design language of HomePage.tsx:
 * aurora blobs · bento grid · cursor-glow cards · wave bars · gradient numbers
 */

import {
  useState, useRef, useEffect, useCallback, type CSSProperties,
} from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Bot, BookOpen, PhoneCall, ArrowRight, Copy, CheckCheck,
  Timer, CheckCircle2, PhoneOutgoing, X, Loader2, CheckCircle,
  AlertCircle, Activity, Zap, Phone, Settings, TrendingUp, TrendingDown, Minus, Clock,
} from 'lucide-react';
import { useAppSelector } from '@/store';
import { api } from '@/utils/api';
import type { VoiceAgent, Call } from '@/types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:    '#030712',
  bgS:   '#0d1524',
  bgC:   'rgba(255,255,255,0.035)',
  bgH:   'rgba(255,255,255,0.06)',
  bdr:   'rgba(255,255,255,0.07)',
  bdrH:  'rgba(255,255,255,0.15)',
  blue:  '#3b82f6',
  blueL: '#60a5fa',
  violet:'#8b5cf6',
  em:    '#10b981',
  amb:   '#f59e0b',
  rose:  '#f43f5e',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ── Keyframes ─────────────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes dashFloatA {
  0%,100%{ transform:translateY(0px) scale(1); }
  50%    { transform:translateY(-22px) scale(1.04); }
}
@keyframes dashFloatB {
  0%,100%{ transform:translateY(0px) scale(1); }
  60%    { transform:translateY(18px) scale(0.97); }
}
@keyframes dashWaveBar {
  0%,100%{ transform:scaleY(0.25); }
  50%    { transform:scaleY(1); }
}
@keyframes dashPulseDot {
  0%,100%{ opacity:1; transform:scale(1); }
  50%    { opacity:0.6; transform:scale(1.2); }
}
@keyframes dashFadeUp {
  from{ opacity:0; transform:translateY(16px); }
  to  { opacity:1; transform:translateY(0); }
}
@keyframes dashSpin {
  to{ transform:rotate(360deg); }
}
`;

function useInjectStyles() {
  useEffect(() => {
    const id = 'dash-page-keyframes';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = KEYFRAMES;
      document.head.appendChild(s);
    }
  }, []);
}

// ── WaveBars ──────────────────────────────────────────────────────────────────
function WaveBars({ active = true, color = T.blue, count = 5 }: {
  active?: boolean; color?: string; count?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          width: 3, height: 20, borderRadius: 2, background: color,
          transformOrigin: 'bottom',
          animation: active ? `dashWaveBar ${0.6 + i * 0.1}s ease-in-out infinite` : 'none',
          animationDelay: `${i * 0.08}s`,
          transform: active ? undefined : 'scaleY(0.25)',
          opacity: active ? 1 : 0.3,
        }} />
      ))}
    </div>
  );
}

// ── BentoCard ─────────────────────────────────────────────────────────────────
function BentoCard({
  children, style, glowColor = 'rgba(59,130,246,0.12)', noPad = false,
}: {
  children: React.ReactNode; style?: CSSProperties; glowColor?: string; noPad?: boolean;
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
        backdropFilter: 'blur(12px)',
        padding: noPad ? 0 : 24,
        transition: 'border-color 0.2s',
        ...style,
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

// ── Aurora blob ───────────────────────────────────────────────────────────────
function AuroraBlob({ color, x, y, size, delay = 0 }: {
  color: string; x: string; y: string; size: number; delay?: number;
}) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      width: size, height: size, borderRadius: '50%',
      background: color, filter: `blur(${size / 2}px)`,
      animation: `dashFloatA ${6 + delay}s ease-in-out infinite`,
      animationDelay: `${delay}s`, pointerEvents: 'none',
    }} />
  );
}

// ── Call status badge ─────────────────────────────────────────────────────────
function CallStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    completed:   { bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
    'in-progress':{ bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
    failed:      { bg: 'rgba(244,63,94,0.1)',   color: '#f43f5e' },
    missed:      { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  };
  const s = map[status] ?? { bg: 'rgba(71,85,105,0.15)', color: T.t3 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
      padding: '3px 8px', borderRadius: 999, background: s.bg, color: s.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {status.replace('-', ' ')}
    </span>
  );
}

// ── Calls bar chart ───────────────────────────────────────────────────────────
function CallsChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, gap: 12 }}>
        <WaveBars active={false} count={8} color={T.t3} />
        <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>No call data yet</p>
      </div>
    );
  }
  const max  = Math.max(...data.map((d) => d.count), 1);
  const last = data.slice(-14);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 140 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 5 }}>
        {last.map((d, i) => {
          const pct = (d.count / max) * 100;
          const isLatest = i === last.length - 1;
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
              {d.count > 0 && <span style={{ fontSize: 8, color: T.t3 }}>{d.count}</span>}
              <div title={`${d.date}: ${d.count} calls`} style={{
                width: '100%', height: `${Math.max(pct, 4)}%`,
                borderRadius: '4px 4px 2px 2px',
                background: isLatest
                  ? `linear-gradient(to top, ${T.blue}, ${T.blueL})`
                  : 'rgba(59,130,246,0.35)',
                boxShadow: isLatest ? '0 0 10px rgba(59,130,246,0.4)' : 'none',
                transition: 'height 0.4s ease',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {last.map((d) => (
          <div key={d.date} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: T.t3 }}>
            {new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Setup step ────────────────────────────────────────────────────────────────
function SetupStep({
  step, done, label, description, to, linkLabel, index,
}: {
  step: number; done: boolean; label: string; description: string;
  to: string; linkLabel: string; index: number;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 14px', borderRadius: 12,
      background: done ? 'rgba(16,185,129,0.04)' : T.bgC,
      border: `1px solid ${done ? 'rgba(16,185,129,0.15)' : T.bdr}`,
      animation: `dashFadeUp 0.4s ease-out ${index * 0.07}s both`,
    }}>
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: '50%',
        background: done ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.1)',
        border: `1.5px solid ${done ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.25)'}`,
        fontSize: 11, fontWeight: 800,
        color: done ? T.em : T.blueL,
        boxShadow: done ? '0 0 12px rgba(16,185,129,0.15)' : '0 0 10px rgba(59,130,246,0.1)',
      }}>
        {done ? <CheckCircle2 size={14} strokeWidth={2.5} /> : step}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: done ? T.t2 : T.t1, margin: 0 }}>{label}</p>
          {done && <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: T.em, background: 'rgba(16,185,129,0.1)', padding: '1px 5px', borderRadius: 999 }}>Done</span>}
        </div>
        <p style={{ fontSize: 10, color: T.t3, margin: 0 }}>{description}</p>
      </div>
      {!done && (
        <Link to={to} style={{
          flexShrink: 0, fontSize: 11, fontWeight: 600, color: T.blueL,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 10px', borderRadius: 7, textDecoration: 'none', whiteSpace: 'nowrap',
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
        }}>
          {linkLabel} <ArrowRight size={10} />
        </Link>
      )}
    </div>
  );
}

// ── Outbound call modal ───────────────────────────────────────────────────────
function CallNumberModal({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [num, setNum] = useState('');
  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: () => api.post('/calls/initiate', { phoneNumber: num, agentId }),
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 420, borderRadius: 20,
        background: T.bgS, border: `1px solid ${T.bdr}`,
        boxShadow: '0 0 60px rgba(59,130,246,0.15)',
        animation: 'dashFadeUp 0.2s ease-out both', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${T.bdr}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
            }}>
              <PhoneOutgoing size={15} style={{ color: T.blueL }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: 0 }}>Outbound Call</p>
              <p style={{ fontSize: 11, color: T.t3, margin: 0 }}>Enter number to dial</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={22} style={{ color: T.em }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.t1, margin: 0 }}>Call initiated!</p>
              <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>Your agent is dialling {num}</p>
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.t2, display: 'block', marginBottom: 8 }}>
                  Phone number (with country code)
                </label>
                <input
                  value={num}
                  onChange={(e) => setNum(e.target.value)}
                  placeholder="+91 98765 43210"
                  onKeyDown={(e) => e.key === 'Enter' && num.trim().length >= 7 && mutate()}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 14px', borderRadius: 10,
                    background: T.bgC, border: `1px solid ${T.bdr}`,
                    color: T.t1, fontSize: 14, outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = T.blue; }}
                  onBlur={(e)  => { e.target.style.borderColor = T.bdr; }}
                />
              </div>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <AlertCircle size={13} style={{ color: T.rose, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#f87171' }}>Failed to initiate call. Please try again.</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${T.bdr}`,
                  background: 'transparent', color: T.t2, fontSize: 13, cursor: 'pointer',
                }}>
                  Cancel
                </button>
                <button
                  onClick={() => mutate()}
                  disabled={isPending || num.trim().length < 7}
                  style={{
                    flex: 2, padding: '10px 0', borderRadius: 10, border: 'none',
                    background: `linear-gradient(135deg, ${T.blue}, ${T.violet})`,
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: isPending || num.trim().length < 7 ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {isPending
                    ? <><Loader2 size={14} style={{ animation: 'dashSpin 1s linear infinite' }} /> Connecting…</>
                    : <><Phone size={14} /> Call Now</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Trial Banner ──────────────────────────────────────────────────────────────
interface BillingStatus {
  isInTrial:      boolean;
  isTrialExpired: boolean;
  trialDaysLeft:  number;
  trialEndsAt:    string | null;
  callMinutes:    { used: number; limit: number | null; resetAt: string };
}

function TrialBanner({ billing }: { billing: BillingStatus }) {
  if (!billing.isInTrial && !billing.isTrialExpired) return null;

  const urgent = billing.isTrialExpired || billing.trialDaysLeft <= 2;
  const bg     = urgent ? 'rgba(244,63,94,0.08)' : 'rgba(245,158,11,0.08)';
  const bdr    = urgent ? 'rgba(244,63,94,0.25)' : 'rgba(245,158,11,0.25)';
  const color  = urgent ? '#f87171'              : '#fbbf24';
  const icon   = billing.isTrialExpired ? AlertCircle : Clock;
  const Icon   = icon;

  const message = billing.isTrialExpired
    ? 'Your free trial has expired. Upgrade to keep your AI agent running.'
    : billing.trialDaysLeft <= 1
      ? 'Your free trial expires today! Upgrade now to avoid interruption.'
      : `Your free trial ends in ${billing.trialDaysLeft} days. Upgrade to keep full access.`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '12px 20px', borderRadius: 12,
      background: bg, border: `1px solid ${bdr}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={15} style={{ color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color, fontWeight: 500 }}>{message}</span>
      </div>
      <a
        href="/billing"
        style={{
          flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff',
          padding: '6px 14px', borderRadius: 8, textDecoration: 'none',
          background: urgent
            ? 'linear-gradient(135deg,#f43f5e,#e11d48)'
            : 'linear-gradient(135deg,#f59e0b,#d97706)',
          whiteSpace: 'nowrap',
        }}
      >
        Upgrade now
      </a>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export function DashboardPage() {
  useInjectStyles();
  const { currentOrg } = useAppSelector((s) => s.org);
  const [showCallModal, setShowCallModal] = useState(false);
  const [copiedPhone,   setCopiedPhone]   = useState(false);

  // ── Data queries ─────────────────────────────────────────────────────────────
  const { data: billingStatus } = useQuery<BillingStatus>({
    queryKey: ['billing', 'status'],
    queryFn: () => api.get('/billing/status').then((r) => r.data?.data ?? r.data),
    staleTime: 5 * 60_000,
  });

  const { data: agents = [] } = useQuery<VoiceAgent[]>({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents').then((r) => r.data?.agents ?? r.data ?? []),
    refetchInterval: 60_000,
  });

  const { data: callStats } = useQuery<{ total: number; today: number; avgDuration: number; completionRate: number }>({
    queryKey: ['calls', 'stats'],
    queryFn: () => api.get('/calls/stats').then((r) => r.data?.data ?? r.data),
    refetchInterval: 30_000,
  });

  const { data: recentCalls = [] } = useQuery<Call[]>({
    queryKey: ['calls', 'recent'],
    queryFn: () => api.get('/calls?limit=6').then((r) => r.data?.calls ?? r.data ?? []),
    refetchInterval: 30_000,
  });

  const { data: callsByDay = [] } = useQuery<{ date: string; count: number }[]>({
    queryKey: ['calls', 'by-day'],
    queryFn: () => api.get('/calls/stats/by-day').then((r) => r.data?.data ?? r.data ?? []),
    refetchInterval: 30_000,
  });

  const { data: kbStatus } = useQuery<{ total: number }>({
    queryKey: ['kb', 'status'],
    queryFn: () => api.get('/knowledge-base/status').then((r) => r.data?.data ?? r.data),
    refetchInterval: 60_000,
  });

  // ── Derived state ─────────────────────────────────────────────────────────────
  const primaryAgent   = agents[0];
  const isAgentLive    = Boolean(currentOrg?.vapiAssistantId);
  const kbDocCount     = kbStatus?.total ?? (currentOrg as any)?.kbDocCount ?? 0;
  const orgPhone       = currentOrg?.exotelPhoneNumber;
  const totalCalls     = callStats?.total          ?? 0;
  const callsToday     = callStats?.today           ?? 0;
  const avgDuration    = callStats?.avgDuration     ?? 0;
  const completionRate = callStats?.completionRate  ?? 0;

  const fmtDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  const copyPhone = () => {
    if (!orgPhone) return;
    navigator.clipboard.writeText(orgPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // ── Setup steps ───────────────────────────────────────────────────────────────
  const steps = [
    { label: 'Create AI Agent',     description: 'Configure your voice agent personality, language, and behaviour.', to: '/agents',         linkLabel: 'Create agent',    done: Boolean(primaryAgent) },
    { label: 'Add Knowledge Base',  description: 'Crawl your website or upload documents for the agent to reference.', to: '/knowledge-base', linkLabel: 'Add knowledge',   done: kbDocCount > 0 },
    { label: 'Get a Phone Number',  description: 'Assign an Exotel number so your agent can receive inbound calls.', to: '/settings',       linkLabel: 'Configure number', done: Boolean(orgPhone) },
    { label: 'Go Live',             description: 'Publish your agent and start receiving customer calls.',            to: '/agents',         linkLabel: 'Publish agent',    done: isAgentLive },
  ] as const;

  const doneCount   = steps.filter((s) => s.done).length;
  const allDone     = doneCount === steps.length;
  const progressPct = (doneCount / steps.length) * 100;

  // ── KPI cards config ──────────────────────────────────────────────────────────
  const kpiCards = [
    { label: 'Total Calls',    value: totalCalls,                    unit: '',  icon: PhoneCall,   color: T.blueL,  rgb: '59,130,246',   grad: `linear-gradient(135deg,${T.t1},${T.blueL})` },
    { label: 'Calls Today',    value: callsToday,                    unit: '',  icon: Activity,    color: T.violet, rgb: '139,92,246',   grad: `linear-gradient(135deg,${T.t1},${T.violet})` },
    { label: 'Completion',     value: completionRate,                 unit: '%', icon: CheckCircle2,color: T.em,     rgb: '16,185,129',   grad: `linear-gradient(135deg,${T.t1},${T.em})` },
    { label: 'Avg Duration',   value: fmtDuration(avgDuration),      unit: '',  icon: Timer,       color: T.amb,    rgb: '245,158,11',   grad: `linear-gradient(135deg,${T.t1},${T.amb})` },
  ];

  // ── Quick actions config ──────────────────────────────────────────────────────
  const quickActions = [
    { icon: Bot,      label: 'Manage Agents',    desc: `${agents.length} configured`,      to: '/agents',         color: T.blueL,  bg: 'rgba(59,130,246,0.1)',  bdr: 'rgba(59,130,246,0.2)'  },
    { icon: BookOpen, label: 'Knowledge Base',   desc: `${kbDocCount} docs indexed`,        to: '/knowledge-base', color: T.violet, bg: 'rgba(139,92,246,0.1)', bdr: 'rgba(139,92,246,0.2)' },
    { icon: PhoneCall,label: 'Call Logs',        desc: `${totalCalls} calls recorded`,      to: '/calls',          color: T.em,     bg: 'rgba(16,185,129,0.1)', bdr: 'rgba(16,185,129,0.2)' },
    { icon: Settings, label: 'Settings',         desc: 'Phone · integrations · billing',    to: '/settings',       color: T.amb,    bg: 'rgba(245,158,11,0.1)', bdr: 'rgba(245,158,11,0.2)' },
  ];

  return (
    <>
      {/* Global grid dot */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(59,130,246,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59,130,246,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── TRIAL BANNER ─────────────────────────────────────────────── */}
        {billingStatus && (billingStatus.isInTrial || billingStatus.isTrialExpired) && (
          <TrialBanner billing={billingStatus} />
        )}

        {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
        <div style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          background: `linear-gradient(135deg, ${T.bgS} 0%, #0a1628 50%, #0d1a30 100%)`,
          border: `1px solid ${T.bdr}`,
          padding: '28px 32px',
        }}>
          {/* Aurora */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <AuroraBlob color="rgba(59,130,246,0.08)"  x="-80px" y="-60px" size={320} delay={0} />
            <AuroraBlob color="rgba(139,92,246,0.06)"  x="60%"   y="-40px" size={280} delay={2} />
            <AuroraBlob color="rgba(16,185,129,0.05)"  x="80%"   y="30%"   size={200} delay={4} />
          </div>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            {/* Left */}
            <div style={{ flex: 1, minWidth: 260 }}>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <WaveBars active={isAgentLive} color={isAgentLive ? T.em : T.amb} count={5} />
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: isAgentLive ? T.em : T.amb,
                }}>
                  {isAgentLive ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.em, boxShadow: `0 0 6px ${T.em}`, animation: 'dashPulseDot 2s infinite', display: 'inline-block' }} />
                      Agent Live
                    </span>
                  ) : 'Setup in progress'}
                </span>
              </div>

              <h1 style={{
                fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em',
                background: `linear-gradient(135deg, ${T.t1} 0%, ${T.blueL} 60%, ${T.violet} 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                margin: '0 0 6px',
              }}>
                {currentOrg?.name ?? 'Your Organisation'}
              </h1>

              <p style={{ fontSize: 13, color: T.t2, margin: 0 }}>
                {primaryAgent
                  ? <>Agent <strong style={{ color: T.t1 }}>{primaryAgent.name}</strong> is handling your calls</>
                  : 'Complete setup to activate your AI voice agent'}
              </p>

              {/* Phone number */}
              {orgPhone && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 14,
                  padding: '7px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.bdr}`,
                }}>
                  <Phone size={12} style={{ color: T.t3 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.t1, fontFamily: 'monospace' }}>{orgPhone}</span>
                  <button onClick={copyPhone} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 2 }} title="Copy">
                    {copiedPhone ? <CheckCheck size={12} style={{ color: T.em }} /> : <Copy size={12} />}
                  </button>
                </div>
              )}
            </div>

            {/* Right: mini stat trio */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Today',    value: callsToday,           color: T.blueL,  icon: Activity   },
                { label: 'Total',    value: totalCalls,            color: T.violet, icon: PhoneCall  },
                { label: 'Avg Dur',  value: fmtDuration(avgDuration), color: T.em, icon: Timer      },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  width: 96, height: 84, borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.bdr}`,
                  gap: 3,
                }}>
                  <Icon size={13} style={{ color, marginBottom: 1 }} />
                  <span style={{
                    fontSize: 20, fontWeight: 800, letterSpacing: '-0.04em',
                    background: `linear-gradient(135deg, ${T.t1}, ${color})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                    {value}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.t3 }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA row */}
          {isAgentLive && primaryAgent && (
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.bdr}` }}>
              <button
                onClick={() => setShowCallModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 20px', borderRadius: 10, border: 'none',
                  background: `linear-gradient(135deg, ${T.blue}, ${T.violet})`,
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(59,130,246,0.3)',
                }}
              >
                <PhoneOutgoing size={14} /> Make a Call
              </button>
              <Link to="/calls" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 20px', borderRadius: 10,
                border: `1px solid ${T.bdr}`, background: 'transparent',
                color: T.t2, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>
                <PhoneCall size={14} /> View All Calls
              </Link>
            </div>
          )}
        </div>

        {/* ── KPI BENTO GRID ────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <Activity size={11} style={{ color: T.blueL }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3 }}>Performance</span>
            <div style={{ flex: 1, height: 1, background: T.bdr }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {kpiCards.map(({ label, value, unit, icon: Icon, color, rgb, grad }) => (
              <BentoCard key={label} glowColor={`rgba(${rgb},0.12)`} style={{ animation: 'dashFadeUp 0.4s ease-out both' }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 8,
                    background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.2)`,
                  }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                </div>
                <div style={{
                  fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6,
                  background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {String(value)}{unit}
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.t2, margin: 0 }}>{label}</p>
              </BentoCard>
            ))}
          </div>
        </div>

        {/* ── CHART + QUICK ACTIONS ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          <BentoCard glowColor="rgba(59,130,246,0.07)">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: 0 }}>Call Activity</p>
                <p style={{ fontSize: 10, color: T.t3, margin: '2px 0 0' }}>Last 14 days</p>
              </div>
              <WaveBars active={callsByDay.length > 0} color={T.blue} count={4} />
            </div>
            <CallsChart data={callsByDay} />
          </BentoCard>

          <BentoCard glowColor="rgba(139,92,246,0.07)">
            <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: '0 0 14px' }}>Quick Actions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {quickActions.map(({ icon: Icon, label, desc, to, color, bg, bdr }) => (
                <Link key={to} to={to} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10, textDecoration: 'none',
                  background: bg, border: `1px solid ${bdr}`, transition: 'filter 0.15s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
                >
                  <Icon size={14} style={{ color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.t1, margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 10, color: T.t3, margin: 0 }}>{desc}</p>
                  </div>
                  <ArrowRight size={11} style={{ color: T.t3, flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          </BentoCard>
        </div>

        {/* ── SETUP CHECKLIST + RECENT CALLS ───────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: allDone ? '1fr' : '1fr 1fr', gap: 12 }}>

          {/* Checklist */}
          {!allDone && (
            <BentoCard glowColor="rgba(59,130,246,0.09)">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: 0 }}>Setup Checklist</p>
                  <p style={{ fontSize: 10, color: T.t3, margin: '2px 0 0' }}>{doneCount} of {steps.length} complete</p>
                </div>
                <span style={{
                  fontSize: 20, fontWeight: 800, letterSpacing: '-0.04em',
                  background: `linear-gradient(135deg, ${T.blue}, ${T.violet})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {Math.round(progressPct)}%
                </span>
              </div>
              {/* Progress track */}
              <div style={{ height: 3, background: T.bdr, borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: `linear-gradient(90deg, ${T.blue}, ${T.violet})`,
                  width: `${progressPct}%`, transition: 'width 0.5s ease',
                  boxShadow: '0 0 8px rgba(59,130,246,0.5)',
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {steps.map((s, i) => (
                  <SetupStep key={s.label} step={i + 1} index={i} {...s} />
                ))}
              </div>
            </BentoCard>
          )}

          {/* Recent calls */}
          <BentoCard glowColor="rgba(139,92,246,0.07)" noPad>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${T.bdr}` }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: 0 }}>Recent Calls</p>
                <p style={{ fontSize: 10, color: T.t3, margin: '2px 0 0' }}>Latest activity</p>
              </div>
              <Link to="/calls" style={{
                fontSize: 11, fontWeight: 600, color: T.blueL, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 7,
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              }}>
                View all <ArrowRight size={10} />
              </Link>
            </div>

            {recentCalls.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 24px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PhoneCall size={18} style={{ color: T.t3 }} />
                </div>
                <p style={{ fontSize: 12, color: T.t3, margin: 0, textAlign: 'center' }}>
                  No calls yet.<br />
                  <span style={{ color: T.blueL }}>{isAgentLive ? 'Share your number to get started.' : 'Complete setup to go live.'}</span>
                </p>
              </div>
            ) : (
              recentCalls.slice(0, 6).map((call, i) => {
                const callId = call.id ?? (call as any)._id;
                const dt  = new Date(call.createdAt);
                const lbl = dt.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                const tm  = dt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
                return (
                  <Link
                    key={callId}
                    to={`/calls/${callId}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 24px',
                      borderBottom: i < recentCalls.length - 1 ? `1px solid ${T.bdr}` : 'none',
                      textDecoration: 'none', transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.14)',
                    }}>
                      <Phone size={12} style={{ color: T.blueL }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.t1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {call.callerNumber ?? (call as any).toNumber ?? 'Unknown'}
                      </p>
                      <p style={{ fontSize: 10, color: T.t3, margin: 0 }}>
                        {lbl} · {tm}{call.duration ? ` · ${fmtDuration(call.duration)}` : ''}
                      </p>
                    </div>
                    <CallStatusBadge status={call.status} />
                  </Link>
                );
              })
            )}
          </BentoCard>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Zap size={10} style={{ color: T.t3 }} />
          <span style={{ fontSize: 10, color: T.t3 }}>AgentOps Studio · AI Voice Agents for Indian SMBs</span>
        </div>

      </div>

      {/* Outbound call modal */}
      {showCallModal && primaryAgent && (
        <CallNumberModal agentId={primaryAgent.id ?? (primaryAgent as any)._id} onClose={() => setShowCallModal(false)} />
      )}
    </>
  );
}

export default DashboardPage;
