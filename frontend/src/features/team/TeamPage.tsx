/**
 * TeamPage
 *
 * Owner can:
 *   • Invite members with configurable section permissions
 *   • Edit a member's permissions after they join (pencil icon)
 *   • Remove members
 *   • Resend / revoke pending invitations
 *
 * Member sees a read-only list of the team.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import {
  UserPlus, Shield, Mail,
  Trash2, RefreshCw, X, Clock, Pencil, Check, AlertCircle,
} from 'lucide-react';
import type { RootState } from '../../store';
import api from '../../utils/api';
import type { MemberPermissions } from '../../types';
import { DEFAULT_MEMBER_PERMISSIONS } from '../../types';
import { useCanWrite } from '../../hooks/usePermission';

interface BillingStatus {
  effectivePlan: string;
  isInTrial:     boolean;
  teamMembers:   { used: number; limit: number | null };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  membershipId: string;
  userId:       string;
  name:         string;
  email:        string;
  role:         'Owner' | 'Member';
  permissions:  MemberPermissions;
  joinedAt:     string;
}

interface PendingInvitation {
  id:          string;
  email:       string;
  role:        'Member';
  permissions: MemberPermissions;
  expiresAt:   string;
  createdAt:   string;
}

interface TeamData {
  members:         TeamMember[];
  invitations:     PendingInvitation[];
  currentUserId:   string;
  currentUserRole: 'Owner' | 'Member';
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function fetchTeam(): Promise<TeamData> {
  const res = await api.get<{ success: boolean; data: TeamData }>('/team');
  return res.data.data;
}

async function postInvite(payload: { email: string; permissions: MemberPermissions }) {
  await api.post('/team/invite', payload);
}

async function postResend(invitationId: string) {
  await api.post(`/team/invitations/${invitationId}/resend`);
}

async function deleteInvite(invitationId: string) {
  await api.delete(`/team/invitations/${invitationId}`);
}

async function patchPermissions(membershipId: string, permissions: MemberPermissions) {
  await api.patch(`/team/members/${membershipId}/permissions`, permissions);
}

async function deleteMember(membershipId: string) {
  await api.delete(`/team/members/${membershipId}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Owner:  { color: '#4f46e5', bg: 'rgba(99,102,241,.1)',  border: 'rgba(99,102,241,.2)' },
  Member: { color: '#0891b2', bg: 'rgba(8,145,178,.1)',   border: 'rgba(8,145,178,.2)'  },
};

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.Member;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {role}
    </span>
  );
}

function avatar(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function relativeDate(iso: string) {
  const d   = new Date(iso);
  const ms  = Date.now() - d.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return d.toLocaleDateString();
}

function expiryLabel(iso: string) {
  const ms   = new Date(iso).getTime() - Date.now();
  const hrs  = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (hrs < 0)   return 'Expired';
  if (hrs < 24)  return `Expires in ${hrs}h`;
  return `Expires in ${days}d`;
}

// ─── PermissionsEditor ────────────────────────────────────────────────────────
// Shared UI used by InviteModal and EditPermissionsModal.

const PERMISSION_OPTIONS: Array<{
  key:      keyof MemberPermissions;
  label:    string;
  fullDesc: string;
  readDesc: string;
  /** When true, false = page hidden (not read-only). Used for Team. */
  hiddenWhenFalse?: boolean;
}> = [
  { key: 'agents',        label: 'Agents',         fullDesc: 'Full access — view, configure, test call',      readDesc: 'Read-only — view agent details only'    },
  { key: 'calls',         label: 'Calls',          fullDesc: 'Full access — view, filter, export calls',      readDesc: 'Read-only — view call logs only'         },
  { key: 'knowledgeBase', label: 'Knowledge Base', fullDesc: 'Full access — add, edit, delete documents',     readDesc: 'Read-only — view and download documents' },
  { key: 'team',          label: 'Team',           fullDesc: 'Can view team, invite members, edit permissions', readDesc: 'Team page hidden from their navigation', hiddenWhenFalse: true },
];

