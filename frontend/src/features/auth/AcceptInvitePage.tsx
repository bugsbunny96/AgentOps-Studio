import { useParams } from 'react-router-dom';

/** TODO (T2.3): POST /api/org/accept-invite/:token */
export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">You're invited!</h1>
        <p className="text-sm text-slate-500">Token: <code className="text-xs bg-slate-100 px-1 rounded">{token}</code></p>
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-400">
          Accept invite flow — coming in T2.3 (Team Management)
        </div>
      </div>
    </div>
  );
}
