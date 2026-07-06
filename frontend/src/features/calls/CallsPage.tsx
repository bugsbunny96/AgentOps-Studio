/**
 * CallsPage — paginated call log for the authenticated org.
 *
 * Filters: status (all / active / completed / failed)
 *          direction (all / Inbound / Outbound)
 *          date range (dateFrom, dateTo)
 *
 * Clicking a row navigates to /calls/:id for the full detail view.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PhoneCall, PhoneIncoming, PhoneOutgoing,
  Clock, CheckCircle2, XCircle, Loader2,
  ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react';
import api from '@/utils/api';
import type { Call } from '@/types';

// ─── API ─────────────────────────────────────────────────────────────────────

interface ListCallsResponse {
  success: boolean;
  calls: Call[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Filters {
  status: '' | 'active' | 'completed' | 'failed';
  direction: '' | 'Inbound' | 'Outbound';
  dateFrom: string;
  dateTo: string;
}

async function fetchCalls(page: number, filters: Filters): Promise<ListCallsResponse> {
  const params: Record<string, string> = { page: String(page), limit: '20' };
  if (filters.status)    params['status']    = filters.status;
  if (filters.direction) params['direction'] = filters.direction;
  if (filters.dateFrom)  params['dateFrom']  = filters.dateFrom;
  if (filters.dateTo)    params['dateTo']    = filters.dateTo;

  const { data } = await api.get<ListCallsResponse>('/calls', { params });
  return data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Call['status'] }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: 'rgba(16,185,129,.1)', color: '#059669' }}>
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ background: 'rgba(99,102,241,.1)', color: '#4f46e5' }}>
        <CheckCircle2 size={11} />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: 'rgba(239,68,68,.1)', color: '#dc2626' }}>
      <XCircle size={11} />
      Failed
    </span>
  );
}

function DirectionChip({ direction }: { direction: Call['direction'] }) {
  if (direction === 'Inbound') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
        <PhoneIncoming size={12} className="text-emerald-500" />
        Inbound
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
      <PhoneOutgoing size={12} className="text-violet-500" />
      Outbound
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = { status: '', direction: '', dateFrom: '', dateTo: '' };

export default function CallsPage() {
  const navigate = useNavigate();
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['calls', page, filters],
    queryFn:  () => fetchCalls(page, filters),
  });

  function applyFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function clearFilters() {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  }

  const hasActiveFilters =
    filters.status !== '' || filters.direction !== '' ||
    filters.dateFrom !== '' || filters.dateTo !== '';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Calls</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every conversation your agent has had — searchable and filterable.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => applyFilter('status', e.target.value as Filters['status'])}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600"
        >
          <option value="">All statuses</option>
          <option value="active">Live</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>

        {/* Direction */}
        <select
          value={filters.direction}
          onChange={(e) => applyFilter('direction', e.target.value as Filters['direction'])}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600"
        >
          <option value="">All directions</option>
          <option value="Inbound">Inbound</option>
          <option value="Outbound">Outbound</option>
        </select>

        {/* Date from */}
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => applyFilter('dateFrom', e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600"
          placeholder="From"
        />

        {/* Date to */}
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => applyFilter('dateTo', e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600"
          placeholder="To"
        />

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content area */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-brand-600" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            {(error as Error)?.message ?? 'Failed to load calls. Please refresh and try again.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {data.calls.length === 0 ? (
            // Empty state
            <div
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white"
              style={{ minHeight: 300 }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(99,102,241,.08) 0%, transparent 100%)' }}
              />
              <div className="relative flex flex-col items-center justify-center px-8 py-16 text-center">
                <div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.12))',
                    border: '1px solid rgba(99,102,241,.2)',
                  }}
                >
                  <PhoneCall size={24} className="text-brand-600" strokeWidth={1.8} />
                </div>
                <h2 className="mb-1.5 text-base font-semibold text-slate-800">
                  {hasActiveFilters ? 'No calls match your filters' : 'No calls yet'}
                </h2>
                <p className="mb-5 max-w-sm text-sm text-slate-500 leading-relaxed">
                  {hasActiveFilters
                    ? 'Try adjusting or clearing your filters.'
                    : 'Once your AI agent takes calls, every conversation will appear here.'}
                </p>
                {hasActiveFilters ? (
                  <button
                    onClick={clearFilters}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Clear filters
                  </button>
                ) : (
                  <Link
                    to="/agents"
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                  >
                    <PhoneCall size={14} />
                    View your agent
                  </Link>
                )}
              </div>
            </div>
          ) : (
            // Call table
            <>
              {/* Summary line */}
              <p className="text-xs text-slate-500">
                {data.total.toLocaleString()} call{data.total !== 1 ? 's' : ''}
                {hasActiveFilters && ' matching filters'}
              </p>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Caller</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Direction</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Duration</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.calls.map((call) => (
                      <tr
                        key={call.id}
                        onClick={() => navigate(`/calls/${call.id}`)}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                              style={{ background: 'rgba(99,102,241,.08)' }}
                            >
                              <PhoneCall size={13} className="text-brand-600" strokeWidth={1.8} />
                            </div>
                            <span className="font-medium text-slate-800 font-mono text-xs">
                              {call.callerNumber}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <DirectionChip direction={call.direction} />
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={call.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 text-slate-600">
                            <Clock size={12} className="text-slate-400" />
                            {formatDuration(call.duration)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">
                          {formatDate(call.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Page {data.page} of {data.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page >= data.totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
