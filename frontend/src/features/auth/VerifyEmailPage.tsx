/**
 * VerifyEmailPage — /verify-email?token=TOKEN[&next=NEXT&email=EMAIL]
 *
 * Landed on from the email verification link.
 * Calls POST /api/v1/auth/verify-email on mount with the token.
 *
 * ?next  and ?email are preserved and forwarded to /login so the invite
 * accept flow works end-to-end after a new-user registration:
 *   Register (/register?next=...&email=...)
 *   → Verify (/verify-email?token=...&next=...&email=...)
 *   → Login  (/login?next=...&email=...)
 *   → Auto-accept (/accept-invite/:token)
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { api } from '@/utils/api';
import { AxiosError } from 'axios';

type PagePhase =
  | { phase: 'verifying' }
  | { phase: 'success' }
  | { phase: 'error'; message: string };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Mail size={15} className="text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">AgentOps Studio</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const token       = searchParams.get('token') ?? '';
  const nextPath    = searchParams.get('next')  ?? '';
  const emailHint   = searchParams.get('email') ?? '';

  const [phase, setPhase] = useState<PagePhase>({ phase: 'verifying' });

  // Build the post-verification login URL, preserving ?next and ?email
  function buildLoginUrl() {
    const params = new URLSearchParams();
    if (nextPath)  params.set('next',  nextPath);
    if (emailHint) params.set('email', emailHint);
    const qs = params.toString();
    return qs ? `/login?${qs}` : '/login';
  }

  useEffect(() => {
    if (!token) {
      setPhase({ phase: 'error', message: 'No verification token found in this link.' });
      return;
    }

    api
      .post('/auth/verify-email', { token })
      .then(() => setPhase({ phase: 'success' }))
      .catch((err: AxiosError<{ error?: string; message?: string }>) => {
        const msg =
          err.response?.data?.error ??
          err.response?.data?.message ??
          'This verification link is invalid or has expired.';
        setPhase({ phase: 'error', message: msg });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Verifying ────────────────────────────────────────────────────────────
  if (phase.phase === 'verifying') {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 size={36} className="mx-auto mb-4 animate-spin text-brand-500" />
          <p className="text-sm font-medium text-slate-700">Verifying your email…</p>
          <p className="mt-1 text-xs text-slate-400">This will only take a moment.</p>
        </div>
      </Shell>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (phase.phase === 'success') {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="flex justify-center mb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-100">
              <CheckCircle2 size={28} className="text-green-500" />
            </div>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Email verified!</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Your account is now active.{' '}
            {nextPath
              ? 'Sign in to continue accepting your invitation.'
              : 'Sign in to get started.'}
          </p>
          <button
            onClick={() => navigate(buildLoginUrl())}
            className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-brand-700 transition-colors shadow-sm"
          >
            Sign in →
          </button>
        </div>
      </Shell>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center mb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100">
            <XCircle size={28} className="text-red-400" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Verification failed</h1>
        <p className="mt-2 text-sm text-slate-500">{phase.message}</p>
        <div className="mt-6 space-y-2">
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-brand-700 transition-colors"
          >
            Go to Sign In
          </button>
          <button
            onClick={() => navigate('/register')}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm
              font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Create a new account
          </button>
        </div>
      </div>
    </Shell>
  );
}
