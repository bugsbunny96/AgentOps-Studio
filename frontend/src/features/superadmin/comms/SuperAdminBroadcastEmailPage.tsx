/**
 * Super Admin — Broadcast Email
 *
 * Compose + send mass emails to all users, a plan tier, or a specific org.
 * • Live HTML preview in split pane
 * • Recipient count preview (via /broadcast-email/preview)
 * • Confirmation phrase modal before send: must type "send to all users" or "send to <plan>" etc.
 * • Read-only send history stub (future: pull from audit logs)
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Send, Users, Building2, Eye, EyeOff, AlertTriangle, CheckCircle,
  ChevronDown, Info,
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
  indigo:'#6366f1',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type AudienceType = 'all' | 'plan' | 'org';
type PlanTier = 'free' | 'starter' | 'growth' | 'enterprise';

interface Org { _id: string; name: string; plan: string }

interface PreviewResult {
  audience:        AudienceType;
  recipientCount:  number;
  sampleEmails:    string[];
  confirmPhrase:   string;
}

interface ComposeState {
  audience:   AudienceType;
  plan:       PlanTier;
  orgId:      string;
  subject:    string;
  htmlBody:   string;
}

const INITIAL: ComposeState = {
  audience: 'all',
  plan:     'free',
  orgId:    '',
  subject:  '',
  htmlBody: '',
};

const PLAN_LABELS: Record<PlanTier, string> = {
  free:       'Free',
  starter:    'Starter',
  growth:     'Growth',
  enterprise: 'Enterprise',
};

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchOrgs = async (): Promise<Org[]> => {
  const { data } = await api.get('/superadmin/orgs?limit=200');
  return data.data?.orgs ?? [];
};

const previewBroadcast = async (params: {
  audience: AudienceType;
  plan?: string;
  orgId?: string;
}): Promise<PreviewResult> => {
  const { data } = await api.post('/superadmin/broadcast-email/preview', params);
  return data.data;
};

const sendBroadcast = async (body: {
  audience: AudienceType;
  plan?: string;
  orgId?: string;
  subject: string;
  htmlBody: string;
}): Promise<{ sent: number; skipped: number }> => {
  const { data } = await api.post('/superadmin/broadcast-email', body);
  return data.data;
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: T.bgC, border: `1px solid ${T.bdr}`,
  borderRadius: 8, padding: '9px 12px',
  color: T.t1, fontSize: 13, outline: 'none',
};

const sLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: T.t2,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  display: 'block', marginBottom: 6,
};

// ─── HTML Template Presets ────────────────────────────────────────────────────

const TEMPLATES: { label: string; html: string }[] = [
  {
    label: 'Announcement',
    html: `<h2 style="color:#f8fafc;font-family:system-ui,sans-serif;margin:0 0 12px">📢 Announcement Title</h2>
<p style="color:#94a3b8;font-family:system-ui,sans-serif;line-height:1.7;margin:0 0 20px">
  Write your announcement body here. Keep it concise and action-focused.
</p>
<a href="https://app.agentops.studio" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-family:system-ui,sans-serif">
  Learn More →
</a>`,
  },
  {
    label: 'Maintenance',
    html: `<h2 style="color:#f59e0b;font-family:system-ui,sans-serif;margin:0 0 12px">⚠️ Scheduled Maintenance</h2>
<p style="color:#94a3b8;font-family:system-ui,sans-serif;line-height:1.7;margin:0 0 12px">
  We will be performing scheduled maintenance on <strong style="color:#f8fafc">[DATE]</strong> from <strong style="color:#f8fafc">[TIME] to [TIME] IST</strong>.
</p>
<p style="color:#94a3b8;font-family:system-ui,sans-serif;line-height:1.7;margin:0">
  During this window, the platform may be temporarily unavailable. We apologise for any inconvenience.
</p>`,
  },
  {
    label: 'Feature Launch',
    html: `<h2 style="color:#14b8a6;font-family:system-ui,sans-serif;margin:0 0 12px">✨ Introducing [Feature Name]</h2>
<p style="color:#94a3b8;font-family:system-ui,sans-serif;line-height:1.7;margin:0 0 16px">
  We're excited to announce [brief description of what the feature does and why it matters].
</p>
<ul style="color:#94a3b8;font-family:system-ui,sans-serif;line-height:1.9;margin:0 0 20px;padding-left:20px">
  <li>Benefit one</li>
  <li>Benefit two</li>
  <li>Benefit three</li>
</ul>
<a href="https://app.agentops.studio" style="display:inline-block;padding:10px 20px;background:#14b8a6;color:#000;border-radius:8px;text-decoration:none;font-weight:600;font-family:system-ui,sans-serif">
  Try it now →
</a>`,
  },
];

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmSendModal({
  phrase,
  recipientCount,
  subject,
  onConfirm,
  onCancel,
  sending,
}: {
  phrase: string;
  recipientCount: number;
  subject: string;
  onConfirm: () => void;
  onCancel: () => void;
  sending: boolean;
}) {
  const [typed, setTyped] = useState('');
  const match = typed.trim().toLowerCase() === phrase.toLowerCase();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 460, background: T.bgS, border: `1px solid rgba(239,68,68,0.3)`,
        borderRadius: 14, padding: 28,
      }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <AlertTriangle size={20} color={T.red} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h3 style={{ margin: '0 0 4px', color: T.t1, fontSize: 16, fontWeight: 700 }}>
              Confirm Broadcast
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: T.t2 }}>
              This will send <strong style={{ color: T.t1 }}>"{subject}"</strong> to{' '}
              <strong style={{ color: T.amber }}>{recipientCount} recipients</strong>.
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p style={{ margin: '0 0 8px', fontSize: 12, color: T.t2 }}>
          Type <code style={{ background: T.bgC, padding: '2px 6px', borderRadius: 4, color: T.t1 }}>
            {phrase}
          </code> to confirm:
        </p>
        <input
          autoFocus
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={phrase}
          style={{
            ...inputStyle,
            marginBottom: 20,
            border: `1px solid ${match ? T.green : T.bdr}`,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{
            padding: '8px 18px', borderRadius: 8, border: `1px solid ${T.bdr}`,
            background: 'transparent', color: T.t2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!match || sending}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: match ? T.red : T.t3,
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: !match || sending ? 'not-allowed' : 'pointer',
              opacity: !match || sending ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Send size={14} />
            {sending ? 'Sending…' : `Send to ${recipientCount}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdminBroadcastEmailPage() {
  const [compose, setCompose] = useState<ComposeState>(INITIAL);
  const [showPreview, setShowPreview] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sentResult, setSentResult] = useState<{ sent: number; skipped: number } | null>(null);

  const set = useCallback(<K extends keyof ComposeState>(k: K, v: ComposeState[K]) =>
    setCompose(f => ({ ...f, [k]: v })), []);

  // Org list for org-targeted sends
  const { data: orgs = [] } = useQuery({ queryKey: ['sa-orgs-min'], queryFn: fetchOrgs });

  // Preview mutation (called on demand)
  const previewMut = useMutation({ mutationFn: previewBroadcast });

  const handlePreview = () => {
    previewMut.mutate({
      audience: compose.audience,
      plan:     compose.audience === 'plan' ? compose.plan : undefined,
      orgId:    compose.audience === 'org'  ? compose.orgId : undefined,
    });
  };

  // Send mutation
  const sendMut = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: (result) => {
      setSentResult(result);
      setConfirmOpen(false);
      setCompose(INITIAL);
      previewMut.reset();
    },
  });

  const handleSend = () => {
    sendMut.mutate({
      audience: compose.audience,
      plan:     compose.audience === 'plan' ? compose.plan : undefined,
      orgId:    compose.audience === 'org'  ? compose.orgId : undefined,
      subject:  compose.subject,
      htmlBody: compose.htmlBody,
    });
  };

  const canSend = compose.subject.trim() && compose.htmlBody.trim() &&
    (compose.audience !== 'org' || compose.orgId);

  const audienceLabel =
    compose.audience === 'all'  ? 'all users'
    : compose.audience === 'plan' ? `${PLAN_LABELS[compose.plan]} users`
    : orgs.find(o => o._id === compose.orgId)?.name ?? 'selected org';

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '32px 36px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: 'rgba(99,102,241,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Send size={20} color={T.indigo} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.t1 }}>Broadcast Email</h1>
            <p style={{ margin: 0, fontSize: 12, color: T.t2, marginTop: 2 }}>
              Send platform-wide or targeted emails to your users
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowPreview(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            border: `1px solid ${T.bdr}`, background: T.bgC,
            color: T.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {/* Success banner */}
      {sentResult && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', borderRadius: 10, marginBottom: 20,
          background: 'rgba(34,197,94,0.1)', border: `1px solid rgba(34,197,94,0.3)`,
          color: T.greenL,
        }}>
          <CheckCircle size={16} />
          <span style={{ fontSize: 13 }}>
            Email sent to <strong>{sentResult.sent}</strong> recipients.
            {sentResult.skipped > 0 && ` (${sentResult.skipped} skipped — no email on file)`}
          </span>
          <button onClick={() => setSentResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.t3, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* Left: Compose */}
        <div style={{
          background: T.bgS, border: `1px solid ${T.bdr}`,
          borderRadius: 12, padding: 24,
        }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: T.t1 }}>Compose</h2>

          {/* Audience selector */}
          <div style={{ marginBottom: 16 }}>
            <span style={sLabel}>Audience</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { v: 'all',  label: 'All Users',   icon: <Users size={13} /> },
                { v: 'plan', label: 'By Plan',      icon: <ChevronDown size={13} /> },
                { v: 'org',  label: 'By Org',       icon: <Building2 size={13} /> },
              ] as { v: AudienceType; label: string; icon: React.ReactNode }[]).map(({ v, label, icon }) => (
                <button key={v} onClick={() => set('audience', v)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: `1px solid ${compose.audience === v ? T.indigo : T.bdr}`,
                  background: compose.audience === v ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: compose.audience === v ? T.blueL : T.t2,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Plan picker (conditional) */}
          {compose.audience === 'plan' && (
            <div style={{ marginBottom: 16 }}>
              <span style={sLabel}>Plan Tier</span>
              <select value={compose.plan} onChange={e => set('plan', e.target.value as PlanTier)} style={inputStyle}>
                {(Object.entries(PLAN_LABELS) as [PlanTier, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          )}

          {/* Org picker (conditional) */}
          {compose.audience === 'org' && (
            <div style={{ marginBottom: 16 }}>
              <span style={sLabel}>Organization</span>
              <select value={compose.orgId} onChange={e => set('orgId', e.target.value)} style={inputStyle}>
                <option value="">— Select org —</option>
                {orgs.map(o => (
                  <option key={o._id} value={o._id}>{o.name} ({o.plan})</option>
                ))}
              </select>
            </div>
          )}

          {/* Subject */}
          <div style={{ marginBottom: 16 }}>
            <span style={sLabel}>Subject</span>
            <input
              value={compose.subject}
              onChange={e => set('subject', e.target.value)}
              placeholder="e.g. Important platform update"
              style={inputStyle}
            />
          </div>

          {/* Templates */}
          <div style={{ marginBottom: 10 }}>
            <span style={sLabel}>HTML Body</span>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => set('htmlBody', t.html)} style={{
                  padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.bdr}`,
                  background: T.bgC, color: T.t2, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={compose.htmlBody}
              onChange={e => set('htmlBody', e.target.value)}
              placeholder="<h2>Hello!</h2><p>Your message here...</p>"
              rows={12}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />
          </div>

          {/* Info strip */}
          <div style={{
            display: 'flex', gap: 6, alignItems: 'flex-start',
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(99,102,241,0.08)', border: `1px solid rgba(99,102,241,0.2)`,
            marginBottom: 18,
          }}>
            <Info size={13} color={T.blueL} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 11, color: T.t2, lineHeight: 1.6 }}>
              HTML is wrapped in a branded AgentOps email shell automatically.
              Emails are sent in batches of 50. A confirmation phrase is required before sending.
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handlePreview}
              disabled={previewMut.isPending || compose.audience === 'org' && !compose.orgId}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8,
                border: `1px solid ${T.bdrB}`, background: T.bgC,
                color: T.t1, fontSize: 13, fontWeight: 600,
                cursor: previewMut.isPending ? 'not-allowed' : 'pointer',
                opacity: previewMut.isPending ? 0.6 : 1,
              }}
            >
              {previewMut.isPending ? 'Loading…' : 'Preview Recipients'}
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSend}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: canSend ? T.indigo : T.t3,
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: canSend ? 'pointer' : 'not-allowed',
                opacity: canSend ? 1 : 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Send size={14} /> Send Email
            </button>
          </div>

          {/* Recipient preview */}
          {previewMut.data && (
            <RecipientPreview data={previewMut.data} />
          )}
          {previewMut.isError && (
            <p style={{ color: T.red, fontSize: 12, marginTop: 10 }}>Failed to load recipient preview.</p>
          )}
        </div>

        {/* Right: HTML Preview */}
        {showPreview && (
          <div style={{
            background: T.bgS, border: `1px solid ${T.bdr}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 18px', borderBottom: `1px solid ${T.bdr}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Eye size={14} color={T.t3} />
              <span style={{ fontSize: 12, color: T.t2, fontWeight: 600 }}>
                HTML Preview
              </span>
              {compose.subject && (
                <span style={{
                  marginLeft: 'auto', fontSize: 11, color: T.t3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 200,
                }}>
                  {compose.subject}
                </span>
              )}
            </div>
            <div style={{ padding: 20, minHeight: 400 }}>
              {/* Email shell mock */}
              <div style={{
                background: '#111', borderRadius: 10,
                padding: '24px 28px', maxWidth: 560, margin: '0 auto',
                border: `1px solid rgba(255,255,255,0.06)`,
              }}>
                {/* Brand header */}
                <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                    AgentOps<span style={{ color: T.indigo }}>.</span>
                  </span>
                </div>
                {/* Injected HTML */}
                {compose.htmlBody ? (
                  <div
                    // biome-ignore lint: this is controlled SA content, not user-generated
                    dangerouslySetInnerHTML={{ __html: compose.htmlBody }}
                    style={{ lineHeight: 1.7 }}
                  />
                ) : (
                  <p style={{ color: T.t3, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                    Your email content will appear here.
                  </p>
                )}
                {/* Footer */}
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid rgba(255,255,255,0.08)`, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
                    Sent by AgentOps Studio · To: {audienceLabel}
                    <br />© 2025 AgentOps Studio. All rights reserved.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <ConfirmSendModal
          phrase={previewMut.data?.confirmPhrase ?? `send to ${audienceLabel}`}
          recipientCount={previewMut.data?.recipientCount ?? 0}
          subject={compose.subject}
          onConfirm={handleSend}
          onCancel={() => setConfirmOpen(false)}
          sending={sendMut.isPending}
        />
      )}
    </div>
  );
}

// ─── Recipient Preview Panel ───────────────────────────────────────────────────

function RecipientPreview({ data }: { data: PreviewResult }) {
  return (
    <div style={{
      marginTop: 16, padding: '12px 16px', borderRadius: 8,
      background: T.bgC, border: `1px solid ${T.bdr}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.t2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Recipients
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: T.amber,
          background: 'rgba(245,158,11,0.1)', padding: '2px 10px', borderRadius: 99,
        }}>
          {data.recipientCount.toLocaleString()}
        </span>
      </div>
      {data.sampleEmails.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {data.sampleEmails.slice(0, 5).map(e => (
            <span key={e} style={{ fontSize: 11, color: T.t3, fontFamily: 'monospace' }}>{e}</span>
          ))}
          {data.recipientCount > 5 && (
            <span style={{ fontSize: 11, color: T.t3 }}>
              +{data.recipientCount - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
