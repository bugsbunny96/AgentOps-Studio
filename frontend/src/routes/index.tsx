import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthGuard } from './guards/AuthGuard';
import { OrgGuard } from './guards/OrgGuard';
import { GuestGuard } from './guards/GuestGuard';

// Layouts
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnboardingLayout } from '@/layouts/OnboardingLayout';
import { PublicLayout } from '@/layouts/PublicLayout';

// ── Lazy imports (code-split by route) ──────────────────────────────
import { lazy, Suspense } from 'react';

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
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
    children: [
      { path: '/', element: lazy_page(() => import('@/features/public/HomePage')) },
      { path: '/services', element: lazy_page(() => import('@/features/public/ServicesPage')) },
      { path: '/industries', element: lazy_page(() => import('@/features/public/IndustriesPage')) },
      { path: '/why-us', element: lazy_page(() => import('@/features/public/WhyUsPage')) },
      { path: '/pricing', element: lazy_page(() => import('@/features/public/PricingPage')) },
      { path: '/blog', element: lazy_page(() => import('@/features/public/BlogPage')) },
      { path: '/contact', element: lazy_page(() => import('@/features/public/ContactPage')) },
    ],
  },

  // ── Auth / Guest routes ────────────────────────────────────────────
  {
    element: <GuestGuard><AuthLayout /></GuestGuard>,
    children: [
      { path: '/login', element: lazy_page(() => import('@/features/auth/LoginPage')) },
      { path: '/register', element: lazy_page(() => import('@/features/auth/RegisterPage')) },
      { path: '/forgot-password', element: lazy_page(() => import('@/features/auth/ForgotPasswordPage')) },
    ],
  },
  {
    path: '/accept-invite/:token',
    element: lazy_page(() => import('@/features/auth/AcceptInvitePage')),
  },

  // ── Onboarding (auth required, org not required) ───────────────────
  {
    element: <AuthGuard><OnboardingLayout /></AuthGuard>,
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
    children: [
      { path: '/dashboard', element: lazy_page(() => import('@/features/dashboard/DashboardPage')) },
      { path: '/agents', element: lazy_page(() => import('@/features/agents/AgentsPage')) },
      { path: '/agents/new', element: lazy_page(() => import('@/features/agents/AgentNewPage')) },
      { path: '/agents/:id', element: lazy_page(() => import('@/features/agents/AgentDetailPage')) },
      { path: '/calls', element: lazy_page(() => import('@/features/calls/CallsPage')) },
      { path: '/calls/:id', element: lazy_page(() => import('@/features/calls/CallDetailPage')) },
      { path: '/knowledge-base', element: lazy_page(() => import('@/features/knowledge-base/KnowledgeBasePage')) },
      { path: '/team', element: lazy_page(() => import('@/features/team/TeamPage')) },
      { path: '/settings', element: lazy_page(() => import('@/features/settings/SettingsPage')) },
    ],
  },

  // ── 404 ────────────────────────────────────────────────────────────
  {
    path: '*',
    element: (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-bold text-slate-900">404</h1>
        <p className="text-slate-500">Page not found</p>
        <a href="/dashboard" className="text-brand-600 hover:underline">Go to dashboard →</a>
      </div>
    ),
  },
]);

export default router;
