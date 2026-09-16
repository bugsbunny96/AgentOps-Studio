/**
 * 19.9 — A/B Test Manager
 * Create tests with variants, start/pause/end lifecycle, view org assignments, track conversions.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, Play, Pause, StopCircle, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/utils/api';

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  red: '#ef4444', redD: 'rgba(239,68,68,0.12)',
  green: '#22c55e', greenD: 'rgba(34,197,94,0.12)',
  amber: '#f59e0b', amberD: 'rgba(245,158,11,0.12)',
  blue: '#3b82f6', blueD: 'rgba(59,130,246,0.12)',
  purple: '#a855f7', purpleD: 'rgba(168,85,247,0.12)',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

type TestStatus = 'draft' | 'running' | 'paused' | 'ended';

interface Variant {
  id: string; name: string; description: string; percentage: number;
}
interface ABTestAssignment {
  orgId: string; variantId: string; assignedAt: string;
}
interface ABTest {
  _id: string; name: string; description?: string; status: TestStatus;
  hypothesis?: string; metric?: string;
  variants: Variant[];
  assignments?: ABTestAssignment[];
  conversionsByVariant?: Record<string, number>;
  startedAt?: string; endedAt?: string; createdAt: string;
}

const statusConfig: Record<TestStatus, { label: string; color: string; bg: string }> = {
  draft:   { label: 'Draft',   color: T.t3,    bg: T.bgC    },
  running: { label: 'Running', color: T.green, bg: T.greenD },
  paused:  { label: 'Paused',  color: T.amber, bg: T.amberD },
  ended:   { label: 'Ended',   color: T.t3,    bg: T.bgC    },
};

const variantColors = [T.blue, T.purple, T.green, T.amber, T.red];

function StatusBadge({ status }: { status: TestStatus }) {
  const cfg = statusConfig[status];
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20,
    background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>;
}

export default function SuperAdminABTestPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newVariants, setNewVariants] = useState<Variant[]>([
    { id: 'control', name: 'Control', description: 'Default experience', percentage: 50 },
    { id: 'treatment', name: 'Treatment', description: 'New experience', percentage: 50 },
  ]);
  const [form, setForm] = useState({ name: '', description: '', hypothesis: '', metric: '' });
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sa-ab-tests'],
    queryFn: async () => {
      const r = await api.get<{ success: boolean; data: ABTest[] }>('/superadmin/ab-tests?limit=50');
      return r.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const totalPct = newVariants.reduce((s, v) => s + v.percentage, 0);
      if (Math.abs(totalPct - 100) > 0.1) throw new Error(`Percentages must sum to 100 (current: ${totalPct})`);
      await api.post('/superadmin/ab-tests', { ...form, variants: newVariants });
    },
    onSuccess: () => {
      setShowCreate(false);
      setForm({ name: '', description: '', hypothesis: '', metric: '' });
      setNewVariants([
        { id: 'control', name: 'Control', description: '', percentage: 50 },
        { id: 'treatment', name: 'Treatment', description: '', percentage: 50 },
      ]);
      void qc.invalidateQueries({ queryKey: ['sa-ab-tests'] });
    },
  });

  const lifMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'pause' | 'end' | 'delete' }) => {
      if (action === 'delete') { await api.delete(`/superadmin/ab-tests/${id}`); }
      else { await api.post(`/superadmin/ab-tests/${id}/${action}`, {}); }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sa-ab-tests'] }),
  });

  function updateVariant(idx: number, field: keyof Variant, value: string | number) {
    setNewVariants(vs => vs.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  }
  function addVariant() {
    const id = `v${Date.now()}`;
    setNewVariants(vs => [...vs, { id, name: `Variant ${vs.length + 1}`, description: '', percentage: 0 }]);
  }
  function removeVariant(idx: number) {
    setNewVariants(vs => vs.filter((_, i) => i !== idx));
  }

  const tests = data ?? [];
  const totalPct = newVariants.reduce((s, v) => s + v.percentage, 0);

  return (
    <div style={{ padding: '32px 40px', background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FlaskConical size={22} color={T.purple} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>A/B Test Manager</h1>
            <p style={{ margin: 0, fontSize: 13, color: T.t2, marginTop: 2 }}>
              Create experiments, assign orgs deterministically, track conversions
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 8,
              color: T.t2, cursor: 'pointer', fontSize: 13 }}>
            <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={() => setShowCreate(!showCreate)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: T.purpleD, border: `1px solid ${T.purple}`, borderRadius: 8,
              color: T.purple, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Plus size={14} /> New Test
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: T.bgS, border: `1px solid ${T.purple}55`, borderRadius: 12,
          padding: 24, marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: T.purple }}>
            New A/B Test
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {([
              ['name', 'Test Name *', 'e.g. Onboarding CTA colour'],
              ['metric', 'Primary Metric', 'e.g. activation_rate'],
              ['hypothesis', 'Hypothesis', 'e.g. Red CTA → higher conversion'],
              ['description', 'Description', 'Additional context…'],
            ] as [keyof typeof form, string, string][]).map(([key, label, ph]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, color: T.t2, fontWeight: 600, marginBottom: 5 }}>
                  {label}
                </label>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={ph}
                  style={{ width: '100%', padding: '9px 12px', background: T.bgC,
                    border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.t1,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>

          {/* Variants */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.t2 }}>
                Variants — total: <span style={{ color: Math.abs(totalPct - 100) < 0.1 ? T.green : T.red }}>
                  {totalPct}%
                </span>
              </label>
              <button onClick={addVariant}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                  background: T.bgC, border: `1px solid ${T.bdr}`, borderRadius: 6,
                  color: T.t2, cursor: 'pointer', fontSize: 12 }}>
                <Plus size={11} /> Add Variant
              </button>
            </div>
            {newVariants.map((v, idx) => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 32px',
                gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input value={v.name} onChange={e => updateVariant(idx, 'name', e.target.value)}
                  placeholder="Name"
                  style={{ padding: '8px 10px', background: T.bgC, border: `1px solid ${T.bdr}`,
                    borderRadius: 7, color: T.t1, fontSize: 12, outline: 'none' }} />
                <input value={v.description} onChange={e => updateVariant(idx, 'description', e.target.value)}
                  placeholder="Description (optional)"
                  style={{ padding: '8px 10px', background: T.bgC, border: `1px solid ${T.bdr}`,
                    borderRadius: 7, color: T.t1, fontSize: 12, outline: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" min="0" max="100" value={v.percentage}
                    onChange={e => updateVariant(idx, 'percentage', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', background: T.bgC,
                      border: `1px solid ${T.bdr}`, borderRadius: 7, color: variantColors[idx % variantColors.length],
                      fontSize: 12, fontWeight: 700, outline: 'none', textAlign: 'right' }} />
                  <span style={{ fontSize: 11, color: T.t3 }}>%</span>
                </div>
                <button onClick={() => removeVariant(idx)} disabled={newVariants.length <= 2}
                  style={{ width: 32, height: 32, borderRadius: 7, background: T.redD,
                    border: `1px solid ${T.red}55`, color: T.red, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: newVariants.length <= 2 ? 0.3 : 1 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {createMutation.isError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: T.redD,
              border: `1px solid ${T.red}55`, borderRadius: 7, fontSize: 13, color: T.red }}>
              {(createMutation.error as Error).message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name}
              style={{ padding: '9px 20px', background: T.purpleD, border: `1px solid ${T.purple}`,
                borderRadius: 8, color: T.purple, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {createMutation.isPending ? 'Creating…' : 'Create Test (Draft)'}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${T.bdr}`,
                borderRadius: 8, color: T.t2, cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tests list */}
      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: T.t2 }}>Loading…</div>}
      {!isLoading && tests.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: T.t2 }}>
          No A/B tests yet. Create your first experiment above.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tests.map(test => {
          const expanded = expandedId === test._id;
          return (
            <div key={test._id} style={{ background: T.bgS, border: `1px solid ${T.bdr}`,
              borderRadius: 12, overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : test._id)}>
                {expanded ? <ChevronDown size={16} color={T.t3} /> : <ChevronRight size={16} color={T.t3} />}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{test.name}</span>
                    <StatusBadge status={test.status} />
                    {test.metric && (
                      <span style={{ fontSize: 11, color: T.t3 }}>metric: {test.metric}</span>
                    )}
                  </div>
                  {test.description && (
                    <div style={{ fontSize: 12, color: T.t2 }}>{test.description}</div>
                  )}
                </div>
                {/* Variant pills */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {test.variants.map((v, idx) => (
                    <span key={v.id} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                      background: `${variantColors[idx % variantColors.length]}18`,
                      color: variantColors[idx % variantColors.length], fontWeight: 600 }}>
                      {v.name} {v.percentage}%
                    </span>
                  ))}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  {test.status === 'draft' && (
                    <button onClick={() => lifMutation.mutate({ id: test._id, action: 'start' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                        background: T.greenD, border: `1px solid ${T.green}55`, borderRadius: 7,
                        color: T.green, cursor: 'pointer', fontSize: 12 }}>
                      <Play size={11} /> Start
                    </button>
                  )}
                  {test.status === 'running' && (
                    <button onClick={() => lifMutation.mutate({ id: test._id, action: 'pause' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                        background: T.amberD, border: `1px solid ${T.amber}55`, borderRadius: 7,
                        color: T.amber, cursor: 'pointer', fontSize: 12 }}>
                      <Pause size={11} /> Pause
                    </button>
                  )}
                  {test.status === 'paused' && (
                    <button onClick={() => lifMutation.mutate({ id: test._id, action: 'start' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                        background: T.greenD, border: `1px solid ${T.green}55`, borderRadius: 7,
                        color: T.green, cursor: 'pointer', fontSize: 12 }}>
                      <Play size={11} /> Resume
                    </button>
                  )}
                  {(test.status === 'running' || test.status === 'paused') && (
                    <button onClick={() => { if (confirm('End this test?')) lifMutation.mutate({ id: test._id, action: 'end' }); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                        background: T.redD, border: `1px solid ${T.red}55`, borderRadius: 7,
                        color: T.red, cursor: 'pointer', fontSize: 12 }}>
                      <StopCircle size={11} /> End
                    </button>
                  )}
                  {test.status === 'draft' && (
                    <button onClick={() => { if (confirm('Delete this test?')) lifMutation.mutate({ id: test._id, action: 'delete' }); }}
                      style={{ padding: '6px 10px', background: T.redD, border: `1px solid ${T.red}55`,
                        borderRadius: 7, color: T.red, cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div style={{ borderTop: `1px solid ${T.bdr}`, padding: '16px 20px' }}>
                  {test.hypothesis && (
                    <div style={{ marginBottom: 14, padding: '10px 14px', background: T.purpleD,
                      border: `1px solid ${T.purple}33`, borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: T.purple, fontWeight: 600 }}>Hypothesis: </span>
                      <span style={{ fontSize: 13, color: T.t2 }}>{test.hypothesis}</span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {test.variants.map((v, idx) => {
                      const color = variantColors[idx % variantColors.length];
                      const convs = test.conversionsByVariant?.[v.id] ?? 0;
                      const assignments = (test.assignments ?? []).filter(a => a.variantId === v.id).length;
                      return (
                        <div key={v.id} style={{ background: `${color}08`, border: `1px solid ${color}33`,
                          borderRadius: 10, padding: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{v.name}</div>
                          {v.description && <div style={{ fontSize: 11, color: T.t2, marginBottom: 8 }}>{v.description}</div>}
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 800, color }}>{v.percentage}%</div>
                              <div style={{ fontSize: 10, color: T.t3 }}>traffic</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: T.t1 }}>{assignments}</div>
                              <div style={{ fontSize: 10, color: T.t3 }}>orgs</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>{convs}</div>
                              <div style={{ fontSize: 10, color: T.t3 }}>conversions</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, color: T.t3 }}>
                    Created {new Date(test.createdAt).toLocaleDateString()}
                    {test.startedAt && ` · Started ${new Date(test.startedAt).toLocaleDateString()}`}
                    {test.endedAt && ` · Ended ${new Date(test.endedAt).toLocaleDateString()}`}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
