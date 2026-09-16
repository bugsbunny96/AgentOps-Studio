/**
 * Super Admin — Changelog Management
 *
 * List + compose interface for changelog entries.
 * Published entries are surfaced on the public /changelog page and in the dashboard "What's new" dot.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Plus, Pencil, Trash2, Eye, EyeOff, Sparkles, Wrench, TrendingUp,
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
  teal:  '#14b8a6',
  tealL: '#99f6e4',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangelogType = 'new' | 'improved' | 'fixed';

interface ChangelogEntry {
  _id:         string;
  title:       string;
  description: string;
  type:        ChangelogType;
  date:        string;
  isPublished: boolean;
  createdBy:   string;
  createdAt:   string;
}

interface ChangelogFormData {
  title:       string;
  description: string;
  type:        ChangelogType;
  date:        string;
}

const EMPTY_FORM: ChangelogFormData = {
  title:       '',
  description: '',
  type:        'new',
  date:        new Date().toISOString().slice(0, 10),
};

// ─── Type meta ────────────────────────────────────────────────────────────────

const TYPE_META: Record<ChangelogType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  new:      { label: 'New',      color: T.tealL,  bg: 'rgba(20,184,166,0.15)',  icon: <Sparkles size={12} /> },
  improved: { label: 'Improved', color: T.blueL,  bg: 'rgba(59,130,246,0.15)',  icon: <TrendingUp size={12} /> },
  fixed:    { label: 'Fixed',    color: T.amberL, bg: 'rgba(245,158,11,0.15)',  icon: <Wrench size={12} /> },
};

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchChangelog = async (): Promise<ChangelogEntry[]> => {
  const { data } = await api.get('/superadmin/changelog');
  return data.data?.entries ?? [];
};

const createEntry = async (body: ChangelogFormData): Promise<void> => {
  await api.post('/superadmin/changelog', body);
};

const updateEntry = async ({ id, body }: { id: string; body: Partial<ChangelogFormData> }): Promise<void> => {
  await api.patch(`/superadmin/changelog/${id}`, body);
};

const togglePublish = async (id: string): Promise<void> => {
  await api.patch(`/superadmin/changelog/${id}/toggle`);
};

const deleteEntry = async (id: string): Promise<void> => {
  await api.delete(`/superadmin/changelog/${id}`);
};

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

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ChangelogType }) {
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

// ─── Modal ────────────────────────────────────────────────────────────────────

function ChangelogModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: ChangelogEntry | null;
  onClose: () => void;
  onSave: (data: ChangelogFormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ChangelogFormData>(
    initial
      ? {
          title:       initial.title,
          description: initial.description,
          type:        initial.type,
          date:        new Date(initial.date).toISOString().slice(0, 10),
        }
      : EMPTY_FORM,
  );

  const set = <K extends keyof ChangelogFormData>(k: K, v: ChangelogFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 520, maxHeight: '88vh', overflowY: 'auto',
        background: T.bgS, border: `1px solid ${T.bdrB}`,
        borderRadius: 14, padding: 28,
      }}>
        <h2 style={{ margin: '0 0 22px', color: T.t1, fontSize: 17, fontWeight: 700 }}>
          {initial ? 'Edit Entry' : 'New Changelog Entry'}
        </h2>

        {/* Type */}
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Type</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {(['new', 'improved', 'fixed'] as ChangelogType[]).map(t => {
              const m = TYPE_META[t];
              return (
                <button key={t} onClick={() => set('type', t)} style={{
                  flex: 1, padding: '7px 0', border: `1px solid ${form.type === t ? m.color : T.bdr}`,
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
        </div>

        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Title
          </label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. AI call summaries now available"
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Description
          </label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Describe what changed, why it matters, and how to use it..."
            rows={4}
            style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }}
          />
        </div>

        {/* Date */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.t2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Date
          </label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={btnStyle(T.t3, T.bgC)}>Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim() || !form.description.trim()}
            style={btnStyle('#fff', T.teal, saving || !form.title.trim() || !form.description.trim())}
          >
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdminChangelogPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['sa-changelog'],
    queryFn: fetchChangelog,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sa-changelog'] });

  const createMut = useMutation({ mutationFn: createEntry, onSuccess: () => { invalidate(); setModal(null); } });
  const updateMut = useMutation({ mutationFn: updateEntry, onSuccess: () => { invalidate(); setModal(null); setEditing(null); } });
  const toggleMut = useMutation({ mutationFn: togglePublish, onSuccess: invalidate });
  const deleteMut = useMutation({ mutationFn: deleteEntry,  onSuccess: () => { invalidate(); setDeleteId(null); } });

  const openEdit = (e: ChangelogEntry) => { setEditing(e); setModal('edit'); };

  const handleSave = (form: ChangelogFormData) => {
    if (modal === 'create') createMut.mutate(form);
    else if (editing) updateMut.mutate({ id: editing._id, body: form });
  };

  const published = entries.filter(e => e.isPublished).length;

  // Group entries by month/year for timeline display
  const grouped = entries.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
    const key = new Date(entry.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '32px 36px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'rgba(20,184,166,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={20} color={T.teal} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.t1 }}>Changelog</h1>
            <p style={{ margin: 0, fontSize: 12, color: T.t2, marginTop: 2 }}>
              {published} published · {entries.length} total
            </p>
          </div>
        </div>
        <button
          onClick={() => setModal('create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, border: 'none',
            background: T.teal, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={15} /> New Entry
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {(['new', 'improved', 'fixed'] as ChangelogType[]).map(t => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <p style={{ color: T.t2, textAlign: 'center', marginTop: 60 }}>Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        Object.entries(grouped).map(([month, monthEntries]) => (
          <div key={month} style={{ marginBottom: 32 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {month}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthEntries.map(entry => (
                <ChangelogRow
                  key={entry._id}
                  entry={entry}
                  onEdit={() => openEdit(entry)}
                  onToggle={() => toggleMut.mutate(entry._id)}
                  onDelete={() => setDeleteId(entry._id)}
                  toggling={toggleMut.isPending && toggleMut.variables === entry._id}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <ChangelogModal
          initial={modal === 'edit' ? editing : null}
          onClose={() => { setModal(null); setEditing(null); }}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmModal
          message="Delete this changelog entry? This action cannot be undone."
          onConfirm={() => deleteMut.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
          loading={deleteMut.isPending}
        />
      )}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function ChangelogRow({
  entry, onEdit, onToggle, onDelete, toggling,
}: {
  entry: ChangelogEntry;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  toggling: boolean;
}) {
  const dateStr = new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div style={{
      background: T.bgS, border: `1px solid ${entry.isPublished ? T.bdrB : T.bdr}`,
      borderRadius: 10, padding: '14px 18px',
      display: 'flex', alignItems: 'flex-start', gap: 14,
      opacity: entry.isPublished ? 1 : 0.75,
    }}>
      {/* Date column */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 44 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.t2 }}>{dateStr}</div>
      </div>

      {/* Divider line */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_META[entry.type].color }} />
        <div style={{ width: 1, flex: 1, background: T.bdr, marginTop: 4 }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <TypeBadge type={entry.type} />
          <span style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>{entry.title}</span>
          {!entry.isPublished && (
            <span style={{ fontSize: 11, color: T.amber, fontWeight: 600, padding: '1px 6px', background: 'rgba(245,158,11,0.1)', borderRadius: 4 }}>
              Draft
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: T.t2, lineHeight: 1.6 }}>{entry.description}</p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onToggle}
          disabled={toggling}
          title={entry.isPublished ? 'Unpublish' : 'Publish'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 6,
            border: `1px solid ${entry.isPublished ? T.green : T.bdr}`,
            background: entry.isPublished ? 'rgba(34,197,94,0.1)' : T.bgC,
            color: entry.isPublished ? T.greenL : T.t2,
            fontSize: 11, fontWeight: 600, cursor: toggling ? 'not-allowed' : 'pointer',
            opacity: toggling ? 0.6 : 1,
          }}
        >
          {entry.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
          {entry.isPublished ? 'Live' : 'Publish'}
        </button>
        <IconBtn title="Edit" onClick={onEdit}><Pencil size={13} color={T.t2} /></IconBtn>
        <IconBtn title="Delete" onClick={onDelete}><Trash2 size={13} color={T.red} /></IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 6, border: `1px solid ${T.bdr}`,
      background: T.bgC, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', marginTop: 80 }}>
      <BookOpen size={40} color={T.t3} style={{ marginBottom: 12 }} />
      <p style={{ color: T.t2, fontSize: 14 }}>No changelog entries yet.</p>
      <p style={{ color: T.t3, fontSize: 12 }}>Document new features, improvements, and fixes for your users.</p>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
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
          <button onClick={onConfirm} disabled={loading} style={btnStyle('#fff', T.red, loading)}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
