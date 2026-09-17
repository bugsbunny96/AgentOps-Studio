/**
 * SuperAdminLayout
 * Standalone dark layout with red accent for the super admin portal.
 * Completely separate from DashboardLayout — no org context.
 */
import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, ScrollText, LogOut, ShieldCheck, FileText, Tag, CreditCard, BarChart2, Flag, Layers, AlertOctagon, HeartPulse, Megaphone, BookOpen, Send, Heart, Mic, DollarSign, TrendingDown, Gift, Link2, FlaskConical, Menu, X } from 'lucide-react';
import api from '@/utils/api';

const SA_MOBILE_CSS = `
@media (max-width: 767px) {
  #sa-sidebar {
    position: fixed !important;
    top: 0; left: 0; bottom: 0;
    z-index: 200;
    width: 240px !important;
    transform: translateX(-240px);
    transition: transform 0.27s cubic-bezier(0.4, 0, 0.2, 1);
  }
  #sa-sidebar.sidebar-open {
    transform: translateX(0);
    box-shadow: 8px 0 40px rgba(0,0,0,0.65);
  }
  .sa-mobile-bar { display: flex !important; }
}
@media (min-width: 768px) {
  .sa-mobile-bar { display: none !important; }
}
`;

const T = {
  bg:    '#07070f',
  bgS:   '#0e0e1a',
  bgC:   'rgba(255,255,255,0.04)',
  bdr:   'rgba(255,255,255,0.07)',
  bdrB:  'rgba(255,255,255,0.12)',
  red:   '#ef4444',
  redL:  '#fca5a5',
  t1:    '#f8fafc',
  t2:    '#94a3b8',
  t3:    '#475569',
};

type NavDivider = { divider: string };
type NavItem = { to: string; label: string; icon: React.ElementType; exact?: boolean };
type NavEntry = NavItem | NavDivider;

const NAV: NavEntry[] = [
  // ── Core ────────────────────────────────────────
  { to: '/superadmin',            label: 'Dashboard',   icon: LayoutDashboard, exact: true },
  { to: '/superadmin/orgs',       label: 'Orgs',        icon: Building2 },
  { to: '/superadmin/users',      label: 'Users',       icon: Users },
  // ── Revenue ──────────────────────────────────────
  { divider: 'Revenue' },
  { to: '/superadmin/billing',    label: 'Billing',     icon: CreditCard },
  { to: '/superadmin/analytics',  label: 'Analytics',   icon: BarChart2 },
  // ── Content ──────────────────────────────────────
  { divider: 'Content' },
  { to: '/superadmin/blog',       label: 'Blog',        icon: FileText },
  { to: '/superadmin/promo',      label: 'Promo Codes', icon: Tag },
  // ── Ops Tools ────────────────────────────────────
  { divider: 'Ops' },
  { to: '/superadmin/flags',      label: 'Feature Flags', icon: Flag },
  { to: '/superadmin/jobs',       label: 'Job Inspector', icon: Layers },
  { to: '/superadmin/health',     label: 'Health',        icon: HeartPulse },
  { to: '/superadmin/error-logs', label: 'Error Logs',    icon: AlertOctagon },
  // ── Communications ───────────────────────────────
  { divider: 'Comms' },
  { to: '/superadmin/announcements', label: 'Announcements',  icon: Megaphone },
  { to: '/superadmin/changelog',     label: 'Changelog',      icon: BookOpen  },
  { to: '/superadmin/broadcast',     label: 'Broadcast Email',icon: Send      },
  // ── Insights (Phase 19) ──────────────────────────
  { divider: 'Insights' },
  { to: '/superadmin/org-health',         label: 'Org Health',       icon: Heart        },
  { to: '/superadmin/voice-quality',      label: 'Voice Quality',    icon: Mic          },
  { to: '/superadmin/vapi-reconciliation',label: 'Vapi Billing',     icon: DollarSign   },
  { to: '/superadmin/churn-risk',         label: 'Churn Risk',       icon: TrendingDown },
  { to: '/superadmin/referrals',          label: 'Referrals',        icon: Gift         },
  { to: '/superadmin/enterprise-links',   label: 'Ent. Links',       icon: Link2        },
  { to: '/superadmin/ab-tests',           label: 'A/B Tests',        icon: FlaskConical },
  // ── Admin ─────────────────────────────────────────
  { divider: 'Admin' },
  { to: '/superadmin/audit',      label: 'Audit Log',   icon: ScrollText },
];

