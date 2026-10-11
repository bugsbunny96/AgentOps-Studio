/**
 * Outbound calls — one number or a pasted list (number automation, 2026-10-08).
 *
 * POST /calls/initiate { phoneNumber, agentId }   → one call now
 * POST /calls/batches  { numbers, agentId }       → list, dialled one at a time
 * GET  /calls/batches/:id                         → list progress (polled)
 * POST /calls/batches/:id/cancel
 *
 * Trial accounts call from a shared number; paid plans from their own number.
 * The backend enforces plan, minutes, simultaneous calls and 9 am–9 pm IST.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { AlertCircle, CheckCircle, ListOrdered, Loader2, Phone, PhoneOutgoing, X } from 'lucide-react';
import { api } from '@/utils/api';

const T = {
  bgS: '#1f1f1f', bgC: 'rgba(255,255,255,0.035)', bdr: 'rgba(255,255,255,0.07)',
  blue: '#21F1A8', blueL: '#7CF7CB', violet: '#0FC98A', em: '#10b981', amb: '#f59e0b', rose: '#f43f5e',
  t1: '#fafafa', t2: '#a3a3a3', t3: '#737373',
};

interface BatchCounts { total: number; pending: number; called: number; failed: number; skipped: number }
interface Batch { id: string; status: 'running' | 'waiting' | 'completed' | 'stopped' | 'cancelled'; note?: string; nextRunAt?: string; counts: BatchCounts }
interface NumberInfo { phoneNumber: string | null; planState?: 'paid' | 'trial' | 'none' }

function apiError(err: unknown): { message: string; code?: string } {
  const data = (err as AxiosError<{ message?: string; code?: string }>).response?.data;
  return { message: data?.message ?? 'Something went wrong. Please try again.', code: data?.code };
}

/** Rough client-side count; the server does the real parsing. */
function countNumbers(text: string): number {
  return new Set(text.split(/[\n,;\t]+/).map((s) => s.replace(/[\s()-]/g, '')).filter((s) => /^\+?\d{10,15}$/.test(s))).size;
}

const STATUS_LABEL: Record<Batch['status'], string> = {
  running: 'Calling…', waiting: 'Waiting', completed: 'Finished', stopped: 'Stopped', cancelled: 'Cancelled',
};

