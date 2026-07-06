/**
 * DashboardLayout — primary app shell after onboarding.
 *
 * Changes vs original:
 *  - Top header: shows current page title (derived from pathname) + dynamic badge
 *  - "Agent Live" badge is CONDITIONAL on vapiAssistantId being set
 *  - Sidebar: unchanged (gradient active state, Zap logo, org pill)
 */

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Bot,
  PhoneCall,
  BookOpen,
  Users,
  Settings,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import agentopsIcon from '@/assets/logos/agentops-icon.svg';

// ── Nav items ──────────────────────────────────────────────────────────────────
const NAV = [
  { to: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/agents',         label: 'Agents',         icon: Bot },
  { to: '/calls',          label: 'Calls',          icon: PhoneCall },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { to: '/team',           label: 'Team',           icon: Users },
  { to: '/settings',       label: 'Settings',       icon: Settings },
];

// ── Derive page title from pathname ───────────────────────────────────────────
function usePageTitle() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/agents/') && pathname !== '/agents/new') return 'Agent Details';
  if (pathname === '/agents/new')       return 'New Agent';
  if (pathname === '/agents')           return 'Agents';
  if (pathname === '/dashboard')        return 'Dashboard';
  if (pathname.startsWith('/calls/'))   return 'Call Details';
  if (pathname === '/calls')            return 'Calls';
  if (pathname === '/knowledge-base')   return 'Knowledge Base';
  if (pathname === '/team')             return 'Team';
  if (pathname === '/settings')         return 'Settings';
  return 'AgentOps Studio';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { currentOrg } = useAppSelector((s) => s.org);
  const pageTitle = usePageTitle();

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U';

  const isAgentLive = Boolean(currentOrg?.vapiAssistantId);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-100">
          <img src={agentopsIcon} alt="AgentOps" className="h-9 w-9 flex-shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 tracking-tight">AgentOps</p>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Studio</p>
          </div>
        </div>

        {/* Org pill */}
        <div className="mx-3 mt-3 mb-1 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Workspace</p>
          <p className="text-sm font-semibold text-slate-800 truncate">
            {currentOrg?.name ?? 'Loading…'}
          </p>
          <p className="text-[10px] text-slate-400 truncate">{currentOrg?.slug}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-gradient-to-r from-brand-50 to-violet-50 text-brand-700 shadow-sm border border-brand-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className={isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}
                  />
                  {label}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full
              bg-gradient-to-br from-brand-500 to-violet-500 text-white text-xs font-bold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="flex-shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50
                hover:text-red-500 transition-colors"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Top header bar */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between
          border-b border-slate-200 bg-white/80 backdrop-blur-sm px-8">

          {/* Page title */}
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-slate-800">{pageTitle}</h2>
            {currentOrg?.industry && (
              <>
                <span className="text-slate-200">·</span>
                <span className="text-xs text-slate-400">{currentOrg.industry}</span>
              </>
            )}
          </div>

          {/* Status badge — conditional */}
          <div className="flex items-center gap-3">
            {isAgentLive ? (
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-200
                bg-emerald-50 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-700">Agent Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-200
                bg-amber-50 px-3 py-1">
                <AlertCircle size={11} className="text-amber-500" />
                <span className="text-xs font-medium text-amber-700">Setup Needed</span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
