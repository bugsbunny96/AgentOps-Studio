/**
 * DashboardLayout — primary app shell after onboarding.
 * Redesigned with dark futuristic sidebar matching the landing page palette.
 */

import { useEffect, useState, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { useAppSelector } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Bot,
  PhoneCall,
  Package,
  Boxes,
  BarChart3,
  BookOpen,
  Users,
  Settings,
  CreditCard,
  LogOut,
  Zap,
  X,
  Menu,
  AlertTriangle,
  Info,
} from 'lucide-react';
import agentopsIcon from '@/assets/logos/agentops-icon.svg';
import type { MemberPermissions } from '@/types';

// ── Dark-layout global text remapping ─────────────────────────────────────────
// Pages that pre-date the dark theme use Tailwind's light-theme utilities
// (text-slate-900, text-gray-800, etc.) which are near-invisible on #030712.
// We inject a single <style> block that:
//   1. Remaps dark slate/gray text → light equivalents on dark bg.
//   2. Restores original dark colours inside explicitly white card containers
//      (higher CSS specificity wins: #dl-main .bg-white .text-* > #dl-main .text-*).
const DARK_LAYOUT_CSS = `
#dl-main { color: #e2e8f0; }

/* Dark text → light when floating on dark background */
#dl-main .text-slate-900 { color: #f1f5f9; }
#dl-main .text-slate-800 { color: #e2e8f0; }
#dl-main .text-slate-700 { color: #cbd5e1; }
#dl-main .text-slate-600 { color: #94a3b8; }
#dl-main .text-gray-900  { color: #f1f5f9; }
#dl-main .text-gray-800  { color: #e2e8f0; }
#dl-main .text-gray-700  { color: #cbd5e1; }
#dl-main .text-gray-600  { color: #94a3b8; }

/* Restore original dark text inside white card containers (specificity 1,2,0 > 1,1,0) */
#dl-main .bg-white .text-slate-900,
#dl-main .bg-white .text-gray-900  { color: #0f172a; }
#dl-main .bg-white .text-slate-800,
#dl-main .bg-white .text-gray-800  { color: #1e293b; }
#dl-main .bg-white .text-slate-700,
#dl-main .bg-white .text-gray-700  { color: #334155; }
#dl-main .bg-white .text-slate-600,
#dl-main .bg-white .text-gray-600  { color: #475569; }
#dl-main .bg-white .text-slate-500 { color: #64748b; }

/* Fix select/input elements inside forms on dark bg */
#dl-main select,
#dl-main input:not([type=checkbox]):not([type=radio]) {
  color-scheme: dark;
}
#dl-main .bg-white select,
#dl-main .bg-white input:not([type=checkbox]):not([type=radio]) {
  color-scheme: light;
}

/* ── Mobile sidebar drawer ──────────────────────────────────────────────── */
@media (max-width: 767px) {
  /* On mobile the sidebar becomes a fixed overlay panel */
  #dl-sidebar {
    position: fixed !important;
    top: 0; left: 0; bottom: 0;
    z-index: 200;
    width: 260px !important;
    transform: translateX(-260px);
    transition: transform 0.27s cubic-bezier(0.4, 0, 0.2, 1);
  }
  /* Open state: slide into view */
  #dl-sidebar.sidebar-open {
    transform: translateX(0);
    box-shadow: 8px 0 40px rgba(0, 0, 0, 0.6);
  }
  /* Show hamburger button on mobile */
  .dl-hamburger {
    display: flex !important;
  }
  /* Shrink header padding on mobile so title fits */
  #dl-header {
    padding: 0 16px !important;
  }
}
/* On desktop, always hide the hamburger */
@media (min-width: 768px) {
  .dl-hamburger { display: none !important; }
}
`;

// ── Design tokens (mirrors landing page) ──────────────────────────────────────
const T = {
  bg:    '#030712',
  bgS:   '#0d1524',
  bgC:   'rgba(255,255,255,0.04)',
  bdr:   'rgba(255,255,255,0.07)',
  bdrB:  'rgba(255,255,255,0.12)',
  blue:  '#3b82f6',
  blueL: '#60a5fa',
  violet:'#8b5cf6',
  em:    '#10b981',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

// ── Nav items ──────────────────────────────────────────────────────────────────
const NAV = [
  { to: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/agents',         label: 'Agents',         icon: Bot             },
  { to: '/calls',          label: 'Calls',          icon: PhoneCall       },
  { to: '/analytics',      label: 'Analytics',      icon: BarChart3       },
  { to: '/orders',         label: 'Orders',         icon: Package         },
  { to: '/catalog',        label: 'Catalog',        icon: Boxes           },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen        },
  { to: '/team',           label: 'Team',           icon: Users,       permission: 'team' as keyof MemberPermissions },
  { to: '/billing',        label: 'Billing',        icon: CreditCard,  ownerOnly: true },
  { to: '/settings',       label: 'Settings',       icon: Settings,    ownerOnly: true },
] as const;

function canSeeNav(
  item: typeof NAV[number],
  isOwner: boolean,
  permissions: MemberPermissions | null,
): boolean {
  if (isOwner) return true;
  if ('ownerOnly' in item && item.ownerOnly) return false;
  if ('permission' in item && item.permission) {
    return permissions?.[item.permission] ?? false;
  }
  return true;
}

function usePageTitle() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/agents/') && pathname !== '/agents/new') return 'Agent Details';
  if (pathname === '/agents/new')       return 'New Agent';
  if (pathname === '/agents')           return 'Agents';
  if (pathname === '/dashboard')        return 'Dashboard';
  if (pathname.startsWith('/calls/'))   return 'Call Details';
  if (pathname === '/calls')            return 'Calls';
  if (pathname === '/orders')           return 'Orders';
  if (pathname === '/catalog')          return 'Catalog';
  if (pathname === '/analytics')        return 'Analytics';
  if (pathname === '/knowledge-base')   return 'Knowledge Base';
  if (pathname === '/team')             return 'Team';
  if (pathname === '/billing')          return 'Billing';
  if (pathname === '/settings')         return 'Settings';
  return 'AgentOps Studio';
}

