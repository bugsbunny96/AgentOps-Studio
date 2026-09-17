/**
 * Public Changelog Page
 * Route: /changelog (public, no auth)
 *
 * Timeline layout showing published changelog entries fetched from GET /api/v1/changelog.
 * Type color-coded: New (teal) · Improved (blue) · Fixed (amber).
 * "What's new" dot indicator driven by localStorage — clears on visit.
 */

import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, Wrench, ChevronDown } from 'lucide-react';
import api from '@/utils/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:    '#030712',
  bgS:   '#0d1524',
  bgC:   'rgba(255,255,255,0.03)',
  bdr:   'rgba(255,255,255,0.07)',
  bdrB:  'rgba(255,255,255,0.12)',
  blue:  '#3b82f6',
  violet:'#8b5cf6',
  teal:  '#14b8a6',
  tealL: '#99f6e4',
  blueL: '#93c5fd',
  amber: '#f59e0b',
  amberL:'#fde68a',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangelogType = 'new' | 'improved' | 'fixed';

interface ChangelogEntry {
  _id:         string;
  title:       string;
  description: string;
  type:        ChangelogType;
  date:        string;
}

interface ChangelogPage {
  entries:    ChangelogEntry[];
  total:      number;
  page:       number;
  totalPages: number;
}

// ─── Type meta ────────────────────────────────────────────────────────────────

const TYPE_META: Record<ChangelogType, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; dot: string }> = {
  new:      { label: 'New',      color: T.tealL,  bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.3)',  icon: <Sparkles  size={12} />, dot: T.teal },
  improved: { label: 'Improved', color: T.blueL,  bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  icon: <TrendingUp size={12} />, dot: T.blue },
  fixed:    { label: 'Fixed',    color: T.amberL, bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  icon: <Wrench    size={12} />, dot: T.amber },
};

// ─── localStorage "What's new" LS key ─────────────────────────────────────────
export const CHANGELOG_LS_KEY = 'changelog_last_seen';

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchPage = async ({ pageParam = 1 }: { pageParam: number }): Promise<ChangelogPage> => {
  const { data } = await api.get(`/changelog?page=${pageParam}&limit=15`);
  return data.data;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<ChangelogPage, Error, { pages: ChangelogPage[] }, ['changelog'], number>({
    queryKey: ['changelog'],
    queryFn: fetchPage,
    initialPageParam: 1,
    getNextPageParam: (last) => last.page < last.totalPages ? last.page + 1 : undefined,
  });

  // Mark changelog as seen — clear the "What's new" dot on any connected dashboard
  useEffect(() => {
    if (data?.pages[0]?.entries[0]?.date) {
      localStorage.setItem(CHANGELOG_LS_KEY, data.pages[0].entries[0].date);
    }
  }, [data]);

  const allEntries: ChangelogEntry[] = data?.pages.flatMap(p => p.entries) ?? [];

  // Group by month
  const grouped = allEntries.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
    const key = new Date(entry.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 40px',
        borderBottom: `1px solid ${T.bdr}`,
        background: 'rgba(13,21,36,0.8)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.t1, letterSpacing: '-0.03em' }}>
            AgentOps<span style={{ color: T.teal }}>.</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <NavLink to="/blog">Blog</NavLink>
          <NavLink to="/changelog" active>Changelog</NavLink>
          <Link to="/dashboard" style={{
            padding: '6px 16px', borderRadius: 8,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none',
          }}>
            Open App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header style={{ padding: '72px 40px 48px', textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18,
          padding: '4px 14px', borderRadius: 99,
          background: 'rgba(20,184,166,0.1)', border: `1px solid rgba(20,184,166,0.25)`,
          fontSize: 11, fontWeight: 700, color: T.tealL, letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <Sparkles size={12} /> What's New
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, color: T.t1, margin: '0 0 16px', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          Changelog
        </h1>
        <p style={{ fontSize: 17, color: T.t2, margin: 0, lineHeight: 1.7 }}>
          Every feature shipped, bug fixed, and improvement made — documented in one place.
        </p>
      </header>

      {/* Type legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 48 }}>
        {(['new', 'improved', 'fixed'] as ChangelogType[]).map(t => {
          const m = TYPE_META[t];
          return (
            <span key={t} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 99,
              background: m.bg, border: `1px solid ${m.border}`,
              fontSize: 12, fontWeight: 600, color: m.color,
            }}>
              {m.icon}{m.label}
            </span>
          );
        })}
      </div>

      {/* Timeline */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 40px 80px' }}>
        {isLoading ? (
          <p style={{ color: T.t2, textAlign: 'center', marginTop: 60 }}>Loading…</p>
        ) : allEntries.length === 0 ? (
          <EmptyState />
        ) : (
          Object.entries(grouped).map(([month, entries]) => (
            <MonthGroup key={month} month={month} entries={entries} />
          ))
        )}

        {/* Load more */}
        {hasNextPage && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 24px', borderRadius: 10,
                border: `1px solid ${T.bdrB}`, background: T.bgC,
                color: T.t2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                opacity: isFetchingNextPage ? 0.6 : 1,
              }}
            >
              <ChevronDown size={15} />
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Month Group ──────────────────────────────────────────────────────────────

function MonthGroup({ month, entries }: { month: string; entries: ChangelogEntry[] }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{
        margin: '0 0 24px', fontSize: 13, fontWeight: 700,
        color: T.t3, letterSpacing: '0.06em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {month}
        <span style={{ flex: 1, height: 1, background: T.bdr }} />
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {entries.map((entry, i) => (
          <EntryCard key={entry._id} entry={entry} isLast={i === entries.length - 1} />
        ))}
      </div>
    </div>
  );
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

function EntryCard({ entry, isLast }: { entry: ChangelogEntry; isLast: boolean }) {
  const m    = TYPE_META[entry.type];
  const date = new Date(entry.date);
  const day  = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div style={{ display: 'flex', gap: 20, paddingBottom: isLast ? 0 : 32 }}>
      {/* Timeline column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', marginTop: 6, flexShrink: 0,
          background: m.dot, boxShadow: `0 0 8px ${m.dot}88`,
        }} />
        {!isLast && (
          <div style={{ width: 1, flex: 1, marginTop: 4, background: T.bdr }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: T.t3, fontWeight: 600, letterSpacing: '0.02em' }}>
            {day}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 9px', borderRadius: 99,
            background: m.bg, border: `1px solid ${m.border}`,
            fontSize: 11, fontWeight: 600, color: m.color,
          }}>
            {m.icon}{m.label}
          </span>
        </div>

        <div style={{
          background: T.bgS, border: `1px solid ${T.bdr}`, borderRadius: 12,
          padding: '16px 20px', marginBottom: 4,
          transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.bdrB; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.bdr; }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: T.t1, lineHeight: 1.4 }}>
            {entry.title}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: T.t2, lineHeight: 1.7 }}>
            {entry.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Nav link helper ──────────────────────────────────────────────────────────

function NavLink({ to, children, active = false }: { to: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link to={to} style={{
      fontSize: 13, fontWeight: 600, textDecoration: 'none',
      color: active ? T.t1 : T.t2,
      paddingBottom: active ? 2 : 0,
      borderBottom: active ? `2px solid ${T.teal}` : 'none',
    }}>
      {children}
    </Link>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', marginTop: 80 }}>
      <Sparkles size={40} color={T.t3} style={{ marginBottom: 14 }} />
      <p style={{ color: T.t2, fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
        Nothing yet
      </p>
      <p style={{ color: T.t3, fontSize: 13 }}>
        The first changelog entry is just around the corner.
      </p>
    </div>
  );
}