function PermissionsEditor({
  value,
  onChange,
}: {
  value:    MemberPermissions;
  onChange: (p: MemberPermissions) => void;
}) {
  function toggle(key: keyof MemberPermissions) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <div className="space-y-1.5">
      {/* Dashboard is always visible and always read-only (no sensitive actions) */}
      <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-slate-700">Dashboard</p>
          <p className="text-[11px] text-slate-400">Overview — always visible to all members</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Always on</span>
      </div>

      {PERMISSION_OPTIONS.map(({ key, label, fullDesc, readDesc, hiddenWhenFalse }) => {
        const full = value[key];
        const stateLabel = full ? 'Full' : hiddenWhenFalse ? 'Hidden' : 'Read-only';
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={[
              'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
              full
                ? 'border-brand-200 bg-brand-50'
                : 'border-slate-100 bg-white hover:bg-slate-50',
            ].join(' ')}
          >
            <div className="min-w-0 flex-1 mr-3">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${full ? 'text-brand-800' : 'text-slate-700'}`}>{label}</p>
                <span className={[
                  'text-[10px] font-semibold rounded-full px-1.5 py-0.5 tracking-wide',
                  full
                    ? 'bg-brand-100 text-brand-700'
                    : hiddenWhenFalse
                    ? 'bg-slate-200 text-slate-500'
                    : 'bg-slate-100 text-slate-500',
                ].join(' ')}>
                  {stateLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{full ? fullDesc : readDesc}</p>
            </div>
            <div className={[
              'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors',
              full ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white',
            ].join(' ')}>
              {full && <Check size={11} className="text-white" strokeWidth={3} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── InviteModal ──────────────────────────────────────────────────────────────

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail]           = useState('');
  const [permissions, setPermissions] = useState<MemberPermissions>({ ...DEFAULT_MEMBER_PERMISSIONS });
  const [error, setError]           = useState('');

  const mutation = useMutation({
    mutationFn: postInvite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      setEmail('');
      setPermissions({ ...DEFAULT_MEMBER_PERMISSIONS });
      setError('');
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error ?? 'Failed to send invitation');
    },
  });

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required'); return; }
    mutation.mutate({ email: email.trim(), permissions });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Invite a team member</h2>
            <p className="text-xs text-slate-400 mt-0.5">They'll join as a Member with the access you set below.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm
                text-slate-900 placeholder-slate-400 outline-none focus:border-brand-500 focus:ring-2
                focus:ring-brand-100 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Section access</label>
            <PermissionsEditor value={permissions} onChange={setPermissions} />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm
                font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white
                hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {mutation.isPending ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── EditPermissionsModal ─────────────────────────────────────────────────────

function EditPermissionsModal({
  member,
  onClose,
}: { member: TeamMember | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [permissions, setPermissions] = useState<MemberPermissions>(
    member?.permissions ?? { ...DEFAULT_MEMBER_PERMISSIONS }
  );

  const mutation = useMutation({
    mutationFn: () => patchPermissions(member!.membershipId, permissions),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      onClose();
    },
  });

  if (!member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Edit permissions</h2>
            <p className="text-xs text-slate-400 mt-0.5">{member.name} · {member.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          <PermissionsEditor value={permissions} onChange={setPermissions} />

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm
                font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white
                hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {mutation.isPending ? 'Saving…' : 'Save permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RemoveConfirmModal ───────────────────────────────────────────────────────

function RemoveConfirmModal({
  member,
  onClose,
}: { member: TeamMember | null; onClose: () => void }) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteMember(member!.membershipId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      onClose();
    },
  });

  if (!member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl p-6">
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Remove team member?</h2>
          <p className="text-sm text-slate-500">
            <strong>{member.name}</strong> ({member.email}) will lose all access to your workspace.
            This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm
              font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white
              hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PermissionPills ──────────────────────────────────────────────────────────
// Shows which sections a Member can access as small pills.

function PermissionPills({ permissions, role }: { permissions: MemberPermissions; role: string }) {
  if (role === 'Owner') {
    return <span className="text-[11px] text-slate-400">Full access to all sections</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {/* Dashboard is always visible */}
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
        Dashboard
      </span>
      {PERMISSION_OPTIONS.map(({ key, label, hiddenWhenFalse }) => {
        const full = permissions[key];
        // If the section is hidden when false, skip rendering the pill entirely
        if (!full && hiddenWhenFalse) return null;
        return (
          <span
            key={key}
            className={[
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              full
                ? 'bg-brand-50 text-brand-700'
                : 'bg-slate-100 text-slate-400',
            ].join(' ')}
            title={full ? `${label}: full access` : `${label}: read-only`}
          >
            {label} {full ? '✓' : '·'}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const currentUser = useSelector((s: RootState) => s.auth.user);
  const qc          = useQueryClient();

  const [showInvite, setShowInvite]       = useState(false);
  const [editTarget, setEditTarget]       = useState<TeamMember | null>(null);
  const [removeTarget, setRemoveTarget]   = useState<TeamMember | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['team'],
    queryFn:  fetchTeam,
    staleTime: 30_000,
  });

  const { data: billingStatus } = useQuery<BillingStatus>({
    queryKey: ['billing', 'status'],
    queryFn: () => api.get('/billing/status').then((r: { data: { data?: BillingStatus; [key: string]: unknown } }) => (r.data?.data ?? r.data) as BillingStatus),
    staleTime: 5 * 60_000,
  });

  const resendMutation = useMutation({
    mutationFn: postResend,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const revokeMutation = useMutation({
    mutationFn: deleteInvite,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const callerRole      = data?.currentUserRole ?? 'Member';
  const isOwner         = callerRole === 'Owner';
  const canManageTeam   = useCanWrite('team'); // Member with team:true can invite/edit/remove

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-slate-100" />
        <div className="h-64 rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
        Failed to load team data. Please refresh.
      </div>
    );
  }

  const { members, invitations } = data;

  return (
    <div className="space-y-8">

      {/* Modals */}
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
      <EditPermissionsModal member={editTarget}   onClose={() => setEditTarget(null)} />
      <RemoveConfirmModal   member={removeTarget} onClose={() => setRemoveTarget(null)} />

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-slate-500">
            {members.length} member{members.length !== 1 ? 's' : ''}
            {billingStatus?.teamMembers?.limit != null && billingStatus.teamMembers.limit > 0 && (
              <span className={`ml-1 font-medium ${
                (members.length - 1) >= billingStatus.teamMembers.limit
                  ? 'text-red-500'
                  : 'text-slate-400'
              }`}>
                · {members.length - 1} of {billingStatus.teamMembers.limit} additional seat{billingStatus.teamMembers.limit !== 1 ? 's' : ''} used
              </span>
            )}
            {invitations.length > 0 && ` · ${invitations.length} pending invitation${invitations.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {(isOwner || canManageTeam) && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5
              text-sm font-medium text-white hover:bg-brand-700 transition-colors shadow-sm"
          >
            <UserPlus size={14} />
            Invite Member
          </button>
        )}
      </div>

      {/* Member limit warning */}
      {billingStatus?.teamMembers?.limit != null &&
       billingStatus.teamMembers.limit > 0 &&
       (members.length - 1) >= billingStatus.teamMembers.limit && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle size={15} className="flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            You've reached your {billingStatus.teamMembers.limit}-member limit on the{' '}
            <strong>{billingStatus.isInTrial ? 'Basic (Trial)' : billingStatus.effectivePlan}</strong> plan.{' '}
            <a href="/billing" className="font-semibold underline hover:text-amber-900">Upgrade</a> to add more members.
          </p>
        </div>
      )}

      {/* Members table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Members</h2>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((m) => {
            const isMe      = m.userId === currentUser?.id;
            const canEdit   = (isOwner || canManageTeam) && !isMe && m.role !== 'Owner';
            const canRemove = (isOwner || canManageTeam) && !isMe && m.role !== 'Owner';
            const initials  = avatar(m.name);

            return (
              <div key={m.membershipId} className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center
                    rounded-full text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {initials}
                </div>

                {/* Name / email / permissions */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{m.name}</span>
                    {isMe && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{m.email}</p>
                  <div className="mt-1">
                    <PermissionPills permissions={m.permissions} role={m.role} />
                  </div>
                </div>

                {/* Joined date */}
                <span className="hidden sm:block text-xs text-slate-400 w-20 text-right flex-shrink-0">
                  {relativeDate(m.joinedAt)}
                </span>

                {/* Role badge */}
                <div className="flex-shrink-0">
                  <RoleBadge role={m.role} />
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {canEdit && (
                    <button
                      onClick={() => setEditTarget(m)}
                      title="Edit permissions"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => setRemoveTarget(m)}
                      title="Remove member"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {!canEdit && !canRemove && <div className="w-8" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Pending Invitations</h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                {invitations.length}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-6 py-4">
                {/* Icon */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full
                  bg-amber-50 border border-amber-100">
                  <Mail size={14} className="text-amber-500" />
                </div>

                {/* Email + permissions */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{inv.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={10} className="text-slate-400" />
                    <span className="text-xs text-slate-400">{expiryLabel(inv.expiresAt)}</span>
                  </div>
                  <div className="mt-1">
                    <PermissionPills permissions={inv.permissions} role="Member" />
                  </div>
                </div>

                {/* Role badge */}
                <div className="flex-shrink-0">
                  <RoleBadge role={inv.role} />
                </div>

                {/* Actions (Owner or Member with team permission) */}
                {(isOwner || canManageTeam) && (
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => resendMutation.mutate(inv.id)}
                      disabled={resendMutation.isPending}
                      title="Resend invitation"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => revokeMutation.mutate(inv.id)}
                      disabled={revokeMutation.isPending}
                      title="Revoke invitation"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role / permissions legend */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Role permissions
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            {
              role: 'Owner',
              desc: 'Full access — settings, team management, agent configuration, and all data.',
              icon: '👑',
            },
            {
              role: 'Member',
              desc: 'Agents, Calls, and Knowledge Base are always visible. Checked = full access; unchecked = read-only. Team section is hidden unless explicitly granted.',
              icon: '👤',
            },
          ] as const).map(({ role, desc, icon: _icon }) => {
            const s = ROLE_STYLE[role];
            return (
              <div
                key={role}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3"
              >
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg mt-0.5 text-sm"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  <Shield size={12} style={{ color: s.color }} strokeWidth={2} />
                </div>
                <div>
                  <RoleBadge role={role} />
                  <p className="mt-1 text-[11px] text-slate-500 leading-tight">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
