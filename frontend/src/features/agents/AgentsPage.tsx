import { Link } from 'react-router-dom';

/** TODO (T3.1): List voice agents, trigger Vapi provisioning, show status */
export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
          <p className="mt-1 text-slate-500">Manage your AI voice agents</p>
        </div>
        <Link
          to="/agents/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New Agent
        </Link>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400">
        Agent list — coming in T3.1 (Voice Agent CRUD)
      </div>
    </div>
  );
}