export function SuperAdminLayout() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // ESC key closes sidebar
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  // Scroll-lock while drawer is open
  useEffect(() => {
    if (sidebarOpen) document.body.style.overflow = 'hidden';
    else             document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Inject mobile CSS
  useEffect(() => {
    const id = 'sa-mobile-css';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = SA_MOBILE_CSS;
      document.head.appendChild(el);
    }
    return () => { document.getElementById('sa-mobile-css')?.remove(); };
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/superadmin/auth/logout');
    } finally {
      navigate('/superadmin/login', { replace: true });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg, overflow: 'hidden' }}>

      {/* ── Mobile top bar — hidden on desktop via .sa-mobile-bar CSS ─────── */}
      <div
        className="sa-mobile-bar"
        style={{
          display: 'none', /* CSS overrides to flex on mobile */
          alignItems: 'center', gap: 12,
          height: 52, flexShrink: 0,
          padding: '0 16px',
          borderBottom: `1px solid ${T.bdr}`,
          background: T.bgS,
          zIndex: 100,
        }}
      >
        <button
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
          aria-controls="sa-sidebar"
          onClick={() => setSidebarOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 8,
            background: 'transparent',
            border: `1px solid ${T.bdr}`,
            cursor: 'pointer', color: T.t2, flexShrink: 0,
          }}
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>Super Admin</span>
        </div>
      </div>

      {/* ── Backdrop — tap outside to close sidebar on mobile ─────────────── */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 199,
            background: 'rgba(0,0,0,0.55)',
            cursor: 'pointer',
          }}
        />
      )}

      {/* ── Body (sidebar + main) ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Sidebar */}
      <aside
        id="sa-sidebar"
        className={sidebarOpen ? 'sidebar-open' : ''}
        style={{
          display: 'flex', flexDirection: 'column',
          width: 220, flexShrink: 0,
          background: T.bgS,
          borderRight: `1px solid ${T.bdr}`,
        }}
      >
        {/* Brand */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          height: 60, padding: '0 18px',
          borderBottom: `1px solid ${T.bdr}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          }}>
            <ShieldCheck size={16} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: T.t1, margin: 0 }}>Super Admin</p>
            <p style={{ fontSize: 9, color: T.red, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>AgentOps Studio</p>
          </div>
        </div>

        {/* Warning badge */}
        <div style={{
          margin: '10px 10px 4px',
          padding: '6px 10px',
          borderRadius: 8,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <p style={{ fontSize: 10, color: T.red, fontWeight: 600, margin: 0, letterSpacing: '0.03em' }}>
            ⚠ Internal use only — all actions are audited
          </p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map((entry, idx) => {
            if ('divider' in entry) {
              return (
                <div key={`div-${idx}`} style={{
                  padding: '10px 12px 4px',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: T.t3,
                }}>
                  {entry.divider}
                </div>
              );
            }
            const { to, label, icon: Icon, exact } = entry;
            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                onClick={() => setSidebarOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8,
                  fontSize: 13, fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  ...(isActive ? {
                    background: 'rgba(239,68,68,0.12)',
                    color: T.redL,
                    border: '1px solid rgba(239,68,68,0.2)',
                  } : {
                    color: T.t2,
                    border: '1px solid transparent',
                    background: 'transparent',
                  }),
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={14} style={{ color: isActive ? T.red : T.t3, flexShrink: 0 }} />
                    {label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.bdr}`, padding: 10 }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid transparent', background: 'transparent',
              color: T.t3, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
              e.currentTarget.style.color = T.redL;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = T.t3;
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>
          <Outlet />
        </div>
      </main>

      </div>{/* /body flex row */}
    </div>
  );
}
