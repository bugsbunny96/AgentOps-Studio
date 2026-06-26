/**
 * L2.F4 — ActivatePage (Onboarding Step 5: Activate)
 * Shows a setup-complete summary and a "Launch my AI agent" CTA.
 * On click → POST /api/v1/onboarding/complete → navigates to /dashboard.
 *
 * NOTE: The Vapi sandbox test-call widget is a placeholder until L3 (Voice AI integration).
 * When L3 lands, replace the placeholder card with <VapiSandboxWidget />.
 */

import { useState } from 'react';
import { Loader2, Rocket, CheckCircle2, Phone } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';

const CHECKLIST = [
  'Business profile configured',
  'Website knowledge base queued',
  'Languages and fallback number set',
  'AI agent model ready',
] as const;

export default function ActivatePage() {
  const { completeOnboarding, currentOrg } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleLaunch() {
    setServerError(null);
    setIsLoading(true);
    try {
      await completeOnboarding();
      // Navigation is handled inside completeOnboarding() → navigate('/dashboard')
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setServerError(axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
          <Rocket size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">You're ready to launch!</h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentOrg?.name
              ? `${currentOrg.name}'s AI agent is configured and waiting to go live.`
              : 'Your AI agent is configured and waiting to go live.'}
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Setup complete
        </p>
        {CHECKLIST.map((item) => (
          <div key={item} className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
            <span className="text-sm text-slate-700">{item}</span>
          </div>
        ))}
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Vapi sandbox — placeholder until L3 */}
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Phone size={20} />
        </div>
        <p className="text-sm font-medium text-slate-500">Test call widget</p>
        <p className="mt-1 text-xs text-slate-400">
          Live test calls via Vapi will be available in the next release.
        </p>
      </div>

      {/* Launch CTA */}
      <div className="space-y-3">
        <button
          type="button"
          disabled={isLoading}
          onClick={handleLaunch}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600
            px-4 py-3 text-sm font-semibold text-white shadow-sm
            hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500
            disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {isLoading ? 'Activating…' : '🚀 Launch my AI agent'}
        </button>
        <p className="text-center text-xs text-slate-400">
          You can update all settings from the dashboard at any time.
        </p>
      </div>
    </div>
  );
}
