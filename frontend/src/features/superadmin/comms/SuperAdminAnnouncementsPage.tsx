/**
 * Super Admin — Announcement Banners
 *
 * List of all announcements with inline activation toggle + compose / edit modal.
 * Announcements are shown as in-app banners to org users filtered by plan.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  AlertTriangle, Info, Zap, Calendar, Users,
} from 'lucide-react';
import api from '@/utils/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:    '#07070f',
  bgS:   '#0e0e1a',
  bgC:   'rgba(255,255,255,0.04)',
  bdr:   'rgba(255,255,255,0.07)',
  bdrB:  'rgba(255,255,255,0.12)',
  red:   '#ef4444',
  redL:  '#fca5a5',
  green: '#22c55e',
  greenL:'#bbf7d0',
  amber: '#f59e0b',
  amberL:'#fde68a',
  blue:  '#3b82f6',
  blueL: '#93c5fd',
  purple:'#a855f7',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type AnnouncementType = 'info' | 'warning' | 'critical';
type TargetPlan = 'all' | 'free' | 'starter' | 'growth' | 'enterprise';

interface Announcement {
  _id:         string;
  title:       string;
  message:     string;
  type:        AnnouncementType;
  targetPlan:  TargetPlan;
  dismissible: boolean;
  isActive:    boolean;
  expiresAt:   string | null;
  createdBy:   string;
  createdAt:   string;
}

interface AnnouncementFormData {
  title:       string;
  message:     string;
  type:        AnnouncementType;
  targetPlan:  TargetPlan;
  dismissible: boolean;
  expiresAt:   string;
}

const EMPTY_FORM: AnnouncementFormData = {
  title:       '',
  message:     '',
  type:        'info',
  targetPlan:  'all',
  dismissible: true,
  expiresAt:   '',
};

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchAnnouncements = async (): Promise<Announcement[]> => {
  const { data } = await api.get('/superadmin/announcements');
  return data.data ?? [];
};

const createAnnouncement = async (body: AnnouncementFormData): Promise<void> => {
  await api.post('/superadmin/announcements', body);
};

const updateAnnouncement = async ({ id, body }: { id: string; body: Partial<AnnouncementFormData> }): Promise<void> => {
  await api.patch(`/superadmin/announcements/${id}`, body);
};

const toggleAnnouncement = async (id: string): Promise<void> => {
  await api.patch(`/superadmin/announcements/${id}/toggle`);
};

const deleteAnnouncement = async (id: string): Promise<void> => {
  await api.delete(`/superadmin/announcements/${id}`);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<AnnouncementType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  info:     { label: 'Info',     color: T.blueL, bg: 'rgba(59,130,246,0.15)', icon: <Info     size={13} /> },
  warning:  { label: 'Warning',  color: T.amberL, bg: 'rgba(245,158,11,0.15)', icon: <AlertTriangle size={13} /> },
  critical: { label: 'Critical', color: T.redL,  bg: 'rgba(239,68,68,0.15)',  icon: <Zap      size={13} /> },
};

const PLAN_LABELS: Record<TargetPlan, string> = {
  all:        'All Plans',
  free:       'Free',
  starter:    'Starter',
  growth:     'Growth',
  enterprise: 'Enterprise',
};

function TypeBadge({ type }: { type: AnnouncementType }) {
  const m = TYPE_META[type];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
      borderRadius: 99, fontSize: 11, fontWeight: 600,
      color: m.color, background: m.bg,
    }}>
      {m.icon}{m.label}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600,
      color: active ? T.greenL : T.t3,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: active ? T.green : T.t3,
        boxShadow: active ? `0 0 6px ${T.green}` : 'none',
      }} />
      {active ? 'Live' : 'Draft'}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function AnnouncementModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: Announcement | null;
  onClose: () => void;
  onSave: (data: AnnouncementFormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<AnnouncementFormData>(
    initial
      ? {
          title:       initial.title,
          message:     initial.message,
          type:        initial.type,
          targetPlan:  initial.targetPlan,
          dismissible: initial.dismissible,
          expiresAt:   initial.expiresAt
            ? new Date(initial.expiresAt).toISOString().slice(0, 16)
            : '',
        }
      : EMPTY_FORM,
  );

  const set = <K extends keyof AnnouncementFormData>(k: K, v: AnnouncementFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const isCritical = form.type === 'critical';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 560, maxHeight: '88vh', overflowY: 'auto',
        background: T.bgS, border: `1px solid ${T.bdrB}`,
        borderRadius: 14, padding: 28,
      }}>
        <h2 style={{ margin: '0 0 22px', color: T.t1, fontSize: 17, fontWeight: 700 }}>
          {initial ? 'Edit Announcement' : 'New Announcement'}
        </h2>

        {/* Type */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Type</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {(['info', 'warning', 'critical'] as AnnouncementType[]).map(t => {
              const m = TYPE_META[t];
              return (
                <button key={t} onClick={() => set('type', t)} style={{
                  flex: 1, padding: '8px 0', border: `1px solid ${form.type === t ? m.color : T.bdr}`,
                  borderRadius: 8, background: form.type === t ? m.bg : 'transparent',
                  color: form.type === t ? m.color : T.t2,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  {m.icon}{m.label}
                </button>
              );
            })}
          </div>
        </label>

        {isCritical && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`,
            fontSize: 12, color: T.redL, display: 'flex', gap: 6, alignItems: 'flex-start',
          }}>
            <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
            Critical banners are always non-dismissible and shown prominently in red.
          </div>
        )}

        {/* Title */}
        <Field label="Title">
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Scheduled maintenance on July 30"
            style={inputStyle}
          />
        </Field>

        {/* Message */}
        <Field label="Message">
          <textarea
            value={form.message}
            onChange={e => set('message', e.target.value)}
            placeholder="Describe the announcement in detail..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>

        {/* Target Plan */}
        <Field label="Target Plan">
          <select value={form.targetPlan} onChange={e => set('targetPlan', e.target.value as TargetPlan)} style={inputStyle}>
            {(Object.entries(PLAN_LABELS) as [TargetPlan, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Field>

        {/* Expires At */}
        <Field label="Expires At (optional)">
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={e => set('expiresAt', e.target.value)}
            style={inputStyle}
          />
        </Field>

        {/* Dismissible */}
        {!isCritical && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, cursor: 'pointer' }}>
            <div
              onClick={() => set('dismissible', !form.dismissible)}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: form.dismissible ? T.green : T.t3,
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: form.dismissible ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontSize: 13, color: T.t1 }}>
              Users can dismiss this banner
            </span>
          </label>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={btnStyle(T.t3, T.bgC)}>Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim() || !form.message.trim()}
            style={btnStyle(T.t1, T.blue, saving || !form.title.trim() || !form.message.trim())}
          >
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ marginTop: 6 }}>{children}</div>
    </label>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: T.bgC, border: `1px solid ${T.bdr}`,
  borderRadius: 8, padding: '9px 12px',
  color: T.t1, fontSize: 13, outline: 'none',
};

const btnStyle = (color: string, bg: string, disabled = false): React.CSSProperties => ({
  padding: '8px 18px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  background: bg, color, fontSize: 13, fontWeight: 600, opacity: disabled ? 0.5 : 1,
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdminAnnouncementsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['sa-announcements'],
    queryFn: fetchAnnouncements,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sa-announcements'] });

  const createMut = useMutation({ mutationFn: createAnnouncement, onSuccess: () => { invalidate(); setModal(null); } });
  const updateMut = useMutation({ mutationFn: updateAnnouncement, onSuccess: () => { invalidate(); setModal(null); setEditing(null); } });
  const toggleMut = useMutation({ mutationFn: toggleAnnouncement, onSuccess: invalidate });
  const deleteMut = useMutation({ mutationFn: deleteAnnouncement, onSuccess: () => { invalidate(); setDeleteId(null); } });

  const openEdit = (a: Announcement) => { setEditing(a); setModal('edit'); };

  const handleSave = (form: AnnouncementFormData) => {
    if (modal === 'create') {
      createMut.mutate(form);
    } else if (editing) {
      updateMut.mutate({ id: editing._id, body: form });
    }
  };

  const liveCount = announcements.filter(a => a.isActive).length;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '32px 36px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'rgba(168,85,247,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Megaphone size={20} color={T.purple} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.t1 }}>Announcement Banners</h1>
            <p style={{ margin: 0, fontSize: 12, color: T.t2, marginTop: 2 }}>
              {liveCount} live · {announcements.length} total
            </p>
          </div>
        </div>
        <button
          onClick={() => setModal('create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, border: 'none',
            background: T.purple, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={15} /> New Announcement
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <p style={{ color: T.t2, textAlign: 'center', marginTop: 60 }}>Loading…</p>
      ) : announcements.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {announcements.map(a => (
            <AnnouncementRow
              key={a._id}
              a={a}
              onEdit={() => openEdit(a)}
              onToggle={() => toggleMut.mutate(a._id)}
              onDelete={() => setDeleteId(a._id)}
              toggling={toggleMut.isPending && toggleMut.variables === a._id}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <AnnouncementModal
          initial={modal === 'edit' ? editing : null}
          onClose={() => { setModal(null); setEditing(null); }}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmModal
          message="Delete this announcement? This action cannot be undone."
          onConfirm={() => deleteMut.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
          loading={deleteMut.isPending}
          danger
        />
      )}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function AnnouncementRow({
  a, onEdit, onToggle, onDelete, toggling,
}: {
  a: Announcement;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  toggling: boolean;
}) {
  const expiryStr = a.expiresAt
    ? new Date(a.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const expired = a.expiresAt ? new Date(a.expiresAt) < new Date() : false;

  return (
    <div style={{
      background: T.bgS, border: `1px solid ${a.isActive ? T.bdrB : T.bdr}`,
      borderRadius: 10, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* Left: type icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: TYPE_META[a.type].bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: TYPE_META[a.type].color,
      }}>
        {TYPE_META[a.type].icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.t1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {a.title}
          </span>
          <TypeBadge type={a.type} />
          <StatusDot active={a.isActive && !expired} />
          {expired && (
            <span style={{ fontSize: 11, color: T.red, fontWeight: 600 }}>Expired</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: T.t2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {a.message}
        </p>
        <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
          <Meta icon={<Users size={11} />} text={PLAN_LABELS[a.targetPlan]} />
          {expiryStr && <Meta icon={<Calendar size={11} />} text={`Expires ${expiryStr}`} />}
          <Meta icon={null} text={a.dismissible ? 'Dismissible' : 'Persistent'} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <IconBtn title={a.isActive ? 'Deactivate' : 'Activate'} onClick={onToggle} disabled={toggling}>
          {a.isActive
            ? <ToggleRight size={16} color={T.green} />
            : <ToggleLeft  size={16} color={T.t3} />}
        </IconBtn>
        <IconBtn title="Edit" onClick={onEdit}>
          <Pencil size={14} color={T.t2} />
        </IconBtn>
        <IconBtn title="Delete" onClick={onDelete}>
          <Trash2 size={14} color={T.red} />
        </IconBtn>
      </div>
    </div>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.t3 }}>
      {icon}{text}
    </span>
  );
}

function IconBtn({ children, title, onClick, disabled = false }: {
  children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      width: 30, height: 30, borderRadius: 6, border: `1px solid ${T.bdr}`,
      background: T.bgC, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', marginTop: 80 }}>
      <Megaphone size={40} color={T.t3} style={{ marginBottom: 12 }} />
      <p style={{ color: T.t2, fontSize: 14 }}>No announcements yet.</p>
      <p style={{ color: T.t3, fontSize: 12 }}>Create one to display in-app banners to your users.</p>
    </div>
  );
}

// ─── Confirm Modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel, loading, danger = false }: {
  message: string; onConfirm: () => void; onCancel: () => void; loading: boolean; danger?: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 360, background: T.bgS, border: `1px solid ${T.bdrB}`,
        borderRadius: 12, padding: 24,
      }}>
        <p style={{ margin: '0 0 20px', color: T.t1, fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={btnStyle(T.t2, T.bgC)}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={btnStyle('#fff', danger ? T.red : T.blue, loading)}>
            {loading ? 'Deleting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
