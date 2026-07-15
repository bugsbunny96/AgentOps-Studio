/**
 * CallDetailPage — full call detail with transcript turns and AI summary.
 *
 * Fetches: GET /api/v1/calls/:id → { call, transcript, summary }
 * Shows:
 *   • Hero card: caller, direction, status, duration, date, cost
 *   • Recording player (if recordingUrl present)
 *   • Transcript turn viewer (agent/user speech bubbles)
 *   • AI Summary card (summaryText, intentDetected, actionItems, resolutionState)
 */

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, PhoneCall, PhoneIncoming, PhoneOutgoing,
  Clock, CheckCircle2, XCircle, Loader2, AlertCircle,
  FileText, Mic, Lightbulb, ListChecks, Play,
} from 'lucide-react';
import api from '@/utils/api';
import type { Call, TranscriptTurn } from '@/types';

// ─── API types ────────────────────────────────────────────────────────────────

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

function resolutionLabel(state: Summary['resolutionState']): { label: string; color: string } {
  switch (state) {
    case 'Resolved':        return { label: 'Resolved',         color: '#059669' };
    case 'Transferred':     return { label: 'Transferred',      color: '#d97706' };
    case 'Needs_Followup':  return { label: 'Needs Follow-up',  color: '#7c3aed' };
    default:                return { label: state,              color: '#64748b' };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroCard({ call }: { call: Call }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: caller + meta */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.12))',
              border: '1px solid rgba(99,102,241,.2)',
            }}
          >
            <PhoneCall size={24} className="text-brand-600" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Caller</p>
            <p className="text-lg font-bold text-slate-900 font-mono">{call.callerNumber}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateFull(call.createdAt)}</p>
          </div>
        </div>

        {/* Right: chips */}
        <div className="flex flex-wrap gap-2">
          {/* Status */}
          {call.status === 'active' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: 'rgba(16,185,129,.1)', color: '#059669' }}>
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          ) : call.status === 'completed' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: 'rgba(99,102,241,.1)', color: '#4f46e5' }}>
              <CheckCircle2 size={12} />
              Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626' }}>
              <XCircle size={12} />
              Failed
            </span>
          )}

          {/* Direction */}
          {call.direction === 'Inbound' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600">
              <PhoneIncoming size={12} className="text-emerald-500" />
              Inbound
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600">
              <PhoneOutgoing size={12} className="text-violet-500" />
              Outbound
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
        <Stat label="Duration" value={formatDuration(call.duration)} icon={<Clock size={14} className="text-slate-400" />} />
        <Stat label="Cost" value={`$${(call.cost ?? 0).toFixed(4)}`} icon={null} />
        {call.recordingUrl && (
          <Stat label="Recording" value="Available" icon={<Play size={14} className="text-slate-400" />} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-700">
        {icon}
        {value}
      </p>
    </div>
  );
}

// ─── Recording player ─────────────────────────────────────────────────────────

function RecordingPlayer({ url }: { url: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.12)' }}
        >
          <Play size={14} className="text-brand-600" strokeWidth={1.8} />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">Recording</h2>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls className="w-full" src={url}>
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}

// ─── Transcript viewer ────────────────────────────────────────────────────────

function TranscriptViewer({ transcript }: { transcript: Transcript }) {
  if (transcript.turns.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <SectionHeader icon={<FileText size={14} className="text-brand-600" />} title="Transcript" />
        <p className="mt-4 text-sm text-slate-400 italic">No transcript turns recorded for this call.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <SectionHeader icon={<Mic size={14} className="text-brand-600" />} title="Transcript" />
      <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
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
              className="max-w-[75%] rounded-xl px-3.5 py-2.5"
              style={
                turn.speaker === 'agent'
                  ? { background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)' }
                  : { background: 'rgba(241,245,249,1)', border: '1px solid rgba(226,232,240,1)' }
              }
            >
              <p className="text-xs font-medium mb-1"
                style={{ color: turn.speaker === 'agent' ? '#4f46e5' : '#0f766e' }}>
                {turn.speaker === 'agent' ? 'Agent' : 'Caller'}
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{turn.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Summary card ──────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: Summary }) {
  const res = resolutionLabel(summary.resolutionState);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader icon={<Lightbulb size={14} className="text-brand-600" />} title="AI Summary" />
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ background: `${res.color}1a`, color: res.color }}
        >
          <CheckCircle2 size={11} />
          {res.label}
        </span>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed mb-5">{summary.summaryText}</p>

      {summary.intentDetected.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Intent Detected</p>
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

      {summary.actionItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            <ListChecks size={12} className="inline mr-1" />
            Action Items
          </p>
          <ul className="space-y-1.5">
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

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.12)' }}
      >
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['call', id],
    queryFn:  () => fetchCallDetail(id!),
    enabled:  Boolean(id),
  });

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          to="/calls"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={14} />
          Calls
        </Link>
        <span className="text-slate-200">/</span>
        <span className="text-sm font-medium text-slate-700 font-mono">
          {id ? `${id.slice(0, 8)}…` : 'Call Detail'}
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-brand-600" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">Failed to load call details. Please go back and try again.</p>
        </div>
      )}

      {/* Content */}
      {data?.data && (() => {
        const { call, transcript, summary } = data.data;
        return (
          <div className="space-y-5">
            {/* Hero */}
            <HeroCard call={call} />

            {/* Recording */}
            {call.recordingUrl && <RecordingPlayer url={call.recordingUrl} />}

            {/* Layout: transcript + summary side-by-side on large screens */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
              {/* Transcript — wider col */}
              <div className="xl:col-span-3">
                {transcript ? (
                  <TranscriptViewer transcript={transcript} />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <SectionHeader icon={<FileText size={14} className="text-brand-600" />} title="Transcript" />
                    <p className="mt-4 text-sm text-slate-400 italic">
                      No transcript available for this call.
                    </p>
                  </div>
                )}
              </div>

              {/* Summary — narrower col */}
              <div className="xl:col-span-2">
                {summary ? (
                  <SummaryCard summary={summary} />
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <SectionHeader icon={<Lightbulb size={14} className="text-brand-600" />} title="AI Summary" />
                    <p className="mt-4 text-sm text-slate-400 italic">
                      No AI summary available for this call.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
