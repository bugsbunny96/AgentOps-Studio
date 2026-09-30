/**
 * AgentsPage — lists all voice agents for the current org.
 *
 * Data: GET /api/v1/agents → { agents, vapiPublicKey, vapiAssistantId }
 *
 * During onboarding a single agent is auto-provisioned; this page
 * renders it as a full card with status, voice config, languages,
 * and a system prompt preview. Future: multiple agents per org.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Loader2,
  ExternalLink,
  Copy,
  CheckCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  Globe,
  Volume2,
  Zap,
  Plus,
  Lock,
} from 'lucide-react';
import Vapi from '@vapi-ai/web';
import { api } from '@/utils/api';
import type { VoiceAgent } from '@/types';
import { useCanWrite } from '@/hooks/usePermission';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentListResponse {
  agents: VoiceAgent[];
  vapiPublicKey: string | null;
  vapiAssistantId: string | null;
}

type CallState = 'idle' | 'connecting' | 'active' | 'agent-speaking' | 'ended' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  'en-US': 'English', 'hi-IN': 'Hindi', 'pa-IN': 'Punjabi',
};

const VOICE_LABELS: Record<string, string> = {
  openai: 'Neural', elevenlabs: 'Studio', cartesia: 'Realtime', azure: 'Cloud',
};

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs
        text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
    >
      {copied ? <CheckCheck size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}

// ─── Sound Bars ──────────────────────────────────────────────────────────────

function SoundBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-px h-4">
      {[3, 5, 4, 6, 3, 5, 4, 3].map((h, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-emerald-500 transition-all duration-150"
          style={{ height: active ? `${h * 2.2}px` : '3px', transitionDelay: `${i * 30}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Mini Test Call Widget ────────────────────────────────────────────────────

function TestCallButton({
  vapiPublicKey,
  vapiAssistantId,
  agentName,
}: {
  vapiPublicKey: string;
  vapiAssistantId: string;
  agentName: string;
}) {
  const [state, setState]   = useState<CallState>('idle');
  const [muted, setMuted]   = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const vapiRef             = useRef<Vapi | null>(null);

  const cleanup = useCallback(() => {
    vapiRef.current?.stop();
    vapiRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  function start() {
    setError(null);
    setState('connecting');
    const vapi = new Vapi(vapiPublicKey);
    vapiRef.current = vapi;
    vapi.on('call-start', () => setState('active'));
    vapi.on('call-end',   () => { setState('ended'); vapiRef.current = null; });
    vapi.on('speech-start', () => setState('agent-speaking'));
    vapi.on('speech-end',   () => setState('active'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vapi.on('error', (e: any) => {
      setError(e?.error?.message || 'Call failed — check mic permissions');
      setState('error');
      vapiRef.current = null;
    });
    vapi.start(vapiAssistantId);
  }

  function end() { cleanup(); setState('ended'); }

  function toggleMute() {
    if (vapiRef.current) { vapiRef.current.setMuted(!muted); setMuted((m) => !m); }
  }

  const _isActive = state === 'active' || state === 'agent-speaking'; void _isActive;

  if (state === 'idle' || state === 'ended' || state === 'error') {
    return (
      <div className="space-y-2">
        <button
          onClick={() => { if (state !== 'idle') { setState('idle'); setError(null); } else { start(); } }}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r
            from-brand-400 to-brand-400 px-4 py-2 text-sm font-semibold text-slate-900
            shadow-sm shadow-brand-500/30 hover:from-brand-300 hover:to-brand-300
            transition-all active:scale-95"
        >
          <PhoneCall size={14} />
          {state === 'ended' ? 'Call Again' : 'Test Call'}
        </button>
        {state === 'ended' && (
          <p className="text-xs text-slate-400">Call ended — {agentName} is still active</p>
        )}
        {state === 'error' && error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertTriangle size={11} /> {error}
          </p>
        )}
      </div>
    );
  }

  if (state === 'connecting') {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={14} className="animate-spin text-brand-300" />
        Connecting…
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30
        bg-emerald-500/10 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <SoundBars active={state === 'agent-speaking'} />
        <span className="text-xs font-medium text-emerald-300">Live</span>
      </div>
      <button
        onClick={toggleMute}
        className={`rounded-lg border px-2.5 py-2 transition-colors ${
          muted ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-surface text-slate-400 hover:bg-white/[0.03]'
        }`}
      >
        {muted ? <MicOff size={13} /> : <Mic size={13} />}
      </button>
      <button
        onClick={end}
        className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold
          text-white hover:bg-red-600 transition-colors flex items-center gap-1.5"
      >
        <PhoneOff size={13} /> End
      </button>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  vapiPublicKey,
  vapiAssistantId,
  canWrite,
}: {
  agent: VoiceAgent;
  vapiPublicKey: string | null;
  vapiAssistantId: string | null;
  canWrite: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);

  const langs = agent.supportedLanguages.map((l) => LANG_LABELS[l] ?? l);
  const vapiId = vapiAssistantId ?? agent.vapiAssistantId;
  const vapiIdShort = `${vapiId.slice(0, 8)}…${vapiId.slice(-4)}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-surface overflow-hidden
      shadow-sm hover:shadow-md transition-shadow duration-300">

      {/* Gradient header */}
      <div className="relative bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900
        px-6 py-6 overflow-hidden">
        {/* Grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }} />
        {/* Glow */}
        <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32
          rounded-full bg-brand-400 opacity-25 blur-2xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2">
            {/* Status */}
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
              border text-[11px] font-semibold tracking-wide
              ${agent.status === 'Active'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
              }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                agent.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
              }`} />
              {agent.status.toUpperCase()}
            </div>

            <h2 className="text-xl font-bold text-white">{agent.name}</h2>

            {/* Agent ID */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Zap size={11} className="text-brand-400" />
              <code className="font-mono text-slate-300">{vapiIdShort}</code>
              <CopyBtn text={vapiId} />
            </div>
          </div>

          {/* Avatar */}
          <Link
            to={`/agents/${agent.id}`}
            className="flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-xl
              bg-gradient-to-br from-brand-400 to-brand-400 shadow-lg shadow-brand-500/40
              hover:shadow-brand-500/60 transition-shadow"
          >
            <Bot size={26} strokeWidth={1.5} className="text-white" />
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">

        {/* Config pills row */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10
            bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300">
            <Volume2 size={12} className="text-slate-400" />
            {VOICE_LABELS[agent.voiceProvider] ?? agent.voiceProvider} / {agent.voiceId}
          </div>
          {langs.map((l) => (
            <div key={l} className="flex items-center gap-1.5 rounded-lg border border-brand-400/30
              bg-brand-400/10 px-3 py-1.5 text-xs font-medium text-brand-300">
              <Globe size={12} className="text-brand-400" />
              {l}
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10
            bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300">
            <Activity size={12} className="text-emerald-500" />
            {agent.primaryLanguage}
          </div>
        </div>

        {/* System prompt accordion */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPrompt((p) => !p)}
            className="flex w-full items-center justify-between px-4 py-3
              text-xs font-semibold text-slate-300 hover:bg-white/[0.03] transition-colors"
          >
            <span className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              System Prompt
              <span className="font-normal text-slate-400">
                ({agent.systemPrompt.length.toLocaleString()} chars)
              </span>
            </span>
            {showPrompt ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showPrompt && (
            <div className="border-t border-white/10 bg-white/[0.03] px-4 py-3">
              <pre className="text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap
                font-mono max-h-56 overflow-y-auto scrollbar-hidden">
                {agent.systemPrompt}
              </pre>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {!canWrite ? (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Lock size={11} /> Read-only access
              </p>
            ) : vapiPublicKey ? (
              <TestCallButton
                vapiPublicKey={vapiPublicKey}
                vapiAssistantId={vapiId}
                agentName={agent.name}
              />
            ) : (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <AlertTriangle size={11} className="text-amber-400" />
                Add VAPI_PUBLIC_KEY to enable browser test calls
              </p>
            )}
          </div>
          <Link
            to={`/agents/${agent.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-400/30
              bg-brand-400/10 px-3 py-1.5 text-xs font-semibold text-brand-300
              hover:bg-brand-400/15 hover:border-brand-400/30 transition-all"
          >
            View Details
            <ExternalLink size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl
        bg-gradient-to-br from-slate-100 to-slate-50 border border-white/10 shadow-sm">
        <Bot size={34} strokeWidth={1} className="text-slate-300" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-200">No agents yet</p>
        <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
          Complete the onboarding flow to auto-provision your first AI receptionist.
          It will appear here immediately.
        </p>
      </div>
      <Link
        to="/onboarding/activate"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r
          from-brand-400 to-brand-400 px-5 py-2.5 text-sm font-semibold text-slate-900
          shadow-md shadow-brand-500/25 hover:from-brand-300 hover:to-brand-300
          transition-all active:scale-95"
      >
        <Zap size={15} />
        Go to Activate step
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const canWrite = useCanWrite('agents');
  const [agents, setAgents]               = useState<VoiceAgent[]>([]);
  const [vapiPublicKey, setVapiPublicKey] = useState<string | null>(null);
  const [vapiAssistantId, setVapiAssistantId] = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    api.get<{ success: boolean; data: AgentListResponse }>('/agents')
      .then((res) => {
        const { agents: a, vapiPublicKey: pk, vapiAssistantId: vid } = res.data.data;
        setAgents(a);
        setVapiPublicKey(pk);
        setVapiAssistantId(vid);
      })
      .catch(() => setError('Failed to load agents. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Agents</h1>
          <p className="mt-1 text-sm text-slate-400">
            {agents.length > 0
              ? `${agents.length} AI receptionist${agents.length > 1 ? 's' : ''} configured`
              : 'Manage your AI voice receptionists'
            }
          </p>
        </div>
        <button
          disabled
          title="Multiple agents coming in a future release"
          className="inline-flex items-center gap-2 rounded-xl border border-dashed
            border-white/15 px-4 py-2 text-sm font-medium text-slate-400
            cursor-not-allowed opacity-60"
        >
          <Plus size={15} />
          New Agent
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3
          flex items-center gap-2 text-sm text-red-300">
          <AlertTriangle size={15} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-2xl border border-white/10 bg-surface overflow-hidden animate-pulse">
          <div className="h-36 bg-gradient-to-r from-slate-100 to-slate-50" />
          <div className="px-6 py-5 space-y-4">
            <div className="flex gap-2">
              {[80, 64, 72].map((w) => (
                <div key={w} className="h-7 rounded-lg bg-white/[0.06]" style={{ width: w }} />
              ))}
            </div>
            <div className="h-10 rounded-xl bg-white/[0.06]" />
            <div className="flex justify-between">
              <div className="h-8 w-32 rounded-lg bg-white/[0.06]" />
              <div className="h-8 w-24 rounded-lg bg-white/[0.06]" />
            </div>
          </div>
        </div>
      )}

      {/* Agent cards */}
      {!loading && agents.length > 0 && (
        <div className="space-y-6">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              vapiPublicKey={vapiPublicKey}
              vapiAssistantId={vapiAssistantId}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && agents.length === 0 && <EmptyState />}

    </div>
  );
}
