/**
 * AcceptInvitePage — /accept-invite/:token
 *
 * This page is the single landing point for ALL invite email links.
 * It handles every possible user state:
 *
 *   Phase 1 — LOADING
 *     • App is checking the session cookie on mount.
 *     • Show a neutral spinner — do nothing else yet.
 *
 *   Phase 2 — INVITE PREVIEW (always shown first when the app is ready)
 *     • Call GET /api/v1/team/invite-info/:token (public, no auth needed).
 *     • Show: org name, role, invited email.
 *     • Give two clear CTAs:
 *         "Sign in"        → /login?next=/accept-invite/:token&email=<email>
 *         "Create account" → /register?next=/accept-invite/:token&email=<email>
 *     • If the token is already invalid, show an error here (no CTAs).
 *
 *   Phase 3 — AUTO-ACCEPT (if user is already logged in when they land)
 *     • Skip the preview and immediately POST /api/v1/team/accept/:token.
 *     • On success → success screen.
 *     • On error (wrong email, already member, etc.) → error screen.
 *
 *   Phase 4 — SUCCESS / ERROR (terminal states)
 *
 * Note on the new-user flow:
 *   1. User clicks invite link → lands here (phase 2, not logged in)
 *   2. Clicks "Create account" → /register?next=...&email=...
 *   3. RegisterPage pre-fills the email field
 *   4. User sets password → account created → verification email sent
 *   5. User verifies email → lands on /login?next=...&email=...
 *   6. Logs in → redirected to /accept-invite/:token (phase 3, now logged in)
 *   7. Auto-accept fires → success screen → /dashboard
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Users, CheckCircle2, XCircle, Loader2,
  LogIn, UserPlus, Shield, Building2,
} from 'lucide-react';
import type { RootState } from '../../store';
import api from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import type { MemberPermissions } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InviteInfo {
  email:       string;
  orgName:     string;
  role:        'Member';
  permissions: MemberPermissions;
}

const PERMISSION_LABELS: Array<{
  key: keyof MemberPermissions;
  label: string;
  /** When true, false = "Hidden" (not "Read-only"). Used for Team. */
  hiddenWhenFalse?: boolean;
}> = [
  { key: 'agents',        label: 'Agents'         },
  { key: 'calls',         label: 'Calls'           },
  { key: 'knowledgeBase', label: 'Knowledge Base'  },
  { key: 'team',          label: 'Team',            hiddenWhenFalse: true },
];

type PagePhase =
  | { phase: 'loading' }
  | { phase: 'preview';  info: InviteInfo }
  | { phase: 'accepting' }
  | { phase: 'success';  orgName: string }
  | { phase: 'error';    message: string };

// ─── Role style ───────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Owner:  { color: '#4f46e5', bg: 'rgba(99,102,241,.1)',  border: 'rgba(99,102,241,.2)' },
  Member: { color: '#0891b2', bg: 'rgba(8,145,178,.1)',   border: 'rgba(8,145,178,.2)'  },
};

