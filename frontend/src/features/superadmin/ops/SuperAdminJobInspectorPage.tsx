/**
 * Super Admin — BullMQ Job Inspector
 *
 * Shows waiting / active / completed / failed / delayed counts for each queue.
 * Actions: Retry failed, Clean completed/failed, Pause, Resume.
 * Expandable "Failed jobs" drawer per queue.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, RefreshCw, Play, Pause, Trash2, RotateCcw, ChevronDown, ChevronRight,
  Clock, Zap, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';
import api from '@/utils/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:    '#07070f',
  bgS:   '#0e0e1a',
  bgC:   'rgba(255,255,255,0.04)',
  bdr:   'rgba(255,255,255,0.07)',
  bdrB:  'rgba(255,255,255,0.12)',
  red:   '#ef4444',
  redL:  '#fca5a5',
  green: '#22c55e',
  greenL:'#bbf7d0',
  amber: '#f59e0b',
  amberL:'#fde68a',
  blue:  '#3b82f6',
  blueL: '#93c5fd',
  purple:'#a855f7',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueStats {
  id:        string;
  label:     string;
  waiting:   number;
  active:    number;
  completed: number;
  failed:    number;
  delayed:   number;
  paused:    number;
  isPaused:  boolean;
}

interface FailedJob {
  id?:          string;
  name:         string;
  failedReason?: string;
  attemptsMade: number;
  timestamp:    number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const fetchQueueStats = (): Promise<QueueStats[]> =>
  api.get('/superadmin/jobs').then(r => (r.data as { data: QueueStats[] }).data);

const fetchFailedJobs = (queueId: string): Promise<FailedJob[]> =>
  api.get(`/superadmin/jobs/${queueId}/failed`).then(r => (r.data as { data: FailedJob[] }).data);

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 14px', borderRadius: 8,
      background: `${color}10`, border: `1px solid ${color}25`,
      minWidth: 70,
    }}>
      <div style={{ color, marginBottom: 4 }}>{icon}</div>
      <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: T.t3, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  );
}

function ActionButton({ onClick, label, icon, variant = 'default', disabled }: {
  onClick:  () => void;
  label:    string;
  icon:     React.ReactNode;
  variant?: 'default' | 'danger' | 'success' | 'amber';
  disabled?: boolean;
}) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    default: { bg: T.bgC, border: T.bdr, color: T.t2 },
    danger:  { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  color: T.red   },
    success: { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  color: T.green },
    amber:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', color: T.amber },
  };
  const c = colors[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 7,
        border: `1px solid ${c.border}`,
        background: c.bg, color: c.color,
        fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function FailedJobsDrawer({ queueId }: { queueId: string }) {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['sa-failed-jobs', queueId],
    queryFn:  () => fetchFailedJobs(queueId),
  });

  if (isLoading) return (
    <div style={{ padding: '12px 18px', color: T.t3, fontSize: 12 }}>Loading failed jobs…</div>
  );
  if (jobs.length === 0) return (
    <div style={{ padding: '12px 18px', color: T.t3, fontSize: 12 }}>No failed jobs currently.</div>
  );

  return (
    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
      {jobs.map((job, i) => (
        <div
          key={job.id ?? i}
          style={{
            padding: '10px 18px',
            borderBottom: `1px solid ${T.bdr}`,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}
        >
          <XCircle size={14} color={T.red} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.t1, margin: 0 }}>
              <code style={{ fontFamily: 'monospace' }}>{job.name}</code>
              {job.id && <span style={{ color: T.t3, fontSize: 11, marginLeft: 8 }}>#{job.id}</span>}
            </p>
            {job.failedReason && (
              <p style={{ fontSize: 11, color: T.redL, margin: '3px 0 0', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {job.failedReason}
              </p>
            )}
            <p style={{ fontSize: 11, color: T.t3, margin: '3px 0 0' }}>
              {job.attemptsMade} attempt{job.attemptsMade !== 1 ? 's' : ''} ·{' '}
              {new Date(job.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function QueueCard({ queue }: { queue: QueueStats }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mutate = (url: string, body?: object) =>
    api.post(url, body ?? {}).then(() => {
      void qc.invalidateQueries({ queryKey: ['sa-queue-stats'] });
      void qc.invalidateQueries({ queryKey: ['sa-failed-jobs', queue.id] });
    });

  const retryMut  = useMutation({ mutationFn: () => mutate(`/superadmin/jobs/${queue.id}/retry`) });
  const cleanMut  = useMutation({ mutationFn: () => mutate(`/superadmin/jobs/${queue.id}/clean`, { type: 'completed' }) });
  const cleanFMut = useMutation({ mutationFn: () => mutate(`/superadmin/jobs/${queue.id}/clean`, { type: 'failed' }) });
  const pauseMut  = useMutation({ mutationFn: () => mutate(`/superadmin/jobs/${queue.id}/pause`) });
  const resumeMut = useMutation({ mutationFn: () => mutate(`/superadmin/jobs/${queue.id}/resume`) });

  const anyPending = retryMut.isPending || cleanMut.isPending || cleanFMut.isPending || pauseMut.isPending || resumeMut.isPending;

  return (
    <div style={{
      background: T.bgS,
      border: `1px solid ${queue.isPaused ? T.amber + '50' : T.bdr}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px',
        borderBottom: `1px solid ${T.bdr}`,
        background: queue.isPaused ? 'rgba(245,158,11,0.04)' : 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: queue.isPaused ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={16} color={queue.isPaused ? T.amber : T.blue} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: T.t1, margin: 0 }}>{queue.label}</p>
              {queue.isPaused && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4, fontSize: 10,
                  background: 'rgba(245,158,11,0.15)', color: T.amber,
                  border: `1px solid rgba(245,158,11,0.3)`, fontWeight: 700,
                }}>
                  PAUSED
                </span>
              )}
              {queue.failed > 0 && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4, fontSize: 10,
                  background: 'rgba(239,68,68,0.15)', color: T.red,
                  border: `1px solid rgba(239,68,68,0.3)`, fontWeight: 700,
                }}>
                  {queue.failed} FAILED
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0', fontFamily: 'monospace' }}>
              {queue.id}
            </p>
          </div>
        </div>

        {/* Pause / Resume */}
        {queue.isPaused ? (
          <ActionButton
            onClick={() => resumeMut.mutate()}
            label="Resume"
            icon={<Play size={12} />}
            variant="success"
            disabled={anyPending}
          />
        ) : (
          <ActionButton
            onClick={() => pauseMut.mutate()}
            label="Pause"
            icon={<Pause size={12} />}
            variant="amber"
            disabled={anyPending}
          />
        )}
      </div>

      {/* Stat badges */}
      <div style={{
        display: 'flex', gap: 10, padding: '16px 18px',
        borderBottom: `1px solid ${T.bdr}`,
        flexWrap: 'wrap',
      }}>
        <StatBadge label="Waiting"   value={queue.waiting}   color={T.blue}   icon={<Clock size={13} />} />
        <StatBadge label="Active"    value={queue.active}    color={T.purple} icon={<Zap size={13} />} />
        <StatBadge label="Completed" value={queue.completed} color={T.green}  icon={<CheckCircle size={13} />} />
        <StatBadge label="Failed"    value={queue.failed}    color={T.red}    icon={<XCircle size={13} />} />
        <StatBadge label="Delayed"   value={queue.delayed}   color={T.amber}  icon={<AlertTriangle size={13} />} />
      </div>

      {/* Action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 18px',
        borderBottom: drawerOpen ? `1px solid ${T.bdr}` : 'none',
        flexWrap: 'wrap',
      }}>
        {queue.failed > 0 && (
          <ActionButton
            onClick={() => retryMut.mutate()}
            label={retryMut.isPending ? 'Retrying…' : `Retry ${queue.failed} Failed`}
            icon={<RotateCcw size={12} />}
            variant="success"
            disabled={anyPending}
          />
        )}
        {queue.completed > 0 && (
          <ActionButton
            onClick={() => cleanMut.mutate()}
            label={cleanMut.isPending ? 'Cleaning…' : 'Clean Completed'}
            icon={<Trash2 size={12} />}
            variant="default"
            disabled={anyPending}
          />
        )}
        {queue.failed > 0 && (
          <ActionButton
            onClick={() => cleanFMut.mutate()}
            label={cleanFMut.isPending ? 'Clearing…' : 'Clear Failed'}
            icon={<Trash2 size={12} />}
            variant="danger"
            disabled={anyPending}
          />
        )}

        {/* Spacer + view failed details */}
        {queue.failed > 0 && (
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'transparent', border: 'none',
              color: T.t2, fontSize: 12, cursor: 'pointer',
            }}
          >
            {drawerOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {drawerOpen ? 'Hide' : 'View'} failed jobs
          </button>
        )}
      </div>

      {/* Failed jobs drawer */}
      {drawerOpen && <FailedJobsDrawer queueId={queue.id} />}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperAdminJobInspectorPage() {
  const qc = useQueryClient();

  const { data: queues = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey:          ['sa-queue-stats'],
    queryFn:           fetchQueueStats,
    refetchInterval:   15_000, // auto-refresh every 15s
  });

  const totalFailed  = queues.reduce((s, q) => s + q.failed,  0);
  const totalActive  = queues.reduce((s, q) => s + q.active,  0);
  const totalWaiting = queues.reduce((s, q) => s + q.waiting, 0);
  const anyPaused    = queues.some(q => q.isPaused);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: 0 }}>Job Inspector</h1>
          <p style={{ fontSize: 13, color: T.t2, margin: '6px 0 0' }}>
            Monitor and manage BullMQ background queues in real time.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dataUpdatedAt > 0 && (
            <span style={{ fontSize: 11, color: T.t3 }}>
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['sa-queue-stats'] })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.bdr}`,
              background: 'transparent', color: T.t2, fontSize: 12, cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {queues.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
        }}>
          {[
            { label: 'Total Active',  value: totalActive,  color: T.purple, icon: <Zap size={15} /> },
            { label: 'Total Waiting', value: totalWaiting, color: T.blue,   icon: <Clock size={15} /> },
            { label: 'Total Failed',  value: totalFailed,  color: T.red,    icon: <XCircle size={15} /> },
            { label: 'Queues Paused', value: anyPaused ? queues.filter(q => q.isPaused).length : 0, color: T.amber, icon: <Pause size={15} /> },
          ].map(s => (
            <div key={s.label} style={{
              background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 10,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 11, color: T.t3, margin: '3px 0 0' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Queue cards */}
      {isLoading ? (
        <div style={{
          background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12,
          padding: 48, textAlign: 'center', color: T.t3, fontSize: 13,
        }}>
          Loading queue stats…
        </div>
      ) : queues.length === 0 ? (
        <div style={{
          background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12,
          padding: 48, textAlign: 'center', color: T.t3, fontSize: 13,
        }}>
          No queues found. Ensure Redis is connected and the backend workers are running.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {queues.map(q => (
            <QueueCard key={q.id} queue={q} />
          ))}
        </div>
      )}

      {/* Auto-refresh notice */}
      <p style={{ fontSize: 11, color: T.t3, textAlign: 'center', margin: 0 }}>
        Queue counts refresh automatically every 15 seconds.
      </p>
    </div>
  );
}
