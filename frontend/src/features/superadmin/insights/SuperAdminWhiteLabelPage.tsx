/**
 * 19.7 — White-label / Sub-brand support
 * SA can set per-org branding config (logo, primary colour, company name)
 * or clear it back to default.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Palette, Save, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/utils/api';

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  red: '#ef4444', redD: 'rgba(239,68,68,0.12)',
  blue: '#3b82f6', blueD: 'rgba(59,130,246,0.12)',
  green: '#22c55e', greenD: 'rgba(34,197,94,0.12)',
  t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

interface WhiteLabelConfig {
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  faviconUrl: string;
  supportEmail: string;
  customDomain: string;
}

const defaultForm: WhiteLabelConfig = {
  companyName: '', logoUrl: '', primaryColor: '#3b82f6',
  faviconUrl: '', supportEmail: '', customDomain: '',
};

function Field({ label, value, onChange, placeholder, type = 'text' }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.t2, marginBottom: 6 }}>
        {label}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', background: T.bgC,
          border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.t1, fontSize: 13,
          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
    </div>
  );
}

export default function SuperAdminWhiteLabelPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<WhiteLabelConfig>(defaultForm);
  const [saved, setSaved] = useState(false);

  const setMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/superadmin/orgs/${orgId}/white-label`, { ...form, enabled: true });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      void qc.invalidateQueries({ queryKey: ['sa-org', orgId] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/superadmin/orgs/${orgId}/white-label`);
    },
    onSuccess: () => {
      setForm(defaultForm);
      void qc.invalidateQueries({ queryKey: ['sa-org', orgId] });
    },
  });

  function set(key: keyof WhiteLabelConfig) {
    return (v: string) => setForm(f => ({ ...f, [key]: v }));
  }

  return (
    <div style={{ padding: '32px 40px', background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'transparent', border: `1px solid ${T.bdr}`, borderRadius: 7,
            color: T.t2, cursor: 'pointer', fontSize: 13 }}>
          <ArrowLeft size={13} /> Back
        </button>
        <Palette size={20} color={T.blue} />
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>White-label Branding</h1>
          <p style={{ margin: 0, fontSize: 12, color: T.t2, marginTop: 2 }}>
            Org ID: <code style={{ color: T.blue }}>{orgId}</code>
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 28 }}>
          <h2 style={{ margin: '0 0 22px', fontSize: 14, fontWeight: 700, color: T.t2,
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>Branding Configuration</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Company Name" value={form.companyName} onChange={set('companyName')}
              placeholder="Acme Corp" />
            <Field label="Logo URL" value={form.logoUrl} onChange={set('logoUrl')}
              placeholder="https://cdn.example.com/logo.png" />
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.t2, marginBottom: 6 }}>
                Primary Colour
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" value={form.primaryColor}
                  onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                  style={{ width: 44, height: 36, padding: 2, background: T.bgC,
                    border: `1px solid ${T.bdr}`, borderRadius: 7, cursor: 'pointer' }} />
                <input type="text" value={form.primaryColor}
                  onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                  placeholder="#3b82f6"
                  style={{ flex: 1, padding: '9px 12px', background: T.bgC,
                    border: `1px solid ${T.bdr}`, borderRadius: 8, color: T.t1,
                    fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
                <div style={{ width: 36, height: 36, borderRadius: 8, background: form.primaryColor,
                  border: `1px solid ${T.bdr}`, flexShrink: 0 }} />
              </div>
            </div>
            <Field label="Favicon URL" value={form.faviconUrl} onChange={set('faviconUrl')}
              placeholder="https://cdn.example.com/favicon.ico" />
            <Field label="Support Email" value={form.supportEmail} onChange={set('supportEmail')}
              placeholder="support@acmecorp.com" type="email" />
            <Field label="Custom Domain" value={form.customDomain} onChange={set('customDomain')}
              placeholder="app.acmecorp.com" />
          </div>

          {/* Preview strip */}
          {form.primaryColor && (
            <div style={{ marginTop: 20, padding: 14, background: `${form.primaryColor}11`,
              border: `1px solid ${form.primaryColor}44`, borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: T.t2, marginBottom: 8, fontWeight: 600 }}>Preview</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {form.logoUrl && (
                  <img src={form.logoUrl} alt="logo preview" onError={() => {}}
                    style={{ height: 32, borderRadius: 4, objectFit: 'contain', background: '#fff',
                      padding: 2, border: `1px solid ${T.bdr}` }} />
                )}
                <span style={{ fontSize: 16, fontWeight: 700, color: T.t1 }}>
                  {form.companyName || 'Company Name'}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 13,
                  background: form.primaryColor, color: '#fff', fontWeight: 600 }}>
                  Branded Button
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => setMutation.mutate()} disabled={setMutation.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                background: saved ? T.greenD : T.blueD, border: `1px solid ${saved ? T.green : T.blue}`,
                borderRadius: 8, color: saved ? T.green : T.blue, cursor: 'pointer',
                fontSize: 13, fontWeight: 600 }}>
              <Save size={14} />
              {setMutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Branding'}
            </button>
            <button onClick={() => { if (confirm('Clear all white-label config for this org?')) clearMutation.mutate(); }}
              disabled={clearMutation.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                background: T.redD, border: `1px solid ${T.red}`, borderRadius: 8,
                color: T.red, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <Trash2 size={14} />
              {clearMutation.isPending ? 'Clearing…' : 'Clear Branding'}
            </button>
          </div>

          {setMutation.isError && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: T.redD,
              border: `1px solid ${T.red}55`, borderRadius: 8, fontSize: 13, color: T.red }}>
              Failed to save. Check org ID and try again.
            </div>
          )}
        </div>

        {/* Public branding endpoint note */}
        <div style={{ marginTop: 16, padding: '12px 16px', background: T.bgC,
          border: `1px solid ${T.bdr}`, borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: T.t3, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: 4 }}>
            Public Endpoint
          </div>
          <code style={{ fontSize: 12, color: T.t2 }}>
            GET /api/v1/org-branding/{orgId}
          </code>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: T.t3 }}>
            Returns branding config (logo, color, name) for the customer's frontend to load at runtime.
            Returns 404 if white-label is not enabled.
          </p>
        </div>
      </div>
    </div>
  );
}