// ─── Shell ────────────────────────────────────────────────────────────────────

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
            <Users size={15} className="text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">AgentOps Studio</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AcceptInvitePage() {
  const { token }       = useParams<{ token: string }>();
  const navigate        = useNavigate();
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  const isAuthLoading   = useSelector((s: RootState) => s.auth.isLoading);
  const { verifySession } = useAuth();

  const [phase, setPhase] = useState<PagePhase>({ phase: 'loading' });

  // This page is a bare route — no AuthGuard / GuestGuard wraps it, so
  // verifySession() is never called automatically. We must call it ourselves
  // on mount; it's what transitions isLoading from true → false.
  useEffect(() => {
    verifySession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Still resolving the session cookie — wait before doing anything
    if (isAuthLoading) return;

    // ── User is already logged in: skip the preview, auto-accept ──────────────
    if (isAuthenticated) {
      setPhase({ phase: 'accepting' });
      api
        .post<{ success: boolean; data: { orgId: string; orgName: string } }>(
          `/team/accept/${token}`,
        )
        .then((res) => setPhase({ phase: 'success', orgName: res.data.data.orgName }))
        .catch((err) => {
          const msg: string =
            err?.response?.data?.error ??
            err?.response?.data?.message ??
            'Something went wrong. Please try again.';
          setPhase({ phase: 'error', message: msg });
        });
      return;
    }

    // ── User is not logged in: fetch invite info to show the preview screen ───
    api
      .get<{ success: boolean; data: InviteInfo }>(`/team/invite-info/${token}`)
      .then((res) => setPhase({ phase: 'preview', info: res.data.data }))
      .catch((err) => {
        const msg: string =
          err?.response?.data?.error ??
          err?.response?.data?.message ??
          'This invitation link is invalid or has expired.';
        setPhase({ phase: 'error', message: msg });
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isAuthenticated]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase.phase === 'loading' || phase.phase === 'accepting') {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Loader2 size={36} className="mx-auto mb-4 animate-spin text-brand-500" />
          <p className="text-sm text-slate-500">
            {phase.phase === 'loading' ? 'Loading…' : 'Joining workspace…'}
          </p>
        </div>
      </Shell>
    );
  }

  // ── Preview (not logged in — show invite context + CTAs) ──────────────────
  if (phase.phase === 'preview') {
    const { info } = phase;
    const s = ROLE_STYLE[info.role] ?? ROLE_STYLE.Member;
    const nextParam    = encodeURIComponent(`/accept-invite/${token}`);
    const emailParam   = encodeURIComponent(info.email);
    const loginUrl     = `/login?next=${nextParam}&email=${emailParam}`;
    const registerUrl  = `/register?next=${nextParam}&email=${emailParam}`;

    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

          {/* Purple gradient header */}
          <div
            className="px-8 py-8 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.08), rgba(139,92,246,.08))' }}
          >
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Building2 size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">You're invited!</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              You've been invited to join
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{info.orgName}</p>
          </div>

          <div className="px-8 py-6 space-y-5">

            {/* Invite details */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Role</span>
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                >
                  {info.role}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Invited email</span>
                <span className="text-sm font-medium text-slate-700">{info.email}</span>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield size={12} style={{ color: s.color }} />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Section access</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Dashboard</span>
                    <span className="text-[10px] font-semibold rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-500">Read-only</span>
                  </div>
                  {PERMISSION_LABELS.map(({ key, label, hiddenWhenFalse }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">{label}</span>
                      {info.permissions[key] ? (
                        <span
                          className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                        >
                          Full access
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-500">
                          {hiddenWhenFalse ? 'Hidden' : 'Read-only'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* IMPORTANT: must sign in with the invited email */}
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Important:</strong> You must sign in or create an account using{' '}
                <strong>{info.email}</strong> to accept this invitation.
              </p>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              {/* Already have an account */}
              <button
                onClick={() => navigate(loginUrl)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600
                  px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
              >
                <LogIn size={15} />
                Sign in to accept
              </button>

              {/* New user */}
              <button
                onClick={() => navigate(registerUrl)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200
                  bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <UserPlus size={15} />
                Create account &amp; accept
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              This invitation expires in 7 days
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (phase.phase === 'success') {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-100">
              <CheckCircle2 size={28} className="text-green-500" />
            </div>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">You're in!</h1>
          <p className="mt-2 text-sm text-slate-500">
            You've successfully joined <strong>{phase.orgName}</strong>.
          </p>
          <button
            onClick={async () => {
              // Refresh Redux auth + org state so OrgGuard sees the new membership
              // before we navigate. Without this, currentOrg is still null and
              // OrgGuard would redirect back to /onboarding.
              await verifySession();
              navigate('/dashboard', { replace: true });
            }}
            className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium
              text-white hover:bg-brand-700 transition-colors"
          >
            Go to Dashboard →
          </button>
        </div>
      </Shell>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100">
            <XCircle size={28} className="text-red-400" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Invitation failed</h1>
        <p className="mt-2 text-sm text-slate-500">{phase.message}</p>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="mt-6 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm
            font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Go to Sign In
        </button>
      </div>
    </Shell>
  );
}
