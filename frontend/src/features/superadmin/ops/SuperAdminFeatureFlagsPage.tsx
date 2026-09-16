/**
 * Super Admin — Feature Flags
 *
 * Two sections:
 *   1. Global flags   — platform-wide toggles (MAINTENANCE_MODE, BLOG_ENABLED, etc.)
 *   2. Per-org flags  — org-specific feature overrides with org picker + template selector
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Building2, Plus, Trash2, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import api from '@/utils/api';

// ─── Design tokens (matching SA portal) ──────────────────────────────────────

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
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeatureFlag {
  _id:            string;
  name:           string;
  scope:          'global' | 'org';
  enabled:        boolean;
  description:    string;
  orgId?:         string;
  lastChangedBy?: string;
  lastChangedAt?: string;
}

interface FlagTemplate { name: string; description: string }

interface GlobalFlagsResponse {
  flags:     FeatureFlag[];
  templates: FlagTemplate[];
}

interface OrgFlagsResponse {
  flags:     FeatureFlag[];
  templates: FlagTemplate[];
}

interface Org { _id: string; name: string; plan: string }

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchGlobalFlags  = (): Promise<GlobalFlagsResponse> =>
  api.get('/superadmin/flags').then(r => (r.data as { data: GlobalFlagsResponse }).data);

const fetchOrgFlags = (orgId: string): Promise<OrgFlagsResponse> =>
  api.get(`/superadmin/flags/org/${orgId}`).then(r => (r.data as { data: OrgFlagsResponse }).data);

const fetchOrgs = (): Promise<{ orgs: Org[] }> =>
  api.get('/superadmin/orgs?limit=200').then(r => (r.data as { data: { orgs: Org[] } }).data);

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ enabled, onChange, loading }: {
  enabled:  boolean;
  onChange: (v: boolean) => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={() => !loading && onChange(!enabled)}
      disabled={loading}
      title={enabled ? 'Disable flag' : 'Enable flag'}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: enabled ? T.green : T.t3,
        opacity: loading ? 0.6 : 1,
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        left: enabled ? 22 : 2,
        width: 20, height: 20,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

function FlagRow({ flag, onToggle, onDelete, showDelete }: {
  flag:       FeatureFlag;
  onToggle:   (id: string, enabled: boolean) => void;
  onDelete?:  (id: string) => void;
  showDelete?: boolean;
}) {
  const isMaintenanceMode = flag.name === 'MAINTENANCE_MODE';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 18px',
      borderBottom: `1px solid ${T.bdr}`,
    }}>
      {/* Flag indicator dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: flag.enabled ? T.green : T.t3,
        boxShadow: flag.enabled ? `0 0 6px ${T.green}` : 'none',
        transition: 'all 0.2s',
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{
            fontSize: 12, fontWeight: 700, color: T.t1,
            fontFamily: 'monospace',
          }}>
            {flag.name}
          </code>
          {isMaintenanceMode && flag.enabled && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 6px', borderRadius: 4, fontSize: 10,
              background: 'rgba(239,68,68,0.15)', color: T.red,
              fontWeight: 700, border: `1px solid rgba(239,68,68,0.3)`,
            }}>
              <AlertTriangle size={10} /> ACTIVE
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: T.t2, margin: '3px 0 0', lineHeight: 1.4 }}>
          {flag.description}
        </p>
        {flag.lastChangedBy && (
          <p style={{ fontSize: 11, color: T.t3, margin: '3px 0 0' }}>
            Last changed by {flag.lastChangedBy}
            {flag.lastChangedAt && ` · ${new Date(flag.lastChangedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: flag.enabled ? T.green : T.t3, fontWeight: 600 }}>
          {flag.enabled ? 'ON' : 'OFF'}
        </span>
        <Toggle
          enabled={flag.enabled}
          onChange={(v) => onToggle(flag._id, v)}
        />
        {showDelete && onDelete && (
          <button
            onClick={() => onDelete(flag._id)}
            title="Delete flag"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'transparent', color: T.t3, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
              e.currentTarget.style.color = T.red;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = T.t3;
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperAdminFeatureFlagsPage() {
  const qc = useQueryClient();

  // Global flags
  const { data: globalData, isLoading: loadingGlobal, refetch: refetchGlobal } = useQuery({
    queryKey: ['sa-flags-global'],
    queryFn:  fetchGlobalFlags,
  });

  // Orgs (for org picker)
  const { data: orgsData } = useQuery({
    queryKey: ['sa-orgs-all'],
    queryFn:  fetchOrgs,
  });

  // Selected org for per-org flags
  const [selectedOrgId, setSelectedOrgId] = useState('');

  const { data: orgFlagsData, isLoading: loadingOrgFlags, refetch: refetchOrgFlags } = useQuery({
    queryKey: ['sa-flags-org', selectedOrgId],
    queryFn:  () => fetchOrgFlags(selectedOrgId),
    enabled:  !!selectedOrgId,
  });

  // Create org flag modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName]           = useState('');
  const [createDesc, setCreateDesc]           = useState('');
  const [createEnabled, setCreateEnabled]     = useState(false);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/superadmin/flags/${id}/toggle`, { enabled }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sa-flags-global'] });
      void qc.invalidateQueries({ queryKey: ['sa-flags-org', selectedOrgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/flags/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sa-flags-org', selectedOrgId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/superadmin/flags/org', {
      orgId:       selectedOrgId,
      name:        createName,
      description: createDesc,
      enabled:     createEnabled,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sa-flags-org', selectedOrgId] });
      setShowCreateModal(false);
      setCreateName(''); setCreateDesc(''); setCreateEnabled(false);
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleToggle = (id: string, enabled: boolean) => {
    toggleMutation.mutate({ id, enabled });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this feature flag? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const orgs = orgsData?.orgs ?? [];
  const selectedOrg = orgs.find(o => o._id === selectedOrgId);

  // Templates not yet assigned to this org
  const assignedNames = new Set((orgFlagsData?.flags ?? []).map(f => f.name));
  const availableTemplates = (orgFlagsData?.templates ?? []).filter(t => !assignedNames.has(t.name));

  // ── Render ────────────────────────────────────────────────────────────────

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{
      background: T.bgS,
      border: `1px solid ${T.bdr}`,
      borderRadius: 12,
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );

  const sectionHeader = (icon: React.ReactNode, title: string, subtitle: string, actions?: React.ReactNode) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 18px',
      borderBottom: `1px solid ${T.bdr}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: 0 }}>{title}</p>
          <p style={{ fontSize: 12, color: T.t2, margin: '2px 0 0' }}>{subtitle}</p>
        </div>
      </div>
      {actions}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: 0 }}>Feature Flags</h1>
        <p style={{ fontSize: 13, color: T.t2, margin: '6px 0 0' }}>
          Control platform behaviour and per-org capabilities without a deploy.
        </p>
      </div>

      {/* ── GLOBAL FLAGS ────────────────────────────────────────────────────── */}
      {card(
        <>
          {sectionHeader(
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Globe size={16} color={T.blue} />
            </div>,
            'Global Flags',
            'Platform-wide toggles — affect all organisations immediately',
            <button
              onClick={() => refetchGlobal()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.bdr}`,
                background: 'transparent', color: T.t2, fontSize: 12, cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} />
              Refresh
            </button>,
          )}

          {loadingGlobal ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.t3, fontSize: 13 }}>
              Loading flags…
            </div>
          ) : (globalData?.flags ?? []).length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.t3, fontSize: 13 }}>
              No global flags found.
            </div>
          ) : (
            <div>
              {(globalData?.flags ?? []).map(flag => (
                <FlagRow
                  key={flag._id}
                  flag={flag}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}

          {/* MAINTENANCE_MODE warning banner */}
          {(globalData?.flags ?? []).some(f => f.name === 'MAINTENANCE_MODE' && f.enabled) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              margin: '0 18px 18px',
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: `1px solid rgba(239,68,68,0.3)`,
            }}>
              <AlertTriangle size={16} color={T.red} />
              <p style={{ fontSize: 12, color: T.redL, margin: 0, fontWeight: 600 }}>
                MAINTENANCE_MODE is active — all non-super-admin requests are returning 503.
              </p>
            </div>
          )}
        </>,
      )}

      {/* ── PER-ORG FLAGS ────────────────────────────────────────────────────── */}
      {card(
        <>
          {sectionHeader(
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Building2 size={16} color={T.green} />
            </div>,
            'Per-Org Flags',
            'Override feature availability for a specific organisation',
          )}

          {/* Org picker */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.bdr}` }}>
            <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Select Organisation
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              style={{
                width: '100%', maxWidth: 400, padding: '8px 10px',
                background: T.bgC, border: `1px solid ${T.bdr}`,
                borderRadius: 8, color: T.t1, fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="">— Choose an org —</option>
              {orgs.map(org => (
                <option key={org._id} value={org._id}>
                  {org.name} ({org.plan})
                </option>
              ))}
            </select>
          </div>

          {/* Org flags list */}
          {!selectedOrgId ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.t3, fontSize: 13 }}>
              Select an organisation to view and manage its flags.
            </div>
          ) : loadingOrgFlags ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.t3, fontSize: 13 }}>
              Loading flags for {selectedOrg?.name ?? selectedOrgId}…
            </div>
          ) : (
            <>
              {(orgFlagsData?.flags ?? []).length === 0 ? (
                <div style={{ padding: '24px 18px', color: T.t3, fontSize: 13 }}>
                  No custom flags set for this org yet.
                </div>
              ) : (
                <div>
                  {(orgFlagsData?.flags ?? []).map(flag => (
                    <FlagRow
                      key={flag._id}
                      flag={flag}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      showDelete
                    />
                  ))}
                </div>
              )}

              {/* Add flag bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px',
                borderTop: `1px solid ${T.bdr}`,
              }}>
                <p style={{ fontSize: 12, color: T.t2, margin: 0 }}>
                  {(orgFlagsData?.flags ?? []).length} flag{(orgFlagsData?.flags ?? []).length !== 1 ? 's' : ''} active for this org
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8,
                    border: `1px solid rgba(34,197,94,0.3)`,
                    background: 'rgba(34,197,94,0.08)', color: T.green,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Plus size={13} />
                  Add Flag
                </button>
              </div>
            </>
          )}
        </>,
      )}

      {/* ── CREATE FLAG MODAL ─────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <div style={{
            background: T.bgS, borderRadius: 14, padding: 28,
            width: 480, border: `1px solid ${T.bdrB}`,
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.t1, margin: '0 0 20px' }}>
              Add Flag for {selectedOrg?.name}
            </h3>

            {/* Templates (if available) */}
            {availableTemplates.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: T.t2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                  Quick-select template
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {availableTemplates.map(t => (
                    <button
                      key={t.name}
                      onClick={() => { setCreateName(t.name); setCreateDesc(t.description); }}
                      style={{
                        padding: '8px 10px', borderRadius: 8, textAlign: 'left',
                        border: `1px solid ${createName === t.name ? T.green : T.bdr}`,
                        background: createName === t.name ? 'rgba(34,197,94,0.08)' : 'transparent',
                        color: createName === t.name ? T.green : T.t2,
                        fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {createName === t.name && <Check size={11} />}
                        <code style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11 }}>{t.name}</code>
                      </div>
                      <p style={{ fontSize: 11, color: T.t3, margin: '3px 0 0', lineHeight: 1.3 }}>{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Flag name <span style={{ color: T.red }}>*</span>
              </label>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="MY_CUSTOM_FLAG"
                style={{
                  width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                  background: T.bgC, border: `1px solid ${T.bdr}`,
                  borderRadius: 8, color: T.t1, fontSize: 13,
                  fontFamily: 'monospace', outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Description
              </label>
              <input
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="What does this flag control?"
                style={{
                  width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                  background: T.bgC, border: `1px solid ${T.bdr}`,
                  borderRadius: 8, color: T.t1, fontSize: 13, outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <Toggle enabled={createEnabled} onChange={setCreateEnabled} />
              <span style={{ fontSize: 13, color: T.t2 }}>
                Enable immediately after creation
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  border: `1px solid ${T.bdr}`, background: 'transparent',
                  color: T.t2, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!createName || createMutation.isPending}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  border: 'none',
                  background: (!createName || createMutation.isPending) ? T.t3 : T.green,
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: (!createName || createMutation.isPending) ? 'not-allowed' : 'pointer',
                }}
              >
                {createMutation.isPending ? 'Creating…' : 'Create Flag'}
              </button>
            </div>

            {createMutation.isError && (
              <p style={{ fontSize: 12, color: T.red, marginTop: 10, textAlign: 'center' }}>
                Failed to create flag. Check that this flag name is not already set for this org.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
