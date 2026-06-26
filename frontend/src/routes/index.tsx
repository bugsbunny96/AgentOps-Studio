import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthGuard } from './guards/AuthGuard';
import { OrgGuard } from './guards/OrgGuard';
import { GuestGuard } from './guards/GuestGuard';

// Layouts
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { OnboardingLayout } from '@/layouts/OnboardingLayout';

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

// Auth pages
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const AcceptInvitePage = lazy(() => import('@/features/auth/AcceptInvitePage'));

// Onboarding pages
const OnboardingConnectPage = lazy(() => import('@/features/onboarding/ConnectPage'));
const OnboardingLearnPage = lazy(() => import('@/features/onboarding/LearnPage'));
const OnboardingConfigurePage = lazy(() => import('@/features/onboarding/ConfigurePage'));
const OnboardingCustomizePage = lazy(() => import('@/features/onboarding/CustomizePage'));
const OnboardingActivatePage = lazy(() => import('@/features/onboarding/ActivatePage'));

// Dashboard pages
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const AgentsPage = lazy(() => import('@/features/agents/AgentsPage'));
const AgentNewPage = lazy(() => import('@/features/agents/AgentNewPage'));
const AgentDetailPage = lazy(() => import('@/features/agents/AgentDetailPage'));
const CallsPage = lazy(() => import('@/features/calls/CallsPage'));
const CallDetailPage = lazy(() => import('@/features/calls/CallDetailPage'));
const KnowledgeBasePage = lazy(() => import('@/features/knowledge-base/KnowledgeBasePage'));
const TeamPage = lazy(() => import('@/features/team/TeamPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

export const router = createBrowserRouter([
  // ── Root redirect ──────────────────────────────────────────────────
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  // ── Public / Guest routes ──────────────────────────────────────────
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