/** Read a cookie value by name from document.cookie (non-HttpOnly only). */
function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Announcement Banner ────────────────────────────────────────────────────────

const LS_KEY = 'dismissed_announcements';

function getDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as string[]; }
  catch { return []; }
}

function dismiss(id: string) {
  const curr = getDismissed();
  if (!curr.includes(id)) {
    localStorage.setItem(LS_KEY, JSON.stringify([...curr, id]));
  }
}

type AnnouncementType = 'info' | 'warning' | 'critical';

interface Announcement {
  _id:         string;
  title:       string;
  message:     string;
  type:        AnnouncementType;
  dismissible: boolean;
  isActive:    boolean;
  expiresAt:   string | null;
}

const BANNER_STYLE: Record<AnnouncementType, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  info:     { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  color: '#93c5fd', icon: <Info size={14} /> },
  warning:  { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  color: '#fde68a', icon: <AlertTriangle size={14} /> },
  critical: { bg: 'rgba(239,68,68,0.18)',   border: 'rgba(239,68,68,0.4)',   color: '#fca5a5', icon: <AlertTriangle size={14} /> },
};

function AnnouncementBanners() {
  const [dismissed, setDismissed] = useState<string[]>(getDismissed);

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data } = await api.get('/announcements');
      return data.data ?? [];
    },
    staleTime: 5 * 60_000, // re-fetch every 5 min
  });

  const visible = announcements
    .filter(a => !dismissed.includes(a._id))
    // sort: critical → warning → info
    .sort((a, b) => {
      const order: Record<AnnouncementType, number> = { critical: 0, warning: 1, info: 2 };
      return order[a.type] - order[b.type];
    });

  if (visible.length === 0) return null;

  const handleDismiss = (id: string) => {
    dismiss(id);
    setDismissed(getDismissed());
  };

  return (
    <>
      {visible.map(a => {
        const s = BANNER_STYLE[a.type];
        return (
          <div key={a._id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 20px', flexShrink: 0,
            background: s.bg, borderBottom: `1px solid ${s.border}`,
            zIndex: 99,
          }}>
            <span style={{ color: s.color, flexShrink: 0 }}>{s.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: s.color, flexShrink: 0 }}>
              {a.title}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1, minWidth: 0 }}>
              {a.message}
            </span>
            {a.dismissible && (
              <button
                onClick={() => handleDismiss(a._id)}
                style={{
                  flexShrink: 0, background: 'none', border: 'none',
                  cursor: 'pointer', color: s.color, opacity: 0.6, padding: 2,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { currentOrg, currentRole, currentPermissions } = useAppSelector((s) => s.org);
  const pageTitle  = usePageTitle();
  const isOwner    = currentRole === 'Owner';
  const visibleNav = NAV.filter((item) => canSeeNav(item, isOwner, currentPermissions));

  // ── Impersonation banner ──────────────────────────────────────────────────
  const [impersonating, setImpersonating] = useState<{ orgName: string } | null>(null);

  useEffect(() => {
    const raw = readCookie('sas-imp');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setImpersonating({ orgName: parsed.orgName ?? 'Unknown Org' });
      } catch {
        setImpersonating(null);
      }
    } else {
      setImpersonating(null);
    }
  }, []);

  const exitImpersonation = useCallback(async () => {
    try {
      await api.post('/superadmin/exit-impersonation');
    } finally {
      window.location.href = '/superadmin';
    }
  }, []);

  // Inject dark-layout CSS overrides once on mount
  useEffect(() => {
    const id = 'dl-dark-overrides';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = DARK_LAYOUT_CSS;
      document.head.appendChild(el);
    }
    return () => {
      // Remove on unmount (e.g. logout → auth pages shouldn't inherit these rules)
      document.getElementById('dl-dark-overrides')?.remove();
    };
  }, []);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U';

  const isAgentLive = Boolean(currentOrg?.vapiAssistantId);

  // ── Mobile sidebar ────────────────────────────────────────────────────────
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close when the user navigates to another route
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // ESC key closes the sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Prevent body scroll while sidebar overlay is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg, overflow: 'hidden' }}>

      {/* ── Super Admin Impersonation Banner ──────────────────────────────── */}
      {impersonating && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 20px', flexShrink: 0,
          background: 'linear-gradient(90deg, rgba(185,28,28,0.95), rgba(239,68,68,0.95))',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          zIndex: 100,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
            🛡 SUPER ADMIN — Impersonating: {impersonating.orgName} — all actions are attributed to you, not the org owner
          </span>
          <button
            onClick={exitImpersonation}
            style={{
              padding: '4px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          >
            Exit impersonation →
          </button>
        </div>
      )}

      {/* ── Announcement Banners ──────────────────────────────────────────── */}
      <AnnouncementBanners />

      {/* ── Mobile backdrop — tap outside to close sidebar ───────────────── */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.5)',
            cursor: 'pointer',
            // Only meaningful on mobile; sidebar's z-index 200 sits on top
          }}
        />
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {/* On mobile: position:fixed overlay driven by .sidebar-open CSS class  */}
      {/* On desktop: normal in-flow 240 px column, class has no effect         */}
      <aside
        id="dl-sidebar"
        className={sidebarOpen ? 'sidebar-open' : ''}
        style={{
          display: 'flex', flexDirection: 'column',
          width: 240, flexShrink: 0,
          background: T.bgS,
          borderRight: `1px solid ${T.bdr}`,
        }}
      >

        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          height: 64, padding: '0 20px',
          borderBottom: `1px solid ${T.bdr}`,
        }}>
          <img src={agentopsIcon} alt="AgentOps" style={{ height: 36, width: 36, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: T.t1, letterSpacing: '-0.02em', margin: 0 }}>AgentOps</p>
            <p style={{ fontSize: 9, color: T.t3, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Studio</p>
          </div>
        </div>

        {/* Workspace pill */}
        <div style={{
          margin: '12px 12px 4px',
          borderRadius: 10,
          background: T.bgC,
          border: `1px solid ${T.bdr}`,
          padding: '8px 12px',
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, margin: '0 0 2px' }}>Workspace</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.t1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentOrg?.name ?? 'Loading…'}
          </p>
          <p style={{ fontSize: 10, color: T.t3, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentOrg?.slug}
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 9,
                fontSize: 13, fontWeight: 500,
                textDecoration: 'none',
                transition: 'all 0.15s',
                ...(isActive
                  ? {
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
                      color: T.blueL,
                      border: '1px solid rgba(59,130,246,0.25)',
                      boxShadow: '0 0 12px rgba(59,130,246,0.1)',
                    }
                  : {
                      color: T.t2,
                      border: '1px solid transparent',
                      background: 'transparent',
                    }),
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={15}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    style={{ color: isActive ? T.blueL : T.t3, flexShrink: 0 }}
                  />
                  {label}
                  {isActive && (
                    <span style={{
                      marginLeft: 'auto',
                      width: 5, height: 5, borderRadius: '50%',
                      background: T.blue,
                      boxShadow: `0 0 6px ${T.blue}`,
                    }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ borderTop: `1px solid ${T.bdr}`, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 9 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              fontSize: 11, fontWeight: 800, color: '#fff',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.t1, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name}
                </p>
                {currentRole && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: '1px 5px', borderRadius: 999,
                    background: T.bgC, border: `1px solid ${T.bdr}`, color: T.t3, flexShrink: 0,
                  }}>
                    {currentRole}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 10, color: T.t3, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
                background: 'transparent', color: T.t3, transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.t3; }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Top header */}
        <header
          id="dl-header"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 56, flexShrink: 0,
            padding: '0 32px',
            borderBottom: `1px solid ${T.bdr}`,
            background: 'rgba(13,21,36,0.8)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Hamburger — hidden on desktop via .dl-hamburger CSS, visible on mobile */}
            <button
              className="dl-hamburger"
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={sidebarOpen}
              aria-controls="dl-sidebar"
              onClick={() => setSidebarOpen(v => !v)}
              style={{
                display: 'none', /* CSS overrides to flex on mobile */
                alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8,
                background: 'transparent',
                border: `1px solid ${T.bdr}`,
                cursor: 'pointer',
                color: T.t2,
                flexShrink: 0,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.bgC; e.currentTarget.style.borderColor = T.bdrB; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = T.bdr; }}
            >
              {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: T.t1, margin: 0 }}>{pageTitle}</h2>
            {currentOrg?.industry && (
              <>
                <span style={{ color: T.bdr }}>·</span>
                <span style={{ fontSize: 11, color: T.t3 }}>{currentOrg.industry}</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isAgentLive ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 999,
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981' }}>Agent Live</span>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 999,
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>Setup Needed</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={10} style={{ color: T.blue }} />
              <span style={{ fontSize: 10, color: T.t3 }}>AgentOps Studio</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="dl-main" style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
          <div style={{ maxWidth: 1140, margin: '0 auto', padding: '32px' }}>
            <Outlet />
          </div>
        </main>
      </div>

      </div>{/* /inner flex row */}
    </div>
  );
}
