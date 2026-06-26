import { useAppSelector } from '@/store';

/** TODO (T4.1): Implement dashboard with KPI cards (calls today, active agents, avg duration, CSAT) */
export default function DashboardPage() {
  const { currentOrg } = useAppSelector((s) => s.org);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-500">Welcome back to {currentOrg?.name}</p>
      </div>

      {/* KPI Placeholder Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Calls Today', 'Active Agents', 'Avg Duration', 'CSAT Score'].map((label) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <div className="mt-2 h-8 w-16 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400">
        Dashboard charts & activity feed — coming in T4.1 (Analytics & Reporting)
      </div>
    </div>
  );
}