export default function OutboundCallModal({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [tab, setTab]       = useState<'single' | 'list'>('single');
  const [num, setNum]       = useState('');
  const [list, setList]     = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);

  const { data: numberInfo } = useQuery<NumberInfo>({
    queryKey: ['telephony-number'],
    queryFn: async () => (await api.get<{ data: NumberInfo }>('/telephony/number')).data.data,
    staleTime: 60_000,
  });

  const single = useMutation({
    mutationFn: () => api.post('/calls/initiate', { phoneNumber: num.trim(), agentId }),
  });

  const createList = useMutation({
    mutationFn: async () => (await api.post<{ data: { batch: Batch; invalid: string[] } }>('/calls/batches', { numbers: list, agentId })).data.data,
    onSuccess: (d) => { setBatchId(d.batch.id); setInvalid(d.invalid); },
  });

  const { data: batch } = useQuery<Batch>({
    queryKey: ['call-batch', batchId],
    enabled: !!batchId,
    queryFn: async () => (await api.get<{ data: { batch: Batch } }>(`/calls/batches/${batchId}`)).data.data.batch,
    refetchInterval: (q) => {
      const s = (q.state.data as Batch | undefined)?.status;
      return s === 'running' || s === 'waiting' || !s ? 4_000 : false;
    },
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/calls/batches/${batchId}/cancel`),
  });

  const listCount = useMemo(() => countNumbers(list), [list]);
  const trial = numberInfo?.planState === 'trial';
  const needsNumber = numberInfo?.planState === 'paid' && !numberInfo.phoneNumber;
  const err = tab === 'single' ? (single.error ? apiError(single.error) : null) : (createList.error ? apiError(createList.error) : null);

  const tabBtn = (id: 'single' | 'list', label: string, Icon: typeof Phone) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
        background: tab === id ? 'rgba(33,241,168,0.12)' : 'transparent', color: tab === id ? T.blueL : T.t2,
      }}
    >
      <Icon size={13} /> {label}
    </button>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Outbound call" style={{
      position: 'fixed', inset: 0, zIndex: 9999, padding: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(23,23,23,0.85)', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 460, borderRadius: 20, background: T.bgS, border: `1px solid ${T.bdr}`,
        boxShadow: '0 0 60px rgba(33,241,168,0.15)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${T.bdr}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(33,241,168,0.15)', border: '1px solid rgba(33,241,168,0.25)' }}>
              <PhoneOutgoing size={15} style={{ color: T.blueL }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: 0 }}>Outbound calls</p>
              <p style={{ fontSize: 11, color: T.t3, margin: 0 }}>
                {trial ? 'Trial: calls go out from a shared number' : numberInfo?.phoneNumber ? `From ${numberInfo.phoneNumber}` : 'Your agent calls customers'}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {needsNumber && (
            <div style={{ fontSize: 12, color: T.amb, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 12px' }}>
              Choose your business number first —{' '}
              <Link to="/settings#phone-number" style={{ color: T.blueL, fontWeight: 600 }}>Settings → Phone number</Link>. It is included in your plan.
            </div>
          )}

          {!batchId && (
            <div role="tablist" style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 10, border: `1px solid ${T.bdr}` }}>
              {tabBtn('single', 'One number', Phone)}
              {tabBtn('list', 'A list', ListOrdered)}
            </div>
          )}

          {tab === 'single' && (single.isSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              <CheckCircle size={26} style={{ color: T.em }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: T.t1, margin: 0 }}>Call started</p>
              <p style={{ fontSize: 12, color: T.t3, margin: 0 }}>Your agent is dialling {num}</p>
            </div>
          ) : (
            <div>
              <label htmlFor="ob-number" style={{ fontSize: 11, fontWeight: 600, color: T.t2, display: 'block', marginBottom: 8 }}>
                Phone number
              </label>
              <input
                id="ob-number"
                value={num}
                onChange={(e) => setNum(e.target.value)}
                placeholder="98765 43210 or +91 98765 43210"
                inputMode="tel"
                onKeyDown={(e) => e.key === 'Enter' && num.trim().length >= 10 && single.mutate()}
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t1, fontSize: 14, outline: 'none' }}
              />
            </div>
          ))}

          {tab === 'list' && !batchId && (
            <div>
              <label htmlFor="ob-list" style={{ fontSize: 11, fontWeight: 600, color: T.t2, display: 'block', marginBottom: 8 }}>
                Phone numbers — one per line, or separated by commas
              </label>
              <textarea
                id="ob-list"
                value={list}
                onChange={(e) => setList(e.target.value)}
                rows={6}
                placeholder={'98765 43210\n+91 91234 56789\n080 1234 5678'}
                style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t1, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <p style={{ fontSize: 11, color: T.t3, margin: '6px 0 0' }}>
                {listCount} number{listCount === 1 ? '' : 's'} · called one at a time, 9 am–9 pm{trial ? ' · up to 20 during the trial' : ''}
              </p>
            </div>
          )}

          {batchId && batch && (
            <div style={{ borderRadius: 10, border: `1px solid ${T.bdr}`, background: T.bgC, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{STATUS_LABEL[batch.status]}</span>
                <span style={{ fontSize: 12, color: T.t2 }}>{batch.counts.called + batch.counts.failed + batch.counts.skipped} / {batch.counts.total}</span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: T.blue, width: `${Math.round(((batch.counts.total - batch.counts.pending) / Math.max(1, batch.counts.total)) * 100)}%`, transition: 'width .4s' }} />
              </div>
              <p style={{ fontSize: 11, color: T.t3, margin: 0 }}>
                Called {batch.counts.called} · failed {batch.counts.failed} · skipped {batch.counts.skipped}
              </p>
              {batch.note && <p style={{ fontSize: 11, color: T.amb, margin: 0 }}>{batch.note}</p>}
              {invalid.length > 0 && (
                <p style={{ fontSize: 11, color: T.amb, margin: 0 }}>Not a phone number, left out: {invalid.slice(0, 5).join(', ')}{invalid.length > 5 ? '…' : ''}</p>
              )}
              <p style={{ fontSize: 11, color: T.t3, margin: 0 }}>Results appear in Calls as each call ends. You can close this window.</p>
            </div>
          )}

          {err && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
              <AlertCircle size={13} style={{ color: T.rose, flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: '#f87171' }}>
                {err.message}
                {(err.code === 'PLAN_REQUIRED' || err.code === 'MINUTES_EXHAUSTED') && (
                  <> <Link to="/billing" style={{ color: T.blueL, fontWeight: 600 }}>See plans</Link></>
                )}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${T.bdr}`, background: 'transparent', color: T.t2, fontSize: 13, cursor: 'pointer' }}>
              {single.isSuccess || batchId ? 'Close' : 'Cancel'}
            </button>
            {tab === 'single' && !single.isSuccess && (
              <button
                onClick={() => single.mutate()}
                disabled={single.isPending || num.trim().length < 10 || needsNumber}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: `linear-gradient(135deg, ${T.blue}, ${T.violet})`, color: '#171717', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: single.isPending || num.trim().length < 10 || needsNumber ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {single.isPending ? <><Loader2 size={14} className="animate-spin" /> Connecting…</> : <><Phone size={14} /> Call now</>}
              </button>
            )}
            {tab === 'list' && !batchId && (
              <button
                onClick={() => createList.mutate()}
                disabled={createList.isPending || listCount === 0 || needsNumber}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: `linear-gradient(135deg, ${T.blue}, ${T.violet})`, color: '#171717', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: createList.isPending || listCount === 0 || needsNumber ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {createList.isPending ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : <><ListOrdered size={14} /> Call {listCount || ''} number{listCount === 1 ? '' : 's'}</>}
              </button>
            )}
            {batchId && batch && (batch.status === 'running' || batch.status === 'waiting') && (
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(244,63,94,0.3)', background: 'transparent', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Stop list
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
