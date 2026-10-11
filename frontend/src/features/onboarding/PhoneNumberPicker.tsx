/**
 * Business phone number — onboarding Step 5 (Activate) and Settings.
 *
 * Number automation (2026-10-08):
 *   - Free trial: no own number. The agent calls out from a shared number;
 *     inbound calls and an own number come with a paid plan.
 *   - Paid plan: choose a number or "Pick one for me". Spare numbers we own
 *     come first ("Ready now"), then local numbers from Vobiz that are bought
 *     automatically when chosen (included in the plan).
 *
 * GET  /telephony/number                     → current number + planState
 * GET  /telephony/numbers/available?search=  → spare + local numbers (paid only)
 * POST /telephony/number { e164 }            → assign (buy if needed) + connect to Vapi
 * POST /telephony/number/auto                → pick one for me
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { CheckCircle2, Copy, Loader2, Phone, AlertTriangle, Search, Sparkles, PhoneOutgoing } from 'lucide-react';
import { api } from '@/utils/api';

interface AvailableNumber { e164: string; display: string; region: string | null; source: 'owned' | 'inventory' }
interface AssignedNumber {
  phoneNumber: string | null;
  display: string | null;
  vapiPhoneNumberId: string | null;
  linkedManually: boolean;
  planState?: 'paid' | 'trial' | 'none';
}

type LoadState = 'loading' | 'assigned' | 'choose' | 'empty' | 'unavailable' | 'needsPlan' | 'error';

const INITIAL_VISIBLE = 6;

function errMessage(err: unknown, fallback: string): string {
  return (err as AxiosError<{ message?: string }>).response?.data?.message ?? fallback;
}

function errCode(err: unknown): string | undefined {
  return (err as AxiosError<{ code?: string }>).response?.data?.code;
}

export default function PhoneNumberPicker() {
  const [state, setState]         = useState<LoadState>('loading');
  const [planState, setPlanState] = useState<AssignedNumber['planState']>();
  const [assigned, setAssigned]   = useState<AssignedNumber | null>(null);
  const [numbers, setNumbers]     = useState<AvailableNumber[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [showAll, setShowAll]     = useState(false);
  const [search, setSearch]       = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy]           = useState<'claim' | 'auto' | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  async function loadAvailable(q?: string) {
    try {
      const res = await api.get<{ data: { numbers: AvailableNumber[] } }>('/telephony/numbers/available', {
        params: q ? { search: q } : undefined,
      });
      const list = res.data.data.numbers;
      setNumbers(list);
      setSelected(list[0]?.e164 ?? null);
      setState(list.length || q ? 'choose' : 'empty');
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 503) { setState('unavailable'); return; }
      if (status === 402 || errCode(err) === 'NUMBER_NEEDS_PLAN') { setState('needsPlan'); return; }
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
        setPlanState(res.data.data.planState);
        if (res.data.data.phoneNumber || res.data.data.linkedManually) {
          setAssigned(res.data.data);
          setState('assigned');
          return;
        }
        if (res.data.data.planState && res.data.data.planState !== 'paid') {
          setState('needsPlan');
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

  async function runSearch() {
    setSearching(true);
    setError(null);
    await loadAvailable(search.replace(/\D/g, '') || undefined);
    setSearching(false);
  }

  async function claim(mode: 'claim' | 'auto') {
    if (mode === 'claim' && !selected) return;
    setError(null);
    setBusy(mode);
    try {
      const res = mode === 'auto'
        ? await api.post<{ data: AssignedNumber }>('/telephony/number/auto')
        : await api.post<{ data: AssignedNumber }>('/telephony/number', { e164: selected });
      setAssigned(res.data.data);
      setState('assigned');
    } catch (err) {
      setError(errMessage(err, 'Could not connect that number. Please try again.'));
      // Number may have been taken by someone else — refresh the list.
      if ((err as AxiosError).response?.status === 409) await loadAvailable();
    } finally {
      setBusy(null);
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
  const owned = visible.filter((n) => n.source === 'owned');
  const forSale = visible.filter((n) => n.source === 'inventory');

  function renderNumber(n: AvailableNumber) {
    const active = selected === n.e164;
    return (
      <button
        key={n.e164}
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => setSelected(n.e164)}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition
          ${active ? 'border-brand-500 bg-brand-400/10 ring-1 ring-brand-500' : 'border-white/10 hover:border-white/15'}`}
      >
        <Phone size={15} className={active ? 'text-brand-300' : 'text-slate-400'} />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-100 tracking-wide">{n.display}</span>
          {n.region && <span className="block text-[11px] text-slate-400">{n.region}</span>}
        </span>
      </button>
    );
  }

  return (
    <div id="phone-number" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-200">Your business phone number</p>
        <span className="text-xs text-slate-400">Customers call this number</span>
      </div>

      {state === 'loading' && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex items-center justify-center gap-2">
          <Loader2 size={18} className="text-brand-300 animate-spin" />
          <p className="text-sm text-slate-400">Loading phone numbers…</p>
        </div>
      )}

      {state === 'assigned' && assigned && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-emerald-300 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              {assigned.display ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-emerald-300 tracking-wide">{assigned.display}</p>
                    <button
                      type="button"
                      onClick={copyNumber}
                      className="rounded p-1 text-emerald-300 hover:bg-emerald-500/15"
                      aria-label="Copy phone number"
                    >
                      {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-emerald-300 mt-1">
                    Connected. Calls to this number are answered by your AI agent, and outbound calls go out from it.
                  </p>
                </>
              ) : (
                <p className="text-sm text-emerald-300">A phone number is already linked to your agent.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {state === 'needsPlan' && (
        <div className="rounded-xl border border-white/10 bg-surface p-5 space-y-3">
          <div className="flex items-start gap-3">
            <PhoneOutgoing size={18} className="text-brand-300 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-100">
                {planState === 'trial' ? 'During your free trial: outbound calls only' : 'Choose a plan to get your number'}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {planState === 'trial'
                  ? 'Your agent can call one number or a list from a shared AgentOps number (9 am–9 pm). Your own Indian number — for incoming calls too — is included when you choose a plan.'
                  : 'Your own Indian number, for incoming and outgoing calls, is included in every paid plan.'}
              </p>
            </div>
          </div>
          <Link
            to="/billing"
            className="inline-flex items-center justify-center rounded-md bg-brand-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-brand-300 transition"
          >
            See plans
          </Link>
        </div>
      )}

      {state === 'choose' && (
        <div className="rounded-xl border border-white/10 bg-surface p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Pick a local Indian number for your AI agent — it is included in your plan. You can forward your existing business line to it later.
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); void runSearch(); }}
            className="flex gap-2"
          >
            <label className="flex-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3">
              <Search size={14} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputMode="numeric"
                placeholder="Digits to look for, e.g. 80 for Bengaluru"
                aria-label="Search numbers"
                className="w-full bg-transparent py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </label>
            <button type="submit" disabled={searching} className="rounded-md border border-white/10 px-3 text-xs font-semibold text-slate-200 hover:border-white/20 disabled:opacity-50">
              {searching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
            </button>
          </form>

          {numbers.length === 0 ? (
            <p className="text-xs text-slate-400">No numbers match. Try other digits, or let us pick one.</p>
          ) : (
            <div role="radiogroup" aria-label="Available phone numbers" className="space-y-3">
              {owned.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ready now</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {owned.map(renderNumber)}
                  </div>
                </div>
              )}
              {forSale.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">More local numbers</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {forSale.map(renderNumber)}
                  </div>
                </div>
              )}
            </div>
          )}

          {numbers.length > INITIAL_VISIBLE && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-brand-300 hover:underline">
              {showAll ? 'Show fewer' : `Show all ${numbers.length} numbers`}
            </button>
          )}
          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!selected || !!busy}
              onClick={() => claim('claim')}
              className="flex items-center justify-center gap-2 rounded-md bg-brand-400 px-4 py-2.5
                text-sm font-semibold text-slate-900 hover:bg-brand-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy === 'claim' && <Loader2 size={15} className="animate-spin" />}
              {busy === 'claim' ? 'Connecting number…' : 'Use this number'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => claim('auto')}
              className="flex items-center justify-center gap-2 rounded-md border border-white/15 px-4 py-2.5
                text-sm font-semibold text-slate-100 hover:border-white/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy === 'auto' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {busy === 'auto' ? 'Finding a number…' : 'Pick one for me'}
            </button>
          </div>
        </div>
      )}

      {(state === 'empty' || state === 'unavailable') && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              {state === 'empty'
                ? 'No numbers are listed right now. Try "Pick one for me" — if none is free, we are notified and will assign one shortly.'
                : 'Phone numbers are not available yet. You can launch now and add a number later from Settings.'}
            </p>
          </div>
          {state === 'empty' && (
            <button type="button" disabled={!!busy} onClick={() => claim('auto')}
              className="text-xs font-semibold text-amber-200 underline disabled:opacity-50">
              {busy === 'auto' ? 'Finding a number…' : 'Pick one for me'}
            </button>
          )}
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 space-y-2">
          <p className="text-xs text-red-300">{error ?? 'Something went wrong.'}</p>
          <button type="button" onClick={() => { setState('loading'); setError(null); void loadAvailable(); }}
            className="text-xs font-medium text-red-300 underline">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
