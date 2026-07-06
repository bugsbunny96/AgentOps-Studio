/**
 * L2.F4 — ActivatePage (Onboarding Step 5: Activate)
 *
 * On mount:
 *  1. Calls POST /api/v1/agents/provision (idempotent) — creates the Vapi assistant
 *     and local VoiceAgent record if not already done. The assistant is immediately
 *     visible in the Vapi dashboard.
 *  2. Shows the TestCallWidget — a browser-based test call using @vapi-ai/web SDK.
 *  3. Keeps the existing setup checklist and Launch CTA.
 *
 * On "Launch" → POST /api/v1/onboarding/complete → navigates to /dashboard.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Loader2,
  Rocket,
  CheckCircle2,
  AlertCircle,
  Phone,
  Globe,
  BookOpen,
  Languages,
  Settings2,
  MessageSquare,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AxiosError } from 'axios';
import Vapi from '@vapi-ai/web';
import { useAuth } from '@/hooks/useAuth';
import type { Organization } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type CallState = 'idle' | 'connecting' | 'active' | 'agent-speaking' | 'user-speaking' | 'ended' | 'error';

interface AgentConfig {
  vapiPublicKey: string | null;
  vapiAssistantId: string;
  agent: {
    id: string;
    name: string;
    systemPrompt: string;
    vapiAssistantId: string;
  };
}

// ─── Language labels ──────────────────────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  'en-US': 'English',
  'hi-IN': 'हिन्दी',
  'pa-IN': 'ਪੰਜਾਬੀ',
};

// ─── Checklist helpers ────────────────────────────────────────────────────────

interface CheckItem {
  key: string;
  label: string;
  detail?: string;
  status: 'done' | 'partial' | 'skipped';
  icon: React.ReactNode;
}

function buildChecklist(org: Organization | null): CheckItem[] {
  if (!org) return [];

  const items: CheckItem[] = [];

  items.push({
    key: 'workspace',
    label: 'Business workspace created',
    detail: org.industry,
    status: 'done',
    icon: <CheckCircle2 size={16} />,
  });

  if (org.hasWebsite && org.crawlEnabled && org.websiteUrl) {
    items.push({
      key: 'kb',
      label: 'Website crawled',
      detail: org.websiteUrl,
      status: 'done',
      icon: <Globe size={16} />,
    });
  } else if (org.hasWebsite && !org.crawlEnabled) {
    items.push({
      key: 'kb',
      label: 'Knowledge base — manual entry',
      detail: 'Add articles from the dashboard',
      status: 'partial',
      icon: <BookOpen size={16} />,
    });
  } else {
    items.push({
      key: 'kb',
      label: 'Knowledge base — description-based',
      detail: org.businessDescription
        ? `${org.businessDescription.slice(0, 60)}…`
        : 'No description provided yet',
      status: org.businessDescription ? 'done' : 'skipped',
      icon: <BookOpen size={16} />,
    });
  }

  const configBits: string[] = [];
  if (org.agentName)            configBits.push(`Agent: ${org.agentName}`);
  if (org.services?.length)     configBits.push(`${org.services.length} service${org.services.length > 1 ? 's' : ''}`);
  if (org.locations?.length)    configBits.push(`${org.locations.length} location${org.locations.length > 1 ? 's' : ''}`);
  if (org.businessHours?.start) configBits.push(`Hours: ${org.businessHours.start}–${org.businessHours.end}`);

  items.push({
    key: 'config',
    label: 'Business configured',
    detail: configBits.length ? configBits.join(' · ') : 'Skipped — configurable from dashboard',
    status: configBits.length >= 2 ? 'done' : configBits.length === 1 ? 'partial' : 'skipped',
    icon: <Settings2 size={16} />,
  });

  const faqCount = org.faqs?.length ?? 0;
  items.push({
    key: 'faqs',
    label: faqCount > 0 ? `${faqCount} FAQ${faqCount > 1 ? 's' : ''} loaded` : 'FAQs',
    detail:
      faqCount > 0
        ? 'Your AI will use these to answer callers'
        : 'None added — add from dashboard anytime',
    status: faqCount > 0 ? 'done' : 'skipped',
    icon: <MessageSquare size={16} />,
  });

  const langNames = (org.supportedLanguages ?? []).map((c) => LANG_LABELS[c] ?? c);
  items.push({
    key: 'languages',
    label: 'Languages enabled',
    detail: langNames.join(', ') || 'English (default)',
    status: 'done',
    icon: <Languages size={16} />,
  });

  items.push({
    key: 'fallback',
    label: org.fallbackNumber ? 'Fallback transfer number set' : 'Fallback number',
    detail: org.fallbackNumber ?? 'Not set — optional, add from dashboard',
    status: org.fallbackNumber ? 'done' : 'skipped',
    icon: <Phone size={16} />,
  });

  return items;
}

function StatusIcon({ status }: { status: CheckItem['status'] }) {
  if (status === 'done')    return <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />;
  if (status === 'partial') return <AlertCircle  size={16} className="text-amber-400  flex-shrink-0" />;
  return <CheckCircle2 size={16} className="text-slate-300 flex-shrink-0" />;
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ org }: { org: Organization }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Your agent at a glance
      </p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-slate-400">Business</p>
          <p className="font-medium text-slate-800 truncate">{org.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Industry</p>
          <p className="font-medium text-slate-800">{org.industry}</p>
        </div>
        {org.agentName && (
          <div>
            <p className="text-xs text-slate-400">Agent name</p>
            <p className="font-medium text-slate-800">{org.agentName}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-400">Languages</p>
          <p className="font-medium text-slate-800">
            {(org.supportedLanguages ?? []).map((c) => LANG_LABELS[c] ?? c).join(', ') || 'English'}
          </p>
        </div>
        {org.businessHours?.start && (
          <div>
            <p className="text-xs text-slate-400">Hours</p>
            <p className="font-medium text-slate-800">
              {org.businessHours.start} – {org.businessHours.end}
            </p>
          </div>
        )}
        {org.fallbackNumber && (
          <div>
            <p className="text-xs text-slate-400">Fallback number</p>
            <p className="font-medium text-slate-800">{org.fallbackNumber}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TestCallWidget ───────────────────────────────────────────────────────────

interface TestCallWidgetProps {
  vapiPublicKey: string;
  vapiAssistantId: string;
  agentName: string;
  systemPrompt: string;
}

function TestCallWidget({ vapiPublicKey, vapiAssistantId, agentName, systemPrompt }: TestCallWidgetProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  const cleanup = useCallback(() => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      vapiRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  function startCall() {
    setErrorMessage(null);
    setCallState('connecting');

    const vapi = new Vapi(vapiPublicKey);
    vapiRef.current = vapi;

    vapi.on('call-start', () => {
      setCallState('active');
    });

    vapi.on('call-end', () => {
      setCallState('ended');
      vapiRef.current = null;
    });

    vapi.on('speech-start', () => {
      // Agent is speaking
      setCallState('agent-speaking');
    });

    vapi.on('speech-end', () => {
      setCallState('active');
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vapi.on('error', (e: any) => {
      console.error('Vapi error:', e);
      const msg =
        e?.error?.message || e?.message || 'Call failed. Check your microphone permissions.';
      setErrorMessage(msg);
      setCallState('error');
      vapiRef.current = null;
    });

    vapi.start(vapiAssistantId);
  }

  function endCall() {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
    setCallState('ended');
  }

  function toggleMute() {
    if (vapiRef.current) {
      const nextMuted = !isMuted;
      vapiRef.current.setMuted(nextMuted);
      setIsMuted(nextMuted);
    }
  }

  function resetWidget() {
    cleanup();
    setCallState('idle');
    setErrorMessage(null);
    setIsMuted(false);
  }

  // ── Derived state ────────────────────────────────────────────────────
  const isCallActive = callState === 'active' || callState === 'agent-speaking' || callState === 'user-speaking';
  const isConnecting = callState === 'connecting';

  // ── Animated sound bars ───────────────────────────────────────────
  const SoundBars = () => (
    <div className="flex items-end gap-0.5 h-5">
      {[3, 5, 4, 6, 3, 5, 4].map((h, i) => (
        <div
          key={i}
          className="w-0.5 bg-emerald-500 rounded-full"
          style={{
            height: callState === 'agent-speaking' ? `${h * 3}px` : '4px',
            transition: 'height 0.15s ease',
            animationDelay: `${i * 0.07}s`,
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Bot size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{agentName}</p>
          <p className="text-xs text-slate-400">AI Voice Receptionist</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              isCallActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
            }`}
          />
          <span className="text-xs text-slate-400">
            {isConnecting
              ? 'Connecting…'
              : isCallActive
              ? 'Live call'
              : callState === 'ended'
              ? 'Call ended'
              : callState === 'error'
              ? 'Error'
              : 'Ready'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-6 space-y-4">
        {/* Idle / ready state */}
        {callState === 'idle' && (
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <PhoneCall size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Test your AI receptionist</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Click to start a browser call — your microphone is used for the test.
              </p>
            </div>
            <button
              type="button"
              onClick={startCall}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5
                text-sm font-semibold text-white shadow-sm hover:bg-indigo-700
                focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <PhoneCall size={15} />
              Start test call
            </button>
          </div>
        )}

        {/* Connecting */}
        {isConnecting && (
          <div className="text-center space-y-3 py-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
              <Loader2 size={24} className="text-indigo-500 animate-spin" />
            </div>
            <p className="text-sm text-slate-500">Connecting to your AI agent…</p>
          </div>
        )}

        {/* Active call */}
        {isCallActive && (
          <div className="space-y-4">
            {/* Waveform + status */}
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                {callState === 'agent-speaking' ? (
                  <SoundBars />
                ) : (
                  <Mic size={20} className="text-emerald-500" />
                )}
              </div>
              <p className="text-xs text-slate-500">
                {callState === 'agent-speaking' ? `${agentName} is speaking…` : 'Listening for you…'}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium border transition
                  ${isMuted
                    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
              >
                {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={endCall}
                className="flex items-center gap-1.5 rounded-md bg-red-500 px-4 py-2 text-xs
                  font-semibold text-white hover:bg-red-600 transition"
              >
                <PhoneOff size={13} />
                End call
              </button>
            </div>
          </div>
        )}

        {/* Ended */}
        {callState === 'ended' && (
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <PhoneOff size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Call ended</p>
              <p className="text-xs text-slate-400 mt-0.5">
                How did your AI receptionist do?
              </p>
            </div>
            <button
              type="button"
              onClick={resetWidget}
              className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
            >
              Test again
            </button>
          </div>
        )}

        {/* Error */}
        {callState === 'error' && (
          <div className="space-y-3">
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Call failed</p>
                {errorMessage && (
                  <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
                )}
              </div>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={resetWidget}
                className="text-xs text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* System prompt accordion */}
      <div className="border-t border-slate-100">
        <button
          type="button"
          onClick={() => setShowPrompt((p) => !p)}
          className="flex w-full items-center justify-between px-5 py-3 text-xs text-slate-500
            hover:bg-slate-50 transition"
        >
          <span className="font-medium">View system prompt</span>
          {showPrompt ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showPrompt && (
          <div className="px-5 pb-4">
            <pre className="rounded-md bg-slate-50 border border-slate-100 p-3 text-[10px]
              leading-relaxed text-slate-600 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
              {systemPrompt}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Provisioning states ──────────────────────────────────────────────────────

type ProvisionState = 'idle' | 'loading' | 'ready' | 'no-key' | 'error';

// ─── Main component ───────────────────────────────────────────────────────────

export default function ActivatePage() {
  const { completeOnboarding, provisionAgent, currentOrg } = useAuth();

  // Launch state
  const [isLaunching, setIsLaunching]   = useState(false);
  const [launchError, setLaunchError]   = useState<string | null>(null);

  // Provision state
  const [provisionState, setProvisionState] = useState<ProvisionState>('idle');
  const [agentConfig, setAgentConfig]       = useState<AgentConfig | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const checklist  = buildChecklist(currentOrg);
  const doneCount  = checklist.filter((c) => c.status === 'done').length;
  const totalCount = checklist.length;

  // ── Provision on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function provision() {
      setProvisionState('loading');
      try {
        const result = await provisionAgent();
        if (cancelled) return;

        if (!result.vapiPublicKey) {
          setProvisionState('no-key');
          return;
        }

        setAgentConfig(result as AgentConfig);
        setProvisionState('ready');
      } catch (err) {
        if (cancelled) return;
        const axiosErr = err as AxiosError<{ message?: string }>;
        setProvisionError(
          axiosErr.response?.data?.message ?? 'Failed to create AI agent. Try refreshing.',
        );
        setProvisionState('error');
      }
    }

    provision();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Launch handler ───────────────────────────────────────────────────
  async function handleLaunch() {
    setLaunchError(null);
    setIsLaunching(true);
    try {
      await completeOnboarding();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setLaunchError(axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.');
      setIsLaunching(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
          <Rocket size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">You're ready to launch!</h1>
          <p className="mt-1 text-sm text-slate-500">
            {currentOrg?.name
              ? `${currentOrg.name}'s AI agent is configured and waiting to go live.`
              : 'Your AI agent is configured and waiting to go live.'}
          </p>
        </div>
      </div>

      {/* Dynamic checklist */}
      {checklist.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Setup summary
            </p>
            <span className="text-xs text-slate-500">{doneCount}/{totalCount} complete</span>
          </div>
          <div className="space-y-3">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-start gap-3">
                <StatusIcon status={item.status} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium leading-tight
                    ${item.status === 'done' ? 'text-slate-800' : item.status === 'partial' ? 'text-amber-700' : 'text-slate-400'}`}>
                    {item.label}
                  </p>
                  {item.detail && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{item.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary config card */}
      {currentOrg && <SummaryCard org={currentOrg} />}

      {/* ── Test Call Section ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Try your agent</p>
          <span className="text-xs text-slate-400">Browser test call — uses your mic</span>
        </div>

        {/* Loading: provisioning Vapi assistant */}
        {provisionState === 'loading' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center gap-3">
            <Loader2 size={22} className="text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-500">Creating your AI voice agent…</p>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              Your agent is being configured. This happens once — refresh won't trigger it again.
            </p>
          </div>
        )}

        {/* Ready: show TestCallWidget */}
        {provisionState === 'ready' && agentConfig && (
          <TestCallWidget
            vapiPublicKey={agentConfig.vapiPublicKey!}
            vapiAssistantId={agentConfig.vapiAssistantId}
            agentName={agentConfig.agent.name}
            systemPrompt={agentConfig.agent.systemPrompt}
          />
        )}

        {/* No VAPI_PUBLIC_KEY configured */}
        {provisionState === 'no-key' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-sm font-medium text-amber-800">Browser test calls not configured</p>
            </div>
            <p className="text-xs text-amber-700">
              Browser test calls are not yet enabled. Your AI agent has already been created and is live —
              contact your administrator to enable the browser test call feature.
            </p>
          </div>
        )}

        {/* Provision error */}
        {provisionState === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <p className="text-sm font-medium text-red-700">Agent creation failed</p>
            </div>
            {provisionError && (
              <p className="text-xs text-red-600">{provisionError}</p>
            )}
            <p className="text-xs text-red-500">
              You can still launch — your agent can be set up from the dashboard.
            </p>
          </div>
        )}
      </div>

      {/* Agent ID (visible once provisioned) */}
      {(provisionState === 'ready' || provisionState === 'no-key') && agentConfig && (
        <p className="text-xs text-slate-400 text-center">
          Agent ID:{' '}
          <code className="font-mono text-indigo-600">
            {agentConfig.vapiAssistantId.slice(0, 8)}…
          </code>
        </p>
      )}

      {/* Launch error */}
      {launchError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {launchError}
        </div>
      )}

      {/* Launch CTA */}
      <div className="space-y-3">
        <button
          type="button"
          disabled={isLaunching}
          onClick={handleLaunch}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600
            px-4 py-3 text-sm font-semibold text-white shadow-sm
            hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500
            disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLaunching && <Loader2 size={16} className="animate-spin" />}
          {isLaunching ? 'Activating…' : '🚀 Launch my AI agent'}
        </button>
        <p className="text-center text-xs text-slate-400">
          You can update all settings from the dashboard at any time.
        </p>
      </div>
    </div>
  );
}
