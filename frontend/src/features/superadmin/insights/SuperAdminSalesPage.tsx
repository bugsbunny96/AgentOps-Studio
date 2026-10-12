/**
 * MKT-11 — Sales deal log (super-admin).
 * Log every prospect conversation: stage, why deals are lost, and the four
 * price questions from the discovery-call script (Van Westendorp).
 * Use it to find and fix the #1 reason deals stall.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, Pencil, Trash2, X, RefreshCw } from 'lucide-react';
import api from '@/utils/api';

const T = {
  bg: '#141414', bgS: '#1c1c1c', bgC: 'rgba(255,255,255,0.04)',
  bdr: 'rgba(255,255,255,0.07)', bdrB: 'rgba(255,255,255,0.12)',
  green: '#22c55e', greenD: 'rgba(34,197,94,0.12)',
  amber: '#f59e0b', amberD: 'rgba(245,158,11,0.12)',
  rose: '#f43f5e', roseD: 'rgba(244,63,94,0.12)',
  blue: '#21F1A8', blueD: 'rgba(33,241,168,0.12)',
  t1: '#fafafa', t2: '#a3a3a3', t3: '#737373',
};

type Stage  = 'open' | 'won' | 'lost';
type Source = 'outbound' | 'inbound_call' | 'website' | 'referral' | 'walk_in' | 'event' | 'other';
type Reason = 'price' | 'no_need' | 'timing' | 'chose_competitor' | 'missing_feature' | 'trust' | 'no_response' | 'decision_maker' | 'other';
type PlanId = 'lite' | 'starter' | 'growth' | 'enterprise';
type PriceKey = 'tooCheapInr' | 'bargainInr' | 'expensiveInr' | 'tooExpensiveInr';

interface Deal {
  _id: string;
  businessName: string; city?: string; niche?: string; contactName?: string;
  source: Source; stage: Stage; lostReason?: Reason | null; plan?: PlanId | null;
  callsPerDay?: number | null; avgOrderValueInr?: number | null;
  successMeasure?: string; nextStep?: string; nextStepAt?: string | null; notes?: string;
  priceAnswers?: Partial<Record<PriceKey, number>>;
  createdAt: string; closedAt?: string | null;
}
interface Summary {
  total: number; open: number; won: number; lost: number; winRate: number | null;
  lostReasons: { reason: Reason | 'unknown'; count: number }[];
  bySource: { source: Source; total: number; won: number; lost: number; winRate: number | null }[];
  priceAnswers: Record<PriceKey, { median: number | null; n: number }>;
}

const SOURCES: Record<Source, string> = {
  outbound: 'Outbound', inbound_call: 'Inbound call', website: 'Website', referral: 'Referral',
  walk_in: 'Walk-in / visit', event: 'Event', other: 'Other',
};
const REASONS: Record<Reason | 'unknown', string> = {
  price: 'Price', no_need: 'No real need', timing: 'Timing', chose_competitor: 'Chose a competitor',
  missing_feature: 'Missing feature', trust: 'Trust / unsure it works', no_response: 'Went quiet',
  decision_maker: 'Not the decision maker', other: 'Other', unknown: 'Not recorded',
};
const PLANS: Record<PlanId, string> = { lite: 'Starter', starter: 'Basic', growth: 'Standard', enterprise: 'Pro' };
const PRICE_QUESTIONS: { key: PriceKey; label: string; q: string }[] = [
  { key: 'tooCheapInr',     label: 'Too cheap',      q: 'At what monthly price would this be so cheap you’d doubt it works?' },
  { key: 'bargainInr',      label: 'Good deal',      q: 'At what price would it feel like a good deal?' },
  { key: 'expensiveInr',    label: 'Getting pricey', q: 'At what price would it feel expensive, but you’d still consider it?' },
  { key: 'tooExpensiveInr', label: 'Too expensive',  q: 'At what price would it be too expensive to consider?' },
];
const STAGE_STYLE: Record<Stage, { fg: string; bg: string; label: string }> = {
  open: { fg: T.amber, bg: T.amberD, label: 'Open' },
  won:  { fg: T.green, bg: T.greenD, label: 'Won' },
  lost: { fg: T.rose,  bg: T.roseD,  label: 'Lost' },
};

const inr = (n: number | null | undefined) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);

// ─── Form state ───────────────────────────────────────────────────────────────
interface FormState {
  businessName: string; city: string; niche: string; contactName: string;
  source: Source; stage: Stage; lostReason: Reason | ''; plan: PlanId | '';
  callsPerDay: string; avgOrderValueInr: string; successMeasure: string;
  nextStep: string; nextStepAt: string; notes: string;
  prices: Record<PriceKey, string>;
}
const emptyForm = (): FormState => ({
  businessName: '', city: '', niche: '', contactName: '', source: 'outbound', stage: 'open',
  lostReason: '', plan: '', callsPerDay: '', avgOrderValueInr: '', successMeasure: '',
  nextStep: '', nextStepAt: '', notes: '',
  prices: { tooCheapInr: '', bargainInr: '', expensiveInr: '', tooExpensiveInr: '' },
});
const fromDeal = (d: Deal): FormState => ({
  businessName: d.businessName, city: d.city ?? '', niche: d.niche ?? '', contactName: d.contactName ?? '',
  source: d.source, stage: d.stage, lostReason: d.lostReason ?? '', plan: d.plan ?? '',
  callsPerDay: d.callsPerDay?.toString() ?? '', avgOrderValueInr: d.avgOrderValueInr?.toString() ?? '',
  successMeasure: d.successMeasure ?? '', nextStep: d.nextStep ?? '',
  nextStepAt: d.nextStepAt ? d.nextStepAt.slice(0, 10) : '', notes: d.notes ?? '',
  prices: {
    tooCheapInr: d.priceAnswers?.tooCheapInr?.toString() ?? '', bargainInr: d.priceAnswers?.bargainInr?.toString() ?? '',
    expensiveInr: d.priceAnswers?.expensiveInr?.toString() ?? '', tooExpensiveInr: d.priceAnswers?.tooExpensiveInr?.toString() ?? '',
  },
});
const num = (s: string) => (s.trim() === '' ? undefined : Math.max(0, Math.round(Number(s))));
function toPayload(f: FormState) {
  const prices = Object.fromEntries(
    (Object.keys(f.prices) as PriceKey[]).map((k) => [k, num(f.prices[k])]).filter(([, v]) => v !== undefined),
  );
  return {
    businessName: f.businessName.trim(),
    city: f.city.trim() || undefined, niche: f.niche.trim() || undefined, contactName: f.contactName.trim() || undefined,
    source: f.source, stage: f.stage,
    lostReason: f.stage === 'lost' ? (f.lostReason || undefined) : null,
    plan: f.plan || null,
    callsPerDay: num(f.callsPerDay) ?? null, avgOrderValueInr: num(f.avgOrderValueInr) ?? null,
    successMeasure: f.successMeasure.trim() || undefined, nextStep: f.nextStep.trim() || undefined,
    nextStepAt: f.nextStepAt || null, notes: f.notes.trim() || undefined,
    priceAnswers: prices,
  };
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.bdrB}`,
  background: T.bg, color: T.t1, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: wide ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.t2 }}>{label}</span>
      {children}
    </label>
  );
}
function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, background: T.bgC, border: `1px solid ${T.bdr}` }}>
      <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: T.t1, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.t3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
const card: React.CSSProperties = { padding: 18, borderRadius: 12, background: T.bgS, border: `1px solid ${T.bdr}` };
const h3: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: T.t1, margin: '0 0 12px' };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SuperAdminSalesPage() {
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage | 'all'>('all');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ['sa-sales-summary'],
    queryFn: async () => (await api.get<{ success: boolean; data: Summary }>('/superadmin/sales/summary')).data.data,
  });
  const { data: deals, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sa-sales-deals', stage],
    queryFn: async () => (await api.get<{ success: boolean; data: Deal[] }>(
      `/superadmin/sales/deals${stage === 'all' ? '' : `?stage=${stage}`}`,
    )).data.data,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['sa-sales-deals'] });
    void qc.invalidateQueries({ queryKey: ['sa-sales-summary'] });
  };
  const save = useMutation({
    mutationFn: async () => {
      const body = toPayload(form);
      if (editing === 'new') await api.post('/superadmin/sales/deals', body);
      else if (editing) await api.patch(`/superadmin/sales/deals/${editing}`, body);
    },
    onSuccess: () => { setEditing(null); setError(null); refresh(); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Could not save the deal.');
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/superadmin/sales/deals/${id}`); },
    onSuccess: refresh,
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.businessName.trim() !== '' && (form.stage !== 'lost' || form.lostReason !== '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, color: T.t1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Briefcase size={18} style={{ color: T.blue }} />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Sales Deals</h1>
            <p style={{ fontSize: 12.5, color: T.t3, margin: '2px 0 0' }}>
              Log every prospect. Fix the #1 reason deals are lost first. Script: <code>main-project-docs/Discovery-Call-Script.md</code>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void refetch()} style={{ ...input, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => { setForm(emptyForm()); setEditing('new'); setError(null); }}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: T.blue, color: '#171717', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> Log a deal
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Tile label="Deals" value={String(summary.total)} sub={`${summary.open} open`} />
            <Tile label="Won" value={String(summary.won)} />
            <Tile label="Lost" value={String(summary.lost)} />
            <Tile label="Win rate" value={pct(summary.winRate)} sub="won ÷ closed" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div style={card}>
              <h3 style={h3}>Why deals are lost</h3>
              {summary.lostReasons.length === 0 ? <p style={{ fontSize: 12.5, color: T.t3, margin: 0 }}>No lost deals yet.</p> : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {summary.lostReasons.map((r, i) => (
                    <li key={r.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: i === 0 ? T.rose : T.t2, fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? 'Fix first: ' : ''}{REASONS[r.reason]}</span>
                      <span style={{ color: T.t1, fontVariantNumeric: 'tabular-nums' }}>{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={card}>
              <h3 style={h3}>By source</h3>
              {summary.bySource.length === 0 ? <p style={{ fontSize: 12.5, color: T.t3, margin: 0 }}>No deals yet.</p> : (
                <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ color: T.t3, textAlign: 'left' }}><th>Source</th><th>Deals</th><th>Won</th><th>Win rate</th></tr></thead>
                  <tbody>
                    {summary.bySource.map((s) => (
                      <tr key={s.source} style={{ color: T.t2 }}>
                        <td style={{ padding: '4px 0' }}>{SOURCES[s.source]}</td><td>{s.total}</td><td>{s.won}</td><td>{pct(s.winRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={card}>
              <h3 style={h3}>Price answers (median ₹/month)</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PRICE_QUESTIONS.map(({ key, label }) => (
                  <li key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.t2 }}>
                    <span>{label}</span>
                    <span style={{ color: T.t1 }}>{inr(summary.priceAnswers[key].median)} <span style={{ color: T.t3, fontSize: 11 }}>n={summary.priceAnswers[key].n}</span></span>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 11, color: T.t3, margin: '10px 0 0' }}>Directional until about 30 answers. Compare with Basic ₹9,999 and Standard ₹17,999.</p>
            </div>
          </div>
        </>
      )}

      {/* Form */}
      {editing && (
        <div style={{ ...card, border: `1px solid ${T.bdrB}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ ...h3, margin: 0 }}>{editing === 'new' ? 'Log a deal' : 'Edit deal'}</h3>
            <button onClick={() => setEditing(null)} aria-label="Close" style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Field label="Business name *"><input style={input} value={form.businessName} onChange={(e) => set('businessName', e.target.value)} /></Field>
            <Field label="City"><input style={input} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="Niche"><input style={input} value={form.niche} onChange={(e) => set('niche', e.target.value)} placeholder="e.g. electrical retail" /></Field>
            <Field label="Contact name"><input style={input} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} /></Field>
            <Field label="Source">
              <select style={input} value={form.source} onChange={(e) => set('source', e.target.value as Source)}>
                {(Object.keys(SOURCES) as Source[]).map((s) => <option key={s} value={s}>{SOURCES[s]}</option>)}
              </select>
            </Field>
            <Field label="Stage">
              <select style={input} value={form.stage} onChange={(e) => set('stage', e.target.value as Stage)}>
                <option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option>
              </select>
            </Field>
            {form.stage === 'lost' && (
              <Field label="Lost reason *">
                <select style={input} value={form.lostReason} onChange={(e) => set('lostReason', e.target.value as Reason)}>
                  <option value="">Choose…</option>
                  {(Object.keys(REASONS) as (Reason | 'unknown')[]).filter((r) => r !== 'unknown').map((r) => <option key={r} value={r}>{REASONS[r]}</option>)}
                </select>
              </Field>
            )}
            <Field label="Plan discussed">
              <select style={input} value={form.plan} onChange={(e) => set('plan', e.target.value as PlanId | '')}>
                <option value="">—</option>
                {(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLANS[p]}</option>)}
              </select>
            </Field>
            <Field label="Calls per day"><input style={input} inputMode="numeric" value={form.callsPerDay} onChange={(e) => set('callsPerDay', e.target.value)} /></Field>
            <Field label="Avg order / booking value (₹)"><input style={input} inputMode="numeric" value={form.avgOrderValueInr} onChange={(e) => set('avgOrderValueInr', e.target.value)} /></Field>
            <Field label="Next step"><input style={input} value={form.nextStep} onChange={(e) => set('nextStep', e.target.value)} /></Field>
            <Field label="Next step date"><input type="date" style={input} value={form.nextStepAt} onChange={(e) => set('nextStepAt', e.target.value)} /></Field>
            <Field label="Success measure (their words)" wide><input style={input} value={form.successMeasure} onChange={(e) => set('successMeasure', e.target.value)} /></Field>
            <Field label="Notes" wide><textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
          <h3 style={{ ...h3, marginTop: 18 }}>Price questions (₹ per month, optional)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {PRICE_QUESTIONS.map(({ key, q }) => (
              <Field key={key} label={q}>
                <input style={input} inputMode="numeric" value={form.prices[key]}
                  onChange={(e) => setForm((f) => ({ ...f, prices: { ...f.prices, [key]: e.target.value } }))} />
              </Field>
            ))}
          </div>
          {error && <p style={{ color: T.rose, fontSize: 12.5, margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button disabled={!canSave || save.isPending} onClick={() => save.mutate()}
              style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: canSave ? T.blue : T.bdrB, color: '#171717', fontWeight: 700, fontSize: 13, cursor: canSave ? 'pointer' : 'not-allowed' }}>
              {save.isPending ? 'Saving…' : 'Save deal'}
            </button>
            <button onClick={() => setEditing(null)} style={{ ...input, width: 'auto', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['all', 'open', 'won', 'lost'] as const).map((s) => (
            <button key={s} onClick={() => setStage(s)} style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${stage === s ? T.blue : T.bdrB}`, background: stage === s ? T.blueD : 'transparent',
              color: stage === s ? T.blue : T.t2,
            }}>{s === 'all' ? 'All' : STAGE_STYLE[s].label}</button>
          ))}
        </div>
        {isLoading ? <p style={{ fontSize: 13, color: T.t3 }}>Loading…</p> : !deals?.length ? (
          <p style={{ fontSize: 13, color: T.t3, margin: 0 }}>No deals logged yet. Log your first discovery call.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
              <thead>
                <tr style={{ color: T.t3, textAlign: 'left', borderBottom: `1px solid ${T.bdr}` }}>
                  <th style={{ padding: '6px 4px' }}>Business</th><th>Stage</th><th>Source</th><th>Plan</th><th>Next step / reason</th><th>Logged</th><th />
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d._id} style={{ borderBottom: `1px solid ${T.bdr}`, color: T.t2 }}>
                    <td style={{ padding: '8px 4px' }}>
                      <div style={{ color: T.t1, fontWeight: 600 }}>{d.businessName}</div>
                      <div style={{ fontSize: 11, color: T.t3 }}>{[d.city, d.niche].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: STAGE_STYLE[d.stage].fg, background: STAGE_STYLE[d.stage].bg }}>{STAGE_STYLE[d.stage].label}</span></td>
                    <td>{SOURCES[d.source]}</td>
                    <td>{d.plan ? PLANS[d.plan] : '—'}</td>
                    <td>{d.stage === 'lost' ? REASONS[d.lostReason ?? 'unknown'] : [d.nextStep, d.nextStepAt?.slice(0, 10)].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button aria-label="Edit" onClick={() => { setForm(fromDeal(d)); setEditing(d._id); setError(null); }} style={{ background: 'none', border: 'none', color: T.t2, cursor: 'pointer', padding: 4 }}><Pencil size={14} /></button>
                      <button aria-label="Delete" onClick={() => { if (window.confirm(`Delete ${d.businessName}?`)) remove.mutate(d._id); }} style={{ background: 'none', border: 'none', color: T.t3, cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
