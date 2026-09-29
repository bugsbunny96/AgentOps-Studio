/**
 * Onboarding Step 5 — choose an Indian phone number for the AI agent.
 *
 * GET  /telephony/number             → already has one? show it.
 * GET  /telephony/numbers/available  → pick list from the shared Vobiz pool.
 * POST /telephony/number { e164 }    → assign + connect to Vapi (server-side).
 *
 * Optional step: if numbers aren't configured (503) or the list is empty, the
 * owner can still launch and add a number later from Settings.
 */

import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { CheckCircle2, Copy, Loader2, Phone, AlertTriangle } from 'lucide-react';
import { api } from '@/utils/api';

interface AvailableNumber { e164: string; display: string; region: string | null }
interface AssignedNumber {
  phoneNumber: string | null;
  display: string | null;
  vapiPhoneNumberId: string | null;
  linkedManually: boolean;
}

type LoadState = 'loading' | 'assigned' | 'choose' | 'empty' | 'unavailable' | 'error';

const INITIAL_VISIBLE = 6;

function errMessage(err: unknown, fallback: string): string {
  return (err as AxiosError<{ message?: string }>).response?.data?.message ?? fallback;
}

export default function PhoneNumberPicker() {
  const [state, setState]         = useState<LoadState>('loading');
  const [assigned, setAssigned]   = useState<AssignedNumber | null>(null);
  const [numbers, setNumbers]     = useState<AvailableNumber[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [showAll, setShowAll]     = useState(false);
  const [claiming, setClaiming]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  async function loadAvailable() {
    try {
      const res = await api.get<{ data: { numbers: AvailableNumber[] } }>('/telephony/numbers/available');
      const list = res.data.data.numbers;
      setNumbers(list);
      setSelected(list[0]?.e164 ?? null);
      setState(list.length ? 'choose' : 'empty');
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 503) { setState('unavailable'); return; }
      setError(errMessage(err, 'Could not load phone numbers.'));
      setState('error');
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: AssignedNumber }>('/telephony/number');
        if (cancelled) return;
        if (res.data.data.phoneNumber || res.data.data.linkedManually) {
          setAssigned(res.data.data);
          setState('assigned');
          return;
        }
        await loadAvailable();
      } catch (err) {
        if (cancelled) return;
        setError(errMessage(err, 'Could not load phone numbers.'));
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function claim() {
    if (!selected) return;
    setError(null);
    setClaiming(true);
    try {
      const res = await api.post<{ data: AssignedNumber }>('/telephony/number', { e164: selected });
      setAssigned(res.data.data);
      setState('assigned');
    } catch (err) {
      setError(errMessage(err, 'Could not connect that number. Please try again.'));
      // Number may have been taken by someone else — refresh the list.
      if ((err as AxiosError).response?.status === 409) await loadAvailable();
    } finally {
      setClaiming(false);
    }
  }

  async function copyNumber() {
    if (!assigned?.phoneNumber) return;
    try {
      await navigator.clipboard.writeText(assigned.phoneNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — ignore */ }
  }

  const visible = showAll ? numbers : numbers.slice(0, INITIAL_VISIBLE);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Your business phone number</p>
        <span className="text-xs text-slate-400">Customers call this number</span>
      </div>

      {state === 'loading' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex items-center justify-center gap-2">
          <Loader2 size={18} className="text-indigo-500 animate-spin" />
          <p className="text-sm text-slate-500">Loading phone numbers…</p>
        </div>
      )}

      {state === 'assigned' && assigned && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              {assigned.display ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-emerald-900 tracking-wide">{assigned.display}</p>
                    <button
                      type="button"
                      onClick={copyNumber}
                      className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
                      aria-label="Copy phone number"
                    >
                      {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    Connected. Once you launch, calls to this number are answered by your AI agent.
                  </p>
                </>
              ) : (
                <p className="text-sm text-emerald-800">A phone number is already linked to your agent.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {state === 'choose' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Pick an Indian number for your AI agent. You can forward your existing business line to it later.
          </p>
          <div role="radiogroup" aria-label="Available phone numbers" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visible.map((n) => {
              const active = selected === n.e164;
              return (
                <button
                  key={n.e164}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(n.e164)}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition
                    ${active ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <Phone size={15} className={active ? 'text-indigo-600' : 'text-slate-400'} />
                  <span className="text-sm font-medium text-slate-800 tracking-wide">{n.display}</span>
                </button>
              );
            })}
          </div>
          {numbers.length > INITIAL_VISIBLE && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-indigo-600 hover:underline">
              {showAll ? 'Show fewer' : `Show all ${numbers.length} numbers`}
            </button>
          )}
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}
          <button
            type="button"
            disabled={!selected || claiming}
            onClick={claim}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5
              text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {claiming && <Loader2 size={15} className="animate-spin" />}
            {claiming ? 'Connecting number…' : 'Use this number'}
          </button>
        </div>
      )}

      {(state === 'empty' || state === 'unavailable') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            {state === 'empty'
              ? 'No phone numbers are free right now. You can launch now — we will assign your number shortly.'
              : 'Phone numbers are not available yet. You can launch now and add a number later from Settings.'}
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-2">
          <p className="text-xs text-red-700">{error ?? 'Something went wrong.'}</p>
          <button type="button" onClick={() => { setState('loading'); setError(null); void loadAvailable(); }}
            className="text-xs font-medium text-red-700 underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
