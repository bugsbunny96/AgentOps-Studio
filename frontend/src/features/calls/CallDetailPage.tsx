import { Link, useParams } from 'react-router-dom';

/** TODO (T3.4): Call detail — recording player, transcript with language labels, AI summary */
export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/calls" className="text-sm text-slate-500 hover:text-slate-700">← Calls</Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-bold text-slate-900">Call <code className="text-base">{id}</code></h1>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400">
        Call detail (transcript + recording) — coming in T3.4 (Call Logs & Transcripts)
      </div>
    </div>
  );
}
