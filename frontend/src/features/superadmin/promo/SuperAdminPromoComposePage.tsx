/**
 * SuperAdminPromoComposePage
 * Create or edit a promo code.
 *
 * Routes:
 *   /superadmin/promo/new         — create
 *   /superadmin/promo/:id/edit    — edit existing
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Tag } from 'lucide-react';
import api from '@/utils/api';

// ─── Styles ───────────────────────────────────────────────────────────────────

const T = {
  bg: '#07070f', bgS: '#0e0e1a', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)',
  red: '#ef4444', green: '#10b981', t1: '#f8fafc', t2: '#94a3b8', t3: '#475569',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t1,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: T.t3,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 5,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  cursor: 'pointer',
};

// ─── Default form state ────────────────────────────────────────────────────────

interface FormState {
  code:          string;
  discountType:  'percent' | 'fixed_inr';
  discountValue: string;
  appliesTo:     'starter' | 'growth' | 'both' | 'all';
  billingCycle:  'monthly' | 'annual' | 'both';
  maxUses:       string;
  validFrom:     string;
  validUntil:    string;
  notes:         string;
}

const DEFAULTS: FormState = {
  code:          '',
  discountType:  'percent',
  discountValue: '',
  appliesTo:     'both',
  billingCycle:  'both',
  maxUses:       '',
  validFrom:     new Date().toISOString().split('T')[0],
  validUntil:    '',
  notes:         '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuperAdminPromoComposePage() {
  const navigate = useNavigate();
  const { id }   = useParams<{ id?: string }>();
  const qc       = useQueryClient();
  const isEdit   = Boolean(id);

  const [form, setForm]         = useState<FormState>(DEFAULTS);
  const [serverErr, setServerErr] = useState<string | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Load for edit
  useQuery({
    queryKey: ['sa-promo-edit', id],
    enabled:  isEdit,
    queryFn:  async () => {
      const r = await api.get(`/superadmin/promo/${id}`);
      return r.data.data;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (data: any) => {
      setForm({
        code:          data.code ?? '',
        discountType:  data.discountType ?? 'percent',
        discountValue: String(data.discountValue ?? ''),
        appliesTo:     data.appliesTo ?? 'both',
        billingCycle:  data.billingCycle ?? 'both',
        maxUses:       data.maxUses != null ? String(data.maxUses) : '',
        validFrom:     data.validFrom ? new Date(data.validFrom).toISOString().split('T')[0] : '',
        validUntil:    data.validUntil ? new Date(data.validUntil).toISOString().split('T')[0] : '',
        notes:         data.notes ?? '',
      });
      return data;
    },
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        code:          form.code.trim().toUpperCase(),
        discountType:  form.discountType,
        discountValue: Number(form.discountValue),
        appliesTo:     form.appliesTo,
        billingCycle:  form.billingCycle,
        maxUses:       form.maxUses ? Number(form.maxUses) : null,
        validFrom:     form.validFrom || undefined,
        validUntil:    form.validUntil || null,
        notes:         form.notes.trim(),
      };
      return isEdit
        ? api.patch(`/superadmin/promo/${id}`, payload)
        : api.post('/superadmin/promo', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-promo'] });
      navigate('/superadmin/promo');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setServerErr(msg ?? 'Something went wrong. Please try again.');
    },
  });

  const canSave = form.code.trim() && form.discountValue && Number(form.discountValue) > 0;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => navigate('/superadmin/promo')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.t2, fontSize: 13, cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.t1, margin: 0 }}>
          {isEdit ? 'Edit Promo Code' : 'Create Promo Code'}
        </h1>
      </div>

      {serverErr && (
        <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 20 }}>
          {serverErr}
        </div>
      )}

      <div style={{ background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Code + preview */}
        <div>
          <label style={labelStyle}>Code <span style={{ color: T.red }}>*</span></label>
          <input
            value={form.code}
            onChange={set('code')}
            placeholder="LAUNCH50"
            disabled={isEdit} // Can't change code after creation
            style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 800, fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: isEdit ? 0.6 : 1 }}
          />
          <p style={{ fontSize: 11, color: T.t3, margin: '5px 0 0' }}>
            2–30 uppercase letters, numbers, hyphens, or underscores. Cannot be changed after creation.
          </p>
        </div>

        {/* Discount type + value */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Discount Type <span style={{ color: T.red }}>*</span></label>
            <select value={form.discountType} onChange={set('discountType')} style={selectStyle}>
              <option value="percent">Percentage (%)</option>
              <option value="fixed_inr">Fixed amount (₹)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Discount Value <span style={{ color: T.red }}>*</span>
              <span style={{ color: T.t3, fontWeight: 400, marginLeft: 4 }}>
                {form.discountType === 'percent' ? '(0–100)' : '(₹)'}
              </span>
            </label>
            <input
              type="number"
              min={0}
              max={form.discountType === 'percent' ? 100 : undefined}
              value={form.discountValue}
              onChange={set('discountValue')}
              placeholder={form.discountType === 'percent' ? '50' : '2000'}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Applies to + billing cycle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Applies To</label>
            <select value={form.appliesTo} onChange={set('appliesTo')} style={selectStyle}>
              <option value="starter">Starter only</option>
              <option value="growth">Growth only</option>
              <option value="both">Starter + Growth</option>
              <option value="all">All plans</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Billing Cycle</label>
            <select value={form.billingCycle} onChange={set('billingCycle')} style={selectStyle}>
              <option value="monthly">Monthly only</option>
              <option value="annual">Annual only</option>
              <option value="both">Monthly + Annual</option>
            </select>
          </div>
        </div>

        {/* Max uses */}
        <div style={{ maxWidth: 240 }}>
          <label style={labelStyle}>Max Uses <span style={{ color: T.t3, fontWeight: 400 }}>(leave blank for unlimited)</span></label>
          <input
            type="number"
            min={1}
            value={form.maxUses}
            onChange={set('maxUses')}
            placeholder="∞"
            style={inputStyle}
          />
        </div>

        {/* Date range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Valid From</label>
            <input type="date" value={form.validFrom} onChange={set('validFrom')} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Valid Until <span style={{ color: T.t3, fontWeight: 400 }}>(leave blank = no expiry)</span></label>
            <input type="date" value={form.validUntil} onChange={set('validUntil')} style={inputStyle} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Internal Notes</label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={3}
            placeholder="E.g. 'For Product Hunt launch — limited to 100 uses'"
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        {/* Preview card */}
        {form.code.trim() && Number(form.discountValue) > 0 && (
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Tag size={20} color={T.green} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: T.t1, margin: 0, fontFamily: 'monospace', letterSpacing: '0.08em' }}>{form.code.toUpperCase()}</p>
              <p style={{ fontSize: 12, color: T.t2, margin: '2px 0 0' }}>
                {form.discountType === 'percent' ? `${form.discountValue}% off` : `₹${Number(form.discountValue).toLocaleString()} off`}
                {' · '}
                {form.appliesTo === 'both' ? 'Starter & Growth' : form.appliesTo === 'all' ? 'All plans' : form.appliesTo}
                {' · '}
                {form.billingCycle === 'both' ? 'Monthly & Annual' : form.billingCycle}
                {form.maxUses ? ` · Max ${form.maxUses} uses` : ' · Unlimited uses'}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <button
            onClick={() => navigate('/superadmin/promo')}
            style={{ padding: '10px 20px', borderRadius: 8, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t2, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => { setServerErr(null); saveMut.mutate(); }}
            disabled={saveMut.isPending || !canSave}
            style={{
              padding: '10px 24px', borderRadius: 8, background: T.red, border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: !canSave ? 0.5 : 1,
            }}
          >
            {saveMut.isPending && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
            {isEdit ? 'Save Changes' : 'Create Code'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
