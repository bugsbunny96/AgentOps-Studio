/**
 * Super Admin — System Health Panel
 *
 * Shows: MongoDB status, Redis status + latency, BullMQ queue depths,
 * process memory, uptime, and Node version.
 * Auto-refreshes every 30 s.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database, Server, Activity, Cpu, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Clock,
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

interface QueueHealth {
  id:       string;
  label:    string;
  waiting:  number;
  active:   number;
  failed:   number;
  isPaused: boolean;
}

interface MemoryMb { rss: number; heapUsed: number; heapTotal: number }

interface HealthData {
  mongo: { status: string; readyState: number };
  redis: { status: string; latencyMs: number | null };
  queues: QueueHealth[];
  process: {
    uptimeSeconds: number;
    memoryMb:      MemoryMb;
    nodeVersion:   string;
    pid:           number;
  };
  timestamp: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchHealth = (): Promise<HealthData> =>
  api.get('/superadmin/health/enhanced').then(r => (r.data as { data: HealthData }).data);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === 'connected') return <CheckCircle size={16} color={T.green} />;
  if (status === 'connecting') return <AlertTriangle size={16} color={T.amber} />;
  return <XCircle size={16} color={T.red} />;
}

function StatusColor(status: string): string {
  if (status === 'connected') return T.green;
  if (status === 'connecting') return T.amber;
  return T.red;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function MetricCard({
  icon, title, children, borderColor,
}: {
  icon:         React.ReactNode;
  title:        string;
  children:     React.ReactNode;
  borderColor?: string;
}) {
  return (
    <div style={{
      background: T.bgS,
      border: `1px solid ${borderColor ?? T.bdr}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', borderBottom: `1px solid ${T.bdr}`,
      }}>
        {icon}
        <p style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: 0 }}>{title}</p>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, color }: {
  label: string; value: React.ReactNode; sub?: string; color?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, color: T.t3, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 800, color: color ?? T.t1, margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: T.t3, margin: '3px 0 0' }}>{sub}</p>}
    </div>
  );
}

function MemoryBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct > 85 ? T.red : pct > 65 ? T.amber : T.green;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: T.t2 }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{used} / {total} MB ({pct}%)</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: T.bgC, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperAdminHealthPage() {
  const qc = useQueryClient();

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey:        ['sa-health-enhanced'],
    queryFn:         fetchHealth,
    refetchInterval: 30_000,
  });

  const mongoOk = data?.mongo.status === 'connected';
  const redisOk = data?.redis.status === 'connected';
  const overallHealthy = mongoOk && redisOk;
  const anyQueueFailed = (data?.queues ?? []).some(q => q.failed > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: 0 }}>System Health</h1>
          <p style={{ fontSize: 13, color: T.t2, margin: '6px 0 0' }}>
            Live status of MongoDB, Redis, BullMQ queues, and the Node.js process.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dataUpdatedAt > 0 && (
            <span style={{ fontSize: 11, color: T.t3 }}>
              {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['sa-health-enhanced'] })}
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

      {/* Overall health banner */}
      {!isLoading && data && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', borderRadius: 10,
          background: overallHealthy
            ? 'rgba(34,197,94,0.08)'
            : 'rgba(239,68,68,0.08)',
          border: `1px solid ${overallHealthy ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
        }}>
          {overallHealthy
            ? <CheckCircle size={20} color={T.green} />
            : <XCircle size={20} color={T.red} />
          }
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: 0 }}>
              {overallHealthy ? 'All systems operational' : 'Platform health degraded'}
            </p>
            <p style={{ fontSize: 12, color: T.t2, margin: '2px 0 0' }}>
              {overallHealthy && !anyQueueFailed
                ? 'MongoDB, Redis, and all queues are healthy.'
                : [
                    !mongoOk && 'MongoDB is not connected.',
                    !redisOk && 'Redis is not connected.',
                    anyQueueFailed && 'One or more queues have failed jobs.',
                  ].filter(Boolean).join(' ')}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: T.t3 }}>
            Checked {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '—'}
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{
          background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12,
          padding: 48, textAlign: 'center', color: T.t3, fontSize: 13,
        }}>
          Checking system health…
        </div>
      ) : !data ? (
        <div style={{
          background: T.bgS, border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 12,
          padding: 48, textAlign: 'center', color: T.red, fontSize: 13,
        }}>
          Failed to fetch health data. The backend may be unreachable.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

          {/* MongoDB */}
          <MetricCard
            icon={
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${StatusColor(data.mongo.status)}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Database size={16} color={StatusColor(data.mongo.status)} />
              </div>
            }
            title="MongoDB Atlas"
            borderColor={`${StatusColor(data.mongo.status)}30`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <StatusIcon status={data.mongo.status} />
              <span style={{ fontSize: 15, fontWeight: 700, color: StatusColor(data.mongo.status), textTransform: 'capitalize' }}>
                {data.mongo.status}
              </span>
            </div>
            <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>
              Mongoose readyState: <code style={{ fontFamily: 'monospace', color: T.t2 }}>{data.mongo.readyState}</code>
            </p>
          </MetricCard>

          {/* Redis */}
          <MetricCard
            icon={
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${StatusColor(data.redis.status)}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Server size={16} color={StatusColor(data.redis.status)} />
              </div>
            }
            title="Redis Cloud"
            borderColor={`${StatusColor(data.redis.status)}30`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <StatusIcon status={data.redis.status} />
              <span style={{ fontSize: 15, fontWeight: 700, color: StatusColor(data.redis.status), textTransform: 'capitalize' }}>
                {data.redis.status}
              </span>
            </div>
            {data.redis.latencyMs !== null && (
              <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>
                PING latency:{' '}
                <span style={{
                  fontWeight: 700,
                  color: data.redis.latencyMs < 10 ? T.green : data.redis.latencyMs < 50 ? T.amber : T.red,
                }}>
                  {data.redis.latencyMs} ms
                </span>
              </p>
            )}
          </MetricCard>

          {/* Process / Node */}
          <MetricCard
            icon={
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(168,85,247,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Cpu size={16} color={T.purple} />
              </div>
            }
            title="Node.js Process"
          >
            <Stat label="Uptime" value={formatUptime(data.process.uptimeSeconds)} color={T.blueL} />
            <MemoryBar
              label="Heap Used / Total"
              used={data.process.memoryMb.heapUsed}
              total={data.process.memoryMb.heapTotal}
            />
            <MemoryBar
              label="RSS (resident set)"
              used={data.process.memoryMb.rss}
              total={data.process.memoryMb.rss} // always 100% for rss display
            />
            <div style={{ display: 'flex', gap: 20 }}>
              <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>
                Node <span style={{ color: T.t2 }}>{data.process.nodeVersion}</span>
              </p>
              <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>
                PID <code style={{ fontFamily: 'monospace', color: T.t2 }}>{data.process.pid}</code>
              </p>
            </div>
          </MetricCard>

          {/* BullMQ Queues */}
          <MetricCard
            icon={
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(59,130,246,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={16} color={T.blue} />
              </div>
            }
            title="BullMQ Queues"
          >
            {data.queues.length === 0 ? (
              <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>No queue data available.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.queues.map(q => (
                  <div key={q.id} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: T.bgC, border: `1px solid ${T.bdr}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{q.label}</span>
                        {q.isPaused && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, color: T.amber,
                            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                            padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase',
                          }}>
                            PAUSED
                          </span>
                        )}
                        {q.failed > 0 && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, color: T.red,
                            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                            padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase',
                          }}>
                            {q.failed} FAILED
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 14 }}>
                      {[
                        { label: 'wait',   val: q.waiting, color: T.blue   },
                        { label: 'active', val: q.active,  color: T.purple },
                        { label: 'failed', val: q.failed,  color: T.red    },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 16, fontWeight: 800, color: item.color, margin: 0, lineHeight: 1 }}>
                            {item.val}
                          </p>
                          <p style={{ fontSize: 9, color: T.t3, margin: '2px 0 0', textTransform: 'uppercase' }}>
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </MetricCard>
        </div>
      )}

      <p style={{ fontSize: 11, color: T.t3, textAlign: 'center', margin: 0 }}>
        <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        Auto-refreshes every 30 seconds. For BullMQ queue actions, visit the{' '}
        <a href="/superadmin/jobs" style={{ color: T.blue, textDecoration: 'none' }}>Job Inspector</a>.
      </p>
    </div>
  );
}
