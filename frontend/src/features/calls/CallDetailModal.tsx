/**
 * CallDetailModal
 *
 * Opens over the Calls list to show full call detail in a 3-tab layout.
 * Fetches GET /api/v1/calls/:id on mount.
 *
 * Tabs:
 *   1. Audio & Recording  — player + hero stats
 *   2. Transcript          — speech bubbles with relative timestamps + copy
 *   3. Result (AI Action)  — intent, summary, action items, resolution
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, Play, Mic, Lightbulb, FileText,
  PhoneCall, PhoneIncoming, PhoneOutgoing,
  Clock, CheckCircle2, XCircle, Loader2, AlertCircle,
  ListChecks, Copy, Check,
} from 'lucide-react';
import api from '@/utils/api';
import type { Call, TranscriptTurn } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transcript {
  callId: string;
  turns: TranscriptTurn[];
}

interface Summary {
  callId: string;
  summaryText: string;
  intentDetected: string[];
  actionItems: string[];
  resolutionState: 'Resolved' | 'Transferred' | 'Needs_Followup';
}

interface CallDetailResponse {
  success: boolean;
  data: {
    call: Call;
    transcript: Transcript | null;
    summary: Summary | null;
  };
}

type Tab = 'recording' | 'transcript' | 'result';

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchCallDetail(callId: string): Promise<CallDetailResponse> {
  const { data } = await api.get<CallDetailResponse>(`/calls/${callId}`);
  return data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function humanizeEndedReason(reason: string): string {
  return reason.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatTurnOffset(firstTs: string, thisTs: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((new Date(thisTs).getTime() - new Date(firstTs).getTime()) / 1000),
  );
  return `${Math.floor(diffSec / 60)}:${(diffSec % 60).toString().padStart(2, '0')}`;
}

function resolutionMeta(state: Summary['resolutionState']): { label: string; color: string } {
  switch (state) {
    case 'Resolved':       return { label: 'Resolved',        color: '#059669' };
    case 'Transferred':    return { label: 'Transferred',     color: '#d97706' };
    case 'Needs_Followup': return { label: 'Needs Follow-up', color: '#7c3aed' };
    default:               return { label: state,             color: '#64748b' };
  }
}

// ─── Tab: Audio & Recording ───────────────────────────────────────────────────

function RecordingTab({ call }: { call: Call }) {
  return (
    <div className="space-y-5">
      {/* Stat pills */}
      <div className="flex flex-wrap gap-3">
        <StatPill icon={<Clock size={13} className="text-slate-400" />} label="Duration" value={formatDuration(call.duration)} />
        <StatPill icon={null} label="Date" value={formatDateFull(call.createdAt)} />
        {call.endedReason && (
          <StatPill icon={null} label="Ended" value={humanizeEndedReason(call.endedReason)} />
        )}
      </div>

      {/* Player or placeholder */}
      {call.recordingUrl ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.12)' }}
            >
              <Play size={13} className="text-brand-600" strokeWidth={1.8} />
            </div>
            <span className="text-sm font-semibold text-slate-700">Recording</span>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls className="w-full" src={call.recordingUrl}>
            Your browser does not support the audio element.
          </audio>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
          <Play size={15} className="text-slate-300 flex-shrink-0" />
          <p className="text-sm text-slate-400 italic">No recording available for this call.</p>
        </div>
      )}
    </div>
  );
}

