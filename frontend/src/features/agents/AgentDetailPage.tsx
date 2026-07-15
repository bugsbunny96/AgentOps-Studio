/**
 * AgentDetailPage — full view of a single voice agent.
 *
 * Data: GET /api/v1/agents/:id → agent details
 *       GET /api/v1/agents/config → vapiPublicKey + vapiAssistantId
 *
 * Sections:
 *   1. Gradient hero header — name, status, Vapi ID, created date
 *   2. Configuration panel — voice, languages, provider
 *   3. System prompt viewer — full prompt with copy button
 *   4. Embedded test call — live browser call via @vapi-ai/web
 *   5. Footer info — IDs, timestamps
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Loader2,
  Copy,
  CheckCheck,
  AlertTriangle,
  Volume2,
  Globe,
  Zap,
  Calendar,
  Activity,
  FileText,
} from 'lucide-react';
import Vapi from '@vapi-ai/web';
import { api } from '@/utils/api';
import type { VoiceAgent } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentConfigResponse {
  vapiPublicKey: string | null;
  vapiAssistantId: string | null;
  agent: VoiceAgent | null;
}

type CallState = 'idle' | 'connecting' | 'active' | 'agent-speaking' | 'ended' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  'en-US': 'English (US)',
  'hi-IN': 'Hindi (India)',
  'pa-IN': 'Punjabi (India)',
};

const VOICE_LABELS: Record<string, string> = {
  openai: 'Neural',
  elevenlabs: 'Studio',
  cartesia: 'Realtime',
  azure: 'Cloud',
};

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200
        bg-white px-2.5 py-1 text-xs font-medium text-slate-500
        hover:bg-slate-50 hover:text-slate-800 transition-colors"
    >
      {copied ? <CheckCheck size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  );
}

// ─── Sound Bars ───────────────────────────────────────────────────────────────

function SoundBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[4, 7, 5, 9, 6, 8, 5, 4, 7, 5].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-emerald-400 transition-all duration-150"
          style={{ height: active ? `${h * 2}px` : '4px', transitionDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ─── Test Call Panel ──────────────────────────────────────────────────────────

function TestCallPanel({
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
  const [duration, setDuration] = useState(0);
  const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const vapiRef             = useRef<Vapi | null>(null);

  const cleanup = useCallback(() => {
    vapiRef.current?.stop();
    vapiRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  function start() {
    setError(null);
    setDuration(0);
    setState('connecting');
    const vapi = new Vapi(vapiPublicKey);
    vapiRef.current = vapi;

    vapi.on('call-start', () => {
      setState('active');
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    });
    vapi.on('call-end', () => {
      setState('ended');
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      vapiRef.current = null;
    });
    vapi.on('speech-start', () => setState('agent-speaking'));
    vapi.on('speech-end',   () => setState('active'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vapi.on('error', (e: any) => {
      setError(e?.error?.message ?? 'Call failed — check mic permissions');
      setState('error');
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      vapiRef.current = null;
    });

    vapi.start(vapiAssistantId);
  }

  function end() {
    cleanup();
    setState('ended');
  }

  function toggleMute() {
    if (vapiRef.current) {
      vapiRef.current.setMuted(!muted);
      setMuted((m) => !m);
    }
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  const isActive = state === 'active' || state === 'agent-speaking';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhoneCall size={15} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-800">Browser Test Call</h3>
        </div>
        <span className="text-xs text-slate-400">Uses your browser microphone</span>
      </div>

      <div className="px-6 py-6">
        {/* Idle / ended / error */}
        {(state === 'idle' || state === 'ended' || state === 'error') && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl
              bg-gradient-to-br from-brand-50 to-violet-50 border border-brand-100">
              <Bot size={34} strokeWidth={1.5} className="text-brand-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-800">{agentName}</p>
              <p className="text-sm text-slate-400 mt-0.5">
                {state === 'ended'
                  ? `Test call ended (${fmt(duration)})`
                  : 'Ready to take a call'}
              </p>
            </div>
            {state === 'error' && error && (
              <p className="text-xs text-red-500 flex items-center gap-1.5 bg-red-50
                rounded-lg px-3 py-2 border border-red-100">
                <AlertTriangle size={12} className="flex-shrink-0" /> {error}
              </p>
            )}
            <button
              onClick={start}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r
                from-brand-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white
                shadow-md shadow-brand-500/25 hover:from-brand-700 hover:to-violet-700
                transition-all active:scale-95"
            >
              <PhoneCall size={16} />
              {state === 'ended' ? 'Call Again' : 'Start Test Call'}
            </button>
          </div>
        )}

        {/* Connecting */}
        {state === 'connecting' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={32} className="animate-spin text-brand-500" />
            <p className="text-sm text-slate-500">Connecting to {agentName}…</p>
          </div>
        )}

        {/* Active call */}
        {isActive && (
          <div className="flex flex-col items-center gap-5 py-4">
            {/* Avatar + sound bars */}
            <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl
              bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/30">
              {state === 'agent-speaking' && (
                <div className="absolute inset-0 rounded-2xl border-2 border-brand-400
                  animate-ping opacity-40" />
              )}
              <Bot size={38} strokeWidth={1.5} className="text-white" />
            </div>

            <SoundBars active={state === 'agent-speaking'} />

            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800">
                {state === 'agent-speaking' ? `${agentName} is speaking` : 'Connected'}
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{fmt(duration)}</p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2
                  transition-all ${muted
                    ? 'border-amber-300 bg-amber-50 text-amber-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                onClick={end}
                className="flex h-11 w-11 items-center justify-center rounded-full
                  bg-red-500 text-white hover:bg-red-600 transition-colors
                  shadow-md shadow-red-500/30"
              >
                <PhoneOff size={18} />
              </button>
            </div>

            {muted && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <MicOff size={11} /> Microphone muted
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <Icon size={15} className="text-brand-500" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [agent, setAgent]               = useState<VoiceAgent | null>(null);
  const [vapiPublicKey, setVapiPublicKey] = useState<string | null>(null);
  const [vapiAssistantId, setVapiAssistantId] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<{ success: boolean; data: VoiceAgent }>(`/agents/${id}`),
      api.get<{ success: boolean; data: AgentConfigResponse }>('/agents/config'),
    ])
      .then(([agentRes, configRes]) => {
        setAgent(agentRes.data.data);
        setVapiPublicKey(configRes.data.data.vapiPublicKey);
        setVapiAssistantId(configRes.data.data.vapiAssistantId);
      })
      .catch(() => setError('Could not load agent. Check that the ID is valid.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/agents" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={14} /> Agents
          </Link>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-44 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 rounded-2xl bg-slate-100" />
            <div className="h-32 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <Link to="/agents" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={14} /> Agents
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center gap-3 text-red-700">
          <AlertTriangle size={16} />
          <div>
            <p className="font-semibold text-sm">Agent not found</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const vapiId = vapiAssistantId ?? agent.vapiAssistantId;
  const vapiIdShort = `${vapiId.slice(0, 8)}…${vapiId.slice(-4)}`;
  const langs = agent.supportedLanguages.map((l) => LANG_LABELS[l] ?? l);
  const createdAt = new Date(agent.createdAt).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          to="/agents"
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={14} /> Agents
        </Link>
        <span className="text-slate-200">/</span>
        <span className="font-medium text-slate-800">{agent.name}</span>
      </div>

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-brand-900
        to-slate-900 overflow-hidden shadow-xl">
        {/* Grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }} />
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48
          rounded-full bg-brand-500 opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40
          rounded-full bg-violet-500 opacity-15 blur-3xl" />

        <div className="relative flex items-center gap-6 px-8 py-8">
          {/* Bot avatar */}
          <div className="flex-shrink-0 flex h-20 w-20 items-center justify-center rounded-2xl
            bg-gradient-to-br from-brand-500 to-violet-600 shadow-xl shadow-brand-500/40">
            <Bot size={38} strokeWidth={1.5} className="text-white" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Status */}
              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1
                border text-xs font-semibold tracking-wide
                ${agent.status === 'Active'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
                }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  agent.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                }`} />
                {agent.status.toUpperCase()}
              </div>

              {/* Language tags */}
              {langs.map((l) => (
                <div key={l} className="flex items-center gap-1 rounded-full border
                  border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-[11px]
                  font-medium text-brand-300">
                  <Globe size={10} /> {l}
                </div>
              ))}
            </div>

            <h1 className="text-3xl font-bold text-white">{agent.name}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              {/* Agent ID */}
              <div className="flex items-center gap-1.5">
                <Zap size={11} className="text-brand-400" />
                <code className="font-mono text-slate-300">{vapiIdShort}</code>
                <CopyBtn text={vapiId} />
              </div>
              {/* Created */}
              <div className="flex items-center gap-1.5">
                <Calendar size={11} />
                Created {createdAt}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left column (3/5) */}
        <div className="lg:col-span-3 space-y-6">

          {/* Voice Configuration */}
          <Section icon={Volume2} title="Voice Configuration">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Voice Provider', value: VOICE_LABELS[agent.voiceProvider] ?? agent.voiceProvider },
                { label: 'Voice ID',       value: agent.voiceId },
                { label: 'Primary Language', value: LANG_LABELS[agent.primaryLanguage] ?? agent.primaryLanguage },
                { label: 'Languages',     value: langs.join(', ') },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* System Prompt */}
          <Section icon={FileText} title="System Prompt">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400">{agent.systemPrompt.length.toLocaleString()} characters</span>
              <CopyBtn text={agent.systemPrompt} label="Copy prompt" />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 max-h-80 overflow-y-auto">
              <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap font-mono">
                {agent.systemPrompt}
              </pre>
            </div>
          </Section>

        </div>

        {/* Right column (2/5) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Test Call */}
          {vapiPublicKey ? (
            <TestCallPanel
              vapiPublicKey={vapiPublicKey}
              vapiAssistantId={vapiId}
              agentName={agent.name}
            />
          ) : (
            <Section icon={PhoneCall} title="Browser Test Call">
              <div className="py-4 text-center space-y-3">
                <AlertTriangle size={28} className="mx-auto text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">VAPI_PUBLIC_KEY not set</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Add your Vapi public key to <code className="font-mono bg-slate-100 px-1 rounded">backend/.env</code> to
                    enable browser test calls.
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Agent info */}
          <Section icon={Activity} title="Agent Details">
            <div className="space-y-3">
              {[
                { label: 'Agent ID', value: agent.id, mono: true },
                { label: 'Vapi Assistant ID', value: vapiId, mono: true },
                { label: 'Status', value: agent.status },
                { label: 'Created', value: new Date(agent.createdAt).toLocaleString('en-IN') },
                { label: 'Updated', value: new Date(agent.updatedAt).toLocaleString('en-IN') },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex items-start justify-between gap-4 py-2
                  border-b border-slate-50 last:border-0">
                  <span className="text-xs font-medium text-slate-400 flex-shrink-0 pt-0.5">{label}</span>
                  <span className={`text-xs text-slate-700 text-right break-all
                    ${mono ? 'font-mono' : 'font-medium'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
