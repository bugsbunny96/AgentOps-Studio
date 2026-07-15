/**
 * TeamPage — polished empty state with role reference.
 * Invite CTA disabled (backend not yet built); roles explained for context.
 */

import { Users, Shield, UserPlus, Mail } from 'lucide-react';

const ROLES = [
  {
    role: 'Owner',
    color: '#4f46e5',
    bg: 'rgba(99,102,241,.08)',
    border: 'rgba(99,102,241,.18)',
    desc: 'Full access — billing, settings, team management, and agent configuration.',
  },
  {
    role: 'Admin',
    color: '#7c3aed',
    bg: 'rgba(139,92,246,.08)',
    border: 'rgba(139,92,246,.18)',
    desc: 'Manage agents, calls, and team members. No billing access.',
  },
  {
    role: 'Member',
    color: '#0891b2',
    bg: 'rgba(8,145,178,.08)',
    border: 'rgba(8,145,178,.18)',
    desc: 'View calls, transcripts, and analytics. Read-only configuration.',
  },
];

export default function TeamPage() {
  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-slate-500">
            Invite colleagues to collaborate on your AI agent workspace.
          </p>
        </div>

        {/* Invite button — disabled until backend is ready */}
        <button
          disabled
          title="Team invites coming soon"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5
            text-sm font-medium text-slate-400 cursor-not-allowed select-none"
        >
          <UserPlus size={14} />
          Invite Member
        </button>
      </div>

      {/* Hero empty state */}
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white"
        style={{ minHeight: 300 }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(99,102,241,.08) 0%, transparent 100%)' }}
        />

        <div className="relative flex flex-col items-center justify-center px-8 py-20 text-center">
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.12))',
              border: '1px solid rgba(99,102,241,.2)',
            }}
          >
            <Users size={28} className="text-brand-600" strokeWidth={1.8} />
          </div>

          <h2 className="mb-2 text-lg font-semibold text-slate-800">Team management coming soon</h2>
          <p className="max-w-sm text-sm text-slate-500 leading-relaxed">
            Invite your team, assign roles, and control who can view calls, edit agent
            configurations, and manage billing — all from one place.
          </p>

          <div className="mt-5 flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5">
            <Mail size={12} className="text-brand-600" />
            <span className="text-xs font-medium text-brand-700">
              Email invitations with role-based access
            </span>
          </div>
        </div>
      </div>

      {/* Roles reference */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Role permissions
        </p>
        <div className="space-y-3">
          {ROLES.map(({ role, color, bg, border, desc }) => (
            <div
              key={role}
              className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4"
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <Shield size={14} style={{ color }} strokeWidth={1.8} />
              </div>
              <div>
                <span
                  className="inline-block mb-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide"
                  style={{ background: bg, color, border: `1px solid ${border}` }}
                >
                  {role}
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
