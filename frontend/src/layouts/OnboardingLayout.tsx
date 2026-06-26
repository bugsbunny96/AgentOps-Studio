import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const STEPS = [
  { path: '/onboarding/connect', label: 'Connect', step: 1 },
  { path: '/onboarding/learn', label: 'Learn', step: 2 },
  { path: '/onboarding/configure', label: 'Configure', step: 3 },
  { path: '/onboarding/customize', label: 'Customize', step: 4 },
  { path: '/onboarding/activate', label: 'Activate', step: 5 },
];

export function OnboardingLayout() {
  const { pathname } = useLocation();
  const { logout } = useAuth();

  const activeStep = STEPS.find((s) => s.path === pathname)?.step ?? 1;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </div>
          <span className="font-semibold text-slate-900">AgentOps Studio</span>
        </div>

        <button
          onClick={logout}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Sign out
        </button>
      </header>

      {/* Step progress bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => {
              const done = s.step < activeStep;
              const active = s.step === activeStep;
              return (
                <div key={s.path} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={[
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                        done ? 'bg-brand-600 text-white' : '',
                        active ? 'bg-brand-600 text-white ring-4 ring-brand-100' : '',
                        !done && !active ? 'bg-slate-200 text-slate-500' : '',
                      ].join(' ')}
                    >
                      {done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        s.step
                      )}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-brand-600' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`mx-2 h-0.5 flex-1 ${done ? 'bg-brand-600' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page content */}
      <main className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
