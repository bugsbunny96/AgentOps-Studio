import { useQuery } from '@tanstack/react-query';
import { Building2, Users, CheckCircle, XCircle, Activity } from 'lucide-react';
import api from '@/utils/api';

const T = {
  bgC:  'rgba(255,255,255,0.04)',
  bdr:  'rgba(255,255,255,0.07)',
  red:  '#ef4444',
  t1:   '#f8fafc',
  t2:   '#94a3b8',
  t3:   '#475569',
  em:   '#10b981',
  warn: '#f59e0b',
};

interface Stats {
  totalOrgs: number;
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  plans: { free: number; starter: number; growth: number; enterprise: number };
}

interface Health {
  mongo: string;
  redis: string;
  uptime: number;
}

function StatCard({ icon: Icon, label, value, sub, color = T.t1 }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{
      background: T.bgC, border: `1px solid ${T.bdr}`,
      borderRadius: 14, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 11, flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0 }}>{value}</p>
        <p style={{ fontSize: 12, color: T.t2, margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0' }}>{sub}</p>}
      </div>
    </div>
  );
}

function ServiceDot({ status }: { status: string }) {
  const ok = status === 'connected';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      color: ok ? T.em : T.red,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? T.em : T.red }} />
      {status}
    </span>
  );
}

export default function SuperAdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['sa', 'stats'],
    queryFn: () => api.get('/superadmin/stats').then((r) => r.data?.data ?? r.data),
    refetchInterval: 30_000,
  });

  const { data: health } = useQuery<Health>({
    queryKey: ['sa', 'health'],
    queryFn: () => api.get('/superadmin/health').then((r) => r.data?.data ?? r.data),
    refetchInterval: 15_000,
  });

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: '0 0 4px' }}>
          Platform Overview
        </h1>
        <p style={{ fontSize: 13, color: T.t2, margin: 0 }}>
          Real-time stats across all organisations and users
        </p>
      </div>

      {/* KPI cards */}
      {statsLoading ? (
        <p style={{ color: T.t3, fontSize: 13 }}>Loading stats…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
            <StatCard icon={Building2} label="Total Orgs"       value={stats?.totalOrgs ?? 0}     color="#60a5fa" />
            <StatCard icon={Users}     label="Total Users"      value={stats?.totalUsers ?? 0}    color="#a78bfa" />
            <StatCard icon={CheckCircle} label="Active Users"   value={stats?.activeUsers ?? 0}   color={T.em} />
            <StatCard icon={XCircle}   label="Suspended Users"  value={stats?.suspendedUsers ?? 0} color={T.red} />
          </div>

          {/* Plan breakdown */}
          <div style={{
            background: T.bgC, border: `1px solid ${T.bdr}`,
            borderRadius: 14, padding: 20, marginBottom: 24,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: '0 0 14px' }}>Plan Distribution</p>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {Object.entries(stats?.plans ?? {}).map(([plan, count]) => (
                <div key={plan}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: T.t1, margin: 0 }}>{count}</p>
                  <p style={{ fontSize: 11, color: T.t2, margin: 0, textTransform: 'capitalize' }}>{plan}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Health bar */}
      <div style={{
        background: T.bgC, border: `1px solid ${T.bdr}`,
        borderRadius: 14, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Activity size={14} style={{ color: T.t2 }} />
          <p style={{ fontSize: 13, fontWeight: 700, color: T.t1, margin: 0 }}>Infrastructure Health</p>
        </div>

        {health ? (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: T.t2 }}>MongoDB</span>
              <ServiceDot status={health.mongo} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: T.t2 }}>Redis</span>
              <ServiceDot status={health.redis} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: T.t2 }}>Uptime</span>
              <span style={{ fontSize: 12, color: T.t1, fontWeight: 600 }}>
                {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
              </span>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>Checking services…</p>
        )}
      </div>
    </div>
  );
}
