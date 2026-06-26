import { Link, useParams } from 'react-router-dom';

/** TODO (T3.1): Agent detail — config, Vapi status, language settings, recent calls */
export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/agents" className="text-sm text-slate-500 hover:text-slate-700">← Agents</Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-bold text-slate-900">Agent <code className="text-base">{id}</code></h1>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400">
        Agent detail view — coming in T3.1 (Voice Agent CRUD)
      </div>
    </div>
  );
}
