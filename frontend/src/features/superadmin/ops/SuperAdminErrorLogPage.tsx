/**
 * Super Admin — Error Log Viewer
 *
 * Shows the last 500 5xx errors captured by the global error handler.
 * Features: pagination, filter by error code / status code, group-by-code stats sidebar.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle, RefreshCw, Filter, ChevronLeft, ChevronRight,
  TrendingUp, X,
} from 'lucide-react';
import api from '@/utils/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:    '#07070f',
  bgS:   '#0e0e1a',
  bgC:   'rgba(255,255,255,0.04)',
  bdr:   'rgba(255,255,255,0.07)',
  bdrB:  'rgba(255,255,255,0.12)',
  red:   '#ef4444',
  redL:  '#fca5a5',
  amber: '#f59e0b',
  amberL:'#fde68a',
  blue:  '#3b82f6',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorLog {
  _id:        string;
  message:    string;
  code?:      string;
  statusCode?: number;
  stack?:     string;
  path?:      string;
  method?:    string;
  orgId?:     string;
  userId?:    string;
  createdAt:  string;
}

interface ErrorPage {
  logs:  ErrorLog[];
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

interface ErrorStat {
  code:     string | null;
  count:    number;
  lastSeen: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchErrorLogs = (page: number, code?: string, statusCode?: number): Promise<ErrorPage> =>
  api.get('/superadmin/error-logs', { params: { page, limit: 50, code, statusCode } })
    .then(r => (r.data as { data: ErrorPage }).data);

const fetchErrorStats = (): Promise<{ stats: ErrorStat[]; total: number }> =>
  api.get('/superadmin/error-logs/stats').then(r => (r.data as { data: { stats: ErrorStat[]; total: number } }).data);

// ─── Sub-components ───────────────────────────────────────────────────────────

function MethodBadge({ method }: { method?: string }) {
  const colors: Record<string, string> = {
    GET:    '#22c55e',
    POST:   '#3b82f6',
    PUT:    '#f59e0b',
    PATCH:  '#a855f7',
    DELETE: '#ef4444',
  };
  const color = colors[method ?? ''] ?? T.t3;
  return method ? (
    <code style={{
      fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
      padding: '2px 6px', borderRadius: 4,
      background: `${color}15`, color,
      border: `1px solid ${color}30`,
    }}>
      {method}
    </code>
  ) : null;
}

function ErrorRow({ log, isExpanded, onToggle }: {
  log:        ErrorLog;
  isExpanded: boolean;
  onToggle:   () => void;
}) {
  const isServerError = !log.statusCode || log.statusCode >= 500;

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          background: isExpanded ? 'rgba(239,68,68,0.05)' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        <td style={{ padding: '10px 18px', borderBottom: `1px solid ${T.bdr}` }}>
          <span style={{
            display: 'inline-block',
            width: 8, height: 8, borderRadius: '50%',
            background: isServerError ? T.red : T.amber,
            marginRight: 8,
          }} />
          <span style={{
            fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
            color: isServerError ? T.redL : T.amberL,
          }}>
            {log.statusCode ?? '5xx'}
          </span>
        </td>
        <td style={{ padding: '10px 0', borderBottom: `1px solid ${T.bdr}`, maxWidth: 320 }}>
          <p style={{
            fontSize: 12, color: T.t1, margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {log.message}
          </p>
          <p style={{ fontSize: 11, color: T.t3, margin: '2px 0 0', fontFamily: 'monospace' }}>
            {log.code ?? '—'}
          </p>
        </td>
        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.bdr}`, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MethodBadge method={log.method} />
            <code style={{ fontSize: 11, color: T.t2, fontFamily: 'monospace' }}>
              {log.path ?? '—'}
            </code>
          </div>
        </td>
        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${T.bdr}`, color: T.t3, fontSize: 11, whiteSpace: 'nowrap' }}>
          {log.orgId ? <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.orgId.slice(-8)}</code> : '—'}
        </td>
        <td style={{ padding: '10px 18px', borderBottom: `1px solid ${T.bdr}`, color: T.t3, fontSize: 11, whiteSpace: 'nowrap', textAlign: 'right' }}>
          {new Date(log.createdAt).toLocaleString()}
        </td>
      </tr>

      {/* Expanded stack trace row */}
      {isExpanded && (
        <tr style={{ background: 'rgba(239,68,68,0.04)' }}>
          <td colSpan={5} style={{ padding: '0 18px 14px', borderBottom: `1px solid ${T.bdr}` }}>
            <pre style={{
              margin: 0, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(0,0,0,0.4)', border: `1px solid rgba(239,68,68,0.2)`,
              fontSize: 11, color: T.redL, fontFamily: 'monospace',
              maxHeight: 240, overflowY: 'auto', lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {log.stack ?? log.message}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperAdminErrorLogPage() {
  const [page, setPage]             = useState(1);
  const [codeFilter, setCodeFilter] = useState('');
  const [scFilter, setScFilter]     = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeCode = codeFilter.trim() || undefined;
  const activeSc   = scFilter.trim() ? Number(scFilter.trim()) : undefined;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sa-error-logs', page, activeCode, activeSc],
    queryFn:  () => fetchErrorLogs(page, activeCode, activeSc),
  });

  const { data: statsData } = useQuery({
    queryKey: ['sa-error-stats'],
    queryFn:  fetchErrorStats,
  });

  const logs  = data?.logs  ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const clearFilters = () => {
    setCodeFilter('');
    setScFilter('');
    setPage(1);
  };

  const hasFilters = !!activeCode || !!activeSc;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.t1, margin: 0 }}>Error Logs</h1>
          <p style={{ fontSize: 13, color: T.t2, margin: '6px 0 0' }}>
            Unhandled 5xx errors captured by the global error handler — last 30 days, newest first.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.bdr}`,
            background: 'transparent', color: T.t2, fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Main layout — table (left) + stats sidebar (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>

        {/* ── Left: log table ───────────────────────────────────────────────── */}
        <div style={{
          background: T.bgS, border: `1px solid ${T.bdr}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          {/* Filter bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', borderBottom: `1px solid ${T.bdr}`,
            flexWrap: 'wrap',
          }}>
            <Filter size={13} color={T.t3} />
            <input
              value={codeFilter}
              onChange={(e) => { setCodeFilter(e.target.value.toUpperCase()); setPage(1); }}
              placeholder="Error code (e.g. NOT_FOUND)"
              style={{
                padding: '6px 10px', borderRadius: 7, background: T.bgC,
                border: `1px solid ${T.bdr}`, color: T.t1, fontSize: 12,
                outline: 'none', width: 200, fontFamily: 'monospace',
              }}
            />
            <input
              value={scFilter}
              onChange={(e) => { setScFilter(e.target.value); setPage(1); }}
              placeholder="Status code (e.g. 500)"
              type="number"
              style={{
                padding: '6px 10px', borderRadius: 7, background: T.bgC,
                border: `1px solid ${T.bdr}`, color: T.t1, fontSize: 12,
                outline: 'none', width: 160,
              }}
            />
            {hasFilters && (
              <button
                onClick={clearFilters}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 6,
                  border: `1px solid rgba(239,68,68,0.3)`,
                  background: 'rgba(239,68,68,0.08)', color: T.red,
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                <X size={11} /> Clear
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: T.t3 }}>
              {total.toLocaleString()} error{total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.t3, fontSize: 13 }}>
              Loading error logs…
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.t3, fontSize: 13 }}>
              {hasFilters ? 'No errors match these filters.' : 'No errors recorded yet.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {['Status', 'Message / Code', 'Path', 'Org', 'Time'].map(h => (
                      <th key={h} style={{
                        padding: '8px 18px', textAlign: 'left',
                        fontSize: 10, fontWeight: 700, color: T.t3,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        borderBottom: `1px solid ${T.bdr}`,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <ErrorRow
                      key={log._id}
                      log={log}
                      isExpanded={expandedId === log._id}
                      onToggle={() => setExpandedId(expandedId === log._id ? null : log._id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', borderTop: `1px solid ${T.bdr}`,
            }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 7, border: `1px solid ${T.bdr}`,
                  background: 'transparent', color: page === 1 ? T.t3 : T.t2,
                  fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={12} /> Prev
              </button>

              <span style={{ fontSize: 12, color: T.t3 }}>
                Page {page} of {pages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 7, border: `1px solid ${T.bdr}`,
                  background: 'transparent', color: page === pages ? T.t3 : T.t2,
                  fontSize: 12, cursor: page === pages ? 'not-allowed' : 'pointer',
                }}
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>

        {/* ── Right: stats sidebar ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Total count card */}
          <div style={{
            background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 10,
            padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AlertCircle size={14} color={T.red} />
              <p style={{ fontSize: 12, fontWeight: 700, color: T.t2, margin: 0 }}>Total (30 days)</p>
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, color: T.red, margin: 0, lineHeight: 1 }}>
              {(statsData?.total ?? 0).toLocaleString()}
            </p>
            <p style={{ fontSize: 11, color: T.t3, margin: '4px 0 0' }}>logged errors</p>
          </div>

          {/* Top error codes */}
          <div style={{
            background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 14px', borderBottom: `1px solid ${T.bdr}`,
            }}>
              <TrendingUp size={13} color={T.t3} />
              <p style={{ fontSize: 12, fontWeight: 700, color: T.t2, margin: 0 }}>Top Error Codes</p>
            </div>

            {(statsData?.stats ?? []).length === 0 ? (
              <p style={{ padding: '16px 14px', fontSize: 12, color: T.t3, margin: 0 }}>
                No data yet.
              </p>
            ) : (
              <div>
                {(statsData?.stats ?? []).slice(0, 10).map((stat, i) => {
                  const maxCount = statsData?.stats[0]?.count ?? 1;
                  const pct = Math.round((stat.count / maxCount) * 100);
                  return (
                    <div
                      key={stat.code ?? 'null'}
                      onClick={() => { setCodeFilter(stat.code ?? ''); setPage(1); }}
                      style={{
                        padding: '8px 14px',
                        borderBottom: i < (statsData?.stats ?? []).length - 1 ? `1px solid ${T.bdr}` : 'none',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = T.bgC; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', color: T.t1, fontWeight: 700 }}>
                          {stat.code ?? 'UNKNOWN'}
                        </code>
                        <span style={{ fontSize: 11, color: T.red, fontWeight: 700 }}>
                          {stat.count.toLocaleString()}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{
                        height: 3, borderRadius: 2, background: T.bgC, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          width: `${pct}%`,
                          background: `linear-gradient(to right, ${T.red}, ${T.amber})`,
                        }} />
                      </div>
                      <p style={{ fontSize: 10, color: T.t3, margin: '3px 0 0' }}>
                        Last {new Date(stat.lastSeen).toLocaleDateString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hint */}
          <p style={{ fontSize: 11, color: T.t3, lineHeight: 1.5, margin: 0 }}>
            Click a row in the table to expand its stack trace.
            Click an error code in the sidebar to filter by it.
          </p>
        </div>
      </div>
    </div>
  );
}