function StatPill({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      {icon}
      <span className="text-xs text-slate-400">{label}:</span>
      <span className="text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

// ─── Tab: Transcript ──────────────────────────────────────────────────────────

function TranscriptTab({
  transcript,
  callStatus,
}: {
  transcript: Transcript | null;
  callStatus: Call['status'];
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!transcript) return;
    const text = transcript.turns
      .map((t) => `[${t.speaker === 'agent' ? 'Agent' : 'Caller'}]: ${t.text}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {/* clipboard unavailable */});
  }, [transcript]);

  if (!transcript) {
    if (callStatus === 'active') {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <span className="inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-emerald-500" />
          <p className="text-sm text-emerald-700">
            Call in progress — transcript will appear here when the call ends.
          </p>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
        <FileText size={15} className="text-slate-300 flex-shrink-0" />
        <p className="text-sm text-slate-400 italic">No transcript available for this call.</p>
      </div>
    );
  }

  if (transcript.turns.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic px-1">No transcript turns were recorded.</p>
    );
  }

  const firstTs = transcript.turns[0]?.timestamp ?? '';

  return (
    <div>
      {/* Copy button */}
      <div className="mb-3 flex justify-end">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={
            copied
              ? { background: 'rgba(5,150,105,.1)', color: '#059669' }
              : { background: 'rgba(100,116,139,.06)', color: '#64748b' }
          }
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy transcript'}
        </button>
      </div>

      {/* Turns */}
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        {transcript.turns.map((turn, i) => (
          <div
            key={i}
            className={`flex gap-3 ${turn.speaker === 'agent' ? '' : 'flex-row-reverse'}`}
          >
            {/* Avatar */}
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={
                turn.speaker === 'agent'
                  ? { background: 'rgba(99,102,241,.12)', color: '#4f46e5' }
                  : { background: 'rgba(15,118,110,.1)', color: '#0f766e' }
              }
            >
              {turn.speaker === 'agent' ? 'A' : 'C'}
            </div>

            {/* Bubble */}
            <div
              className="max-w-[78%] rounded-xl px-3.5 py-2.5"
              style={
                turn.speaker === 'agent'
                  ? { background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)' }
                  : { background: 'rgba(241,245,249,1)', border: '1px solid rgba(226,232,240,1)' }
              }
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <p
                  className="text-xs font-medium"
                  style={{ color: turn.speaker === 'agent' ? '#4f46e5' : '#0f766e' }}
                >
                  {turn.speaker === 'agent' ? 'Agent' : 'Caller'}
                </p>
                {turn.timestamp && firstTs && (
                  <p className="text-xs text-slate-400 tabular-nums flex-shrink-0">
                    {formatTurnOffset(firstTs, turn.timestamp)}
                  </p>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{turn.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Result (AI Action) ──────────────────────────────────────────────────

function ResultTab({
  summary,
  callStatus,
}: {
  summary: Summary | null;
  callStatus: Call['status'];
}) {
  if (!summary) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
        <Lightbulb size={15} className="text-slate-300 flex-shrink-0" />
        <p className="text-sm text-slate-400 italic">
          {callStatus === 'active'
            ? 'AI summary will be generated when the call ends.'
            : 'No AI result available for this call.'}
        </p>
      </div>
    );
  }

  const res = resolutionMeta(summary.resolutionState);

  return (
    <div className="space-y-5">
      {/* Resolution badge */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `${res.color}1a`, color: res.color }}
        >
          <CheckCircle2 size={12} />
          {res.label}
        </span>
      </div>

      {/* Summary text */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          AI Summary
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">{summary.summaryText}</p>
      </div>

      {/* Intent detected */}
      {summary.intentDetected.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Intent Detected
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.intentDetected.map((intent) => (
              <span
                key={intent}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: 'rgba(99,102,241,.08)', color: '#4f46e5' }}
              >
                {intent}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action items */}
      {summary.actionItems.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <ListChecks size={12} />
            Action Items
          </p>
          <ul className="space-y-2">
            {summary.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface CallDetailModalProps {
  callId: string;
  onClose: () => void;
}

const TAB_DEFS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'recording',  label: 'Audio & Recording',  icon: <Play size={13} strokeWidth={1.8} /> },
  { id: 'transcript', label: 'Transcript',          icon: <Mic size={13} strokeWidth={1.8} /> },
  { id: 'result',     label: 'Result (AI Action)',  icon: <Lightbulb size={13} strokeWidth={1.8} /> },
];

export default function CallDetailModal({ callId, onClose }: CallDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('recording');
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['call', callId],
    queryFn:  () => fetchCallDetail(callId),
    refetchInterval: (q) =>
      q.state.data?.data?.call?.status === 'active' ? 5_000 : false,
  });

  const detail = data?.data;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '90vh' }}
      >

        {/* ── Modal Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.12))',
                border: '1px solid rgba(99,102,241,.2)',
              }}
            >
              <PhoneCall size={16} className="text-brand-600" strokeWidth={1.8} />
            </div>

            <div>
              {detail ? (
                <>
                  <p className="text-sm font-bold text-slate-900 font-mono">
                    {detail.call.callerNumber}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {/* Status chip */}
                    {detail.call.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(16,185,129,.1)', color: '#059669' }}>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        Live
                      </span>
                    ) : detail.call.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(99,102,241,.1)', color: '#4f46e5' }}>
                        <CheckCircle2 size={10} />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626' }}>
                        <XCircle size={10} />
                        Failed
                      </span>
                    )}
                    {/* Direction chip */}
                    {detail.call.direction === 'Inbound' ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                        <PhoneIncoming size={10} className="text-emerald-500" />
                        Inbound
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                        <PhoneOutgoing size={10} className="text-violet-500" />
                        Outbound
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              )}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Tab Bar ───────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-100 px-6">
          {TAB_DEFS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-semibold transition-colors"
              style={
                activeTab === tab.id
                  ? { borderColor: '#4f46e5', color: '#4f46e5' }
                  : { borderColor: 'transparent', color: '#94a3b8' }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-brand-600" />
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">Failed to load call details.</p>
            </div>
          )}

          {/* Content */}
          {detail && (
            <>
              {activeTab === 'recording'  && <RecordingTab call={detail.call} />}
              {activeTab === 'transcript' && (
                <TranscriptTab
                  transcript={detail.transcript}
                  callStatus={detail.call.status}
                />
              )}
              {activeTab === 'result' && (
                <ResultTab
                  summary={detail.summary}
                  callStatus={detail.call.status}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
