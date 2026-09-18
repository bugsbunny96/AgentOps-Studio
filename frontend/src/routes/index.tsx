import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteErrorPage } from '@/components/RouteErrorPage';
import { AuthGuard } from './guards/AuthGuard';
import { OrgGuard } from './guards/OrgGuard';
import { GuestGuard } from './guards/GuestGuard';

// Layouts
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnboardingLayout } from '@/layouts/OnboardingLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout';

// Super Admin guard (not lazy — tiny, always needed for SA routes)
import { SuperAdminGuard } from '@/features/superadmin/SuperAdminGuard';

// ── Lazy imports (code-split by route) ──────────────────────────────
import { lazy, Suspense } from 'react';

const PageLoader = () => (
  <div style={{ display: 'flex', height: '100%', minHeight: '240px', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      border: '3px solid rgba(59,130,246,0.2)',
      borderTopColor: '#3b82f6',
      animation: 'spin 0.7s linear infinite',
    }} />
  </div>
);

const lazy_page = (factory: () => Promise<{ default: React.ComponentType }>) => {
  const Component = lazy(factory);
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
};

// (All page components are lazy-loaded inline via lazy_page() at route definition time)

export const router = createBrowserRouter([
  // ── Public marketing site (no auth required) ───────────────────────
  // PublicLayout renders sticky nav + footer; pages render via <Outlet />
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: lazy_page(() => import('@/features/public/HomePage')) },
      { path: '/services', element: lazy_page(() => import('@/features/public/ServicesPage')) },
      { path: '/industries', element: lazy_page(() => import('@/features/public/IndustriesPage')) },
      { path: '/why-us', element: lazy_page(() => import('@/features/public/WhyUsPage')) },
      { path: '/pricing', element: lazy_page(() => import('@/features/public/PricingPage')) },
      { path: '/blog', element: lazy_page(() => import('@/features/public/BlogPage')) },
      { path: '/changelog', element: lazy_page(() => import('@/features/public/ChangelogPage')) },
      { path: '/contact', element: lazy_page(() => import('@/features/public/ContactPage')) },
      { path: '/terms', element: lazy_page(() => import('@/features/public/TermsPage')) },
      { path: '/privacy', element: lazy_page(() => import('@/features/public/PrivacyPolicyPage')) },
    ],
  },

  // ── Auth / Guest routes ────────────────────────────────────────────
  {
    element: <GuestGuard><AuthLayout /></GuestGuard>,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/login', element: lazy_page(() => import('@/features/auth/LoginPage')) },
      { path: '/register', element: lazy_page(() => import('@/features/auth/RegisterPage')) },
      { path: '/forgot-password', element: lazy_page(() => import('@/features/auth/ForgotPasswordPage')) },
    ],
  },
  // /reset-password is intentionally outside GuestGuard — a logged-in user
  // clicking the email link must not be redirected away before resetting.
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/reset-password', element: lazy_page(() => import('@/features/auth/ResetPasswordPage')) },
    ],
  },
  {
    path: '/verify-email',
    element: lazy_page(() => import('@/features/auth/VerifyEmailPage')),
  },
  {
    path: '/accept-invite/:token',
    element: lazy_page(() => import('@/features/auth/AcceptInvitePage')),
  },

  // ── Onboarding (auth required, org not required) ───────────────────
  {
    element: <AuthGuard><OnboardingLayout /></AuthGuard>,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/onboarding', element: <Navigate to="/onboarding/connect" replace /> },
      { path: '/onboarding/connect', element: lazy_page(() => import('@/features/onboarding/ConnectPage')) },
      { path: '/onboarding/learn', element: lazy_page(() => import('@/features/onboarding/LearnPage')) },
      { path: '/onboarding/crawling', element: lazy_page(() => import('@/features/onboarding/CrawlLoadingPage')) },
      { path: '/onboarding/configure', element: lazy_page(() => import('@/features/onboarding/ConfigurePage')) },
      { path: '/onboarding/customize', element: lazy_page(() => import('@/features/onboarding/CustomizePage')) },
      { path: '/onboarding/activate', element: lazy_page(() => import('@/features/onboarding/ActivatePage')) },
    ],
  },

  // ── Organization-scoped dashboard (auth + completed onboarding) ────
  {
    element: <AuthGuard><OrgGuard><DashboardLayout /></OrgGuard></AuthGuard>,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/dashboard', element: lazy_page(() => import('@/features/dashboard/DashboardPage')) },
      { path: '/agents', element: lazy_page(() => import('@/features/agents/AgentsPage')) },
      { path: '/agents/new', element: lazy_page(() => import('@/features/agents/AgentNewPage')) },
      { path: '/agents/:id', element: lazy_page(() => import('@/features/agents/AgentDetailPage')) },
      { path: '/calls', element: lazy_page(() => import('@/features/calls/CallsPage')) },
      { path: '/calls/:id', element: lazy_page(() => import('@/features/calls/CallDetailPage')) },
      { path: '/orders', element: lazy_page(() => import('@/features/orders/OrdersPage')) },
      { path: '/catalog', element: lazy_page(() => import('@/features/catalog/CatalogPage')) },
      { path: '/analytics', element: lazy_page(() => import('@/features/analytics/AnalyticsPage')) },
      { path: '/knowledge-base', element: lazy_page(() => import('@/features/knowledge-base/KnowledgeBasePage')) },
      { path: '/team', element: lazy_page(() => import('@/features/team/TeamPage')) },
      { path: '/settings', element: lazy_page(() => import('@/features/settings/SettingsPage')) },
      { path: '/billing', element: lazy_page(() => import('@/features/billing/BillingPage')) },
    ],
  },

  // ── Super Admin portal ─────────────────────────────────────────────
  // Login page — wrapped in AuthLayout so it looks identical to /login
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/superadmin/login', element: lazy_page(() => import('@/features/superadmin/SuperAdminLoginPage')) },
    ],
  },
  // Protected SA pages under SuperAdminLayout
  {
    element: (
      <SuperAdminGuard>
        <SuperAdminLayout />
      </SuperAdminGuard>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/superadmin',              element: lazy_page(() => import('@/features/superadmin/SuperAdminDashboardPage')) },
      { path: '/superadmin/orgs',         element: lazy_page(() => import('@/features/superadmin/orgs/SuperAdminOrgsPage')) },
      { path: '/superadmin/orgs/:id',     element: lazy_page(() => import('@/features/superadmin/orgs/SuperAdminOrgDetailPage')) },
      { path: '/superadmin/users',        element: lazy_page(() => import('@/features/superadmin/users/SuperAdminUsersPage')) },
      { path: '/superadmin/users/:id',    element: lazy_page(() => import('@/features/superadmin/users/SuperAdminUserDetailPage')) },
      { path: '/superadmin/audit',        element: lazy_page(() => import('@/features/superadmin/SuperAdminAuditPage')) },
      // Billing + Analytics
      { path: '/superadmin/billing',    element: lazy_page(() => import('@/features/superadmin/billing/SuperAdminBillingPage')) },
      { path: '/superadmin/analytics',  element: lazy_page(() => import('@/features/superadmin/analytics/SuperAdminAnalyticsPage')) },
      // Blog
      { path: '/superadmin/blog',          element: lazy_page(() => import('@/features/superadmin/blog/SuperAdminBlogListPage')) },
      { path: '/superadmin/blog/new',      element: lazy_page(() => import('@/features/superadmin/blog/SuperAdminBlogComposePage')) },
      { path: '/superadmin/blog/:id/edit', element: lazy_page(() => import('@/features/superadmin/blog/SuperAdminBlogComposePage')) },
      // Promo codes
      { path: '/superadmin/promo',          element: lazy_page(() => import('@/features/superadmin/promo/SuperAdminPromoListPage')) },
      { path: '/superadmin/promo/new',      element: lazy_page(() => import('@/features/superadmin/promo/SuperAdminPromoComposePage')) },
      { path: '/superadmin/promo/:id/edit', element: lazy_page(() => import('@/features/superadmin/promo/SuperAdminPromoComposePage')) },
      // Phase 4 — Ops Tools
      { path: '/superadmin/flags',       element: lazy_page(() => import('@/features/superadmin/ops/SuperAdminFeatureFlagsPage')) },
      { path: '/superadmin/jobs',        element: lazy_page(() => import('@/features/superadmin/ops/SuperAdminJobInspectorPage')) },
      { path: '/superadmin/health',      element: lazy_page(() => import('@/features/superadmin/ops/SuperAdminHealthPage')) },
      { path: '/superadmin/error-logs',  element: lazy_page(() => import('@/features/superadmin/ops/SuperAdminErrorLogPage')) },
      // Phase 5 — Communications
      { path: '/superadmin/announcements', element: lazy_page(() => import('@/features/superadmin/comms/SuperAdminAnnouncementsPage')) },
      { path: '/superadmin/changelog',     element: lazy_page(() => import('@/features/superadmin/comms/SuperAdminChangelogPage')) },
      { path: '/superadmin/broadcast',     element: lazy_page(() => import('@/features/superadmin/comms/SuperAdminBroadcastEmailPage')) },
      // Phase 19 — Insights + Ops
      { path: '/superadmin/org-health',          element: lazy_page(() => import('@/features/superadmin/insights/SuperAdminOrgHealthPage')) },
      { path: '/superadmin/voice-quality',       element: lazy_page(() => import('@/features/superadmin/insights/SuperAdminVoiceQualityPage')) },
      { path: '/superadmin/vapi-reconciliation', element: lazy_page(() => import('@/features/superadmin/insights/SuperAdminVapiReconciliationPage')) },
      { path: '/superadmin/churn-risk',          element: lazy_page(() => import('@/features/superadmin/insights/SuperAdminChurnRiskPage')) },
      { path: '/superadmin/referrals',           element: lazy_page(() => import('@/features/superadmin/insights/SuperAdminReferralPage')) },
      { path: '/superadmin/enterprise-links',    element: lazy_page(() => import('@/features/superadmin/insights/SuperAdminEnterpriseLinksPage')) },
      { path: '/superadmin/ab-tests',            element: lazy_page(() => import('@/features/superadmin/insights/SuperAdminABTestPage')) },
      { path: '/superadmin/orgs/:orgId/white-label', element: lazy_page(() => import('@/features/superadmin/insights/SuperAdminWhiteLabelPage')) },
    ],
  },

  // ── 404 ────────────────────────────────────────────────────────────
  {
    path: '*',
    element: lazy_page(() => import('@/features/public/NotFoundPage')),
  },
]);

export default router;
