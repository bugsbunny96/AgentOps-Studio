/**
 * OnboardingLayout — wraps all 5 onboarding steps.
 *
 * Step navigation rules (Session 5):
 *   - Completed steps (≤ completedSteps) are CLICKABLE — user can review saved data.
 *   - Active step (current URL) shows the ring indicator.
 *   - Future locked steps (> completedSteps) are NOT clickable — cursor-not-allowed.
 *   - On mount: calls fetchCurrentOrg() to hydrate Redux with full org data so form
 *     fields are pre-populated even after a page refresh.
 *
 * onboardingStatus → completedSteps mapping:
 *   ORG_CREATION  → 1  (Step 1 done)
 *   WEBSITE_CRAWL → 2  (Step 2 done)
 *   BUSINESS_CONFIG → 3
 *   VOICE_SETUP   → 4
 *   COMPLETED     → 5
 */

import { useEffect, Fragment } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { OnboardingStatus } from '@/types';
import agentopsIcon from '@/assets/logos/agentops-icon.svg';

const STEPS = [
  { path: '/onboarding/connect', label: 'Connect', step: 1 },
  { path: '/onboarding/learn', label: 'Learn', step: 2 },
  { path: '/onboarding/configure', label: 'Configure', step: 3 },
  { path: '/onboarding/customize', label: 'Customize', step: 4 },
  { path: '/onboarding/activate', label: 'Activate', step: 5 },
];

const STEP_PATHS = STEPS.map((s) => s.path);

/** Map the org's onboardingStatus to the number of completed steps. */
function statusToCompletedSteps(status: OnboardingStatus | string | undefined): number {
  switch (status) {
    case 'ORG_CREATION': return 1;
    case 'WEBSITE_CRAWL': return 2;
    case 'BUSINESS_CONFIG': return 3;
    case 'VOICE_SETUP': return 4;
    case 'COMPLETED': return 5;
    default: return 0;
  }
}

/** Return the path the user should be on given their progress. */
function statusToNextPath(status: OnboardingStatus | string | undefined): string {
  switch (status) {
    case 'ORG_CREATION': return '/onboarding/learn';
    case 'WEBSITE_CRAWL': return '/onboarding/configure';
    case 'BUSINESS_CONFIG': return '/onboarding/customize';
    case 'VOICE_SETUP': return '/onboarding/activate';
    case 'COMPLETED': return '/dashboard';
    default: return '/onboarding/connect';
  }
}

export function OnboardingLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout, currentOrg, fetchCurrentOrg } = useAuth();

  // Hydrate Redux with full org data on mount (covers page-refresh case where
  // auth/me only returns the lean org shape without configure/customize fields).
  useEffect(() => {
    fetchCurrentOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeStep = STEPS.find((s) => s.path === pathname)?.step ?? 1;
  const completedSteps = statusToCompletedSteps(currentOrg?.onboardingStatus);

  // Show personalised sub-header from Step 2 onwards (org exists by then)
  const showPersonalisedHeader = activeStep > 1 && !!currentOrg?.name;

  function handleStepClick(step: number) {
    // Allow: completed steps (≤ completedSteps) + the frontier step (completedSteps + 1).
    // Block: anything beyond the frontier — strictly future steps the user hasn't reached.
    if (step > completedSteps + 1) return;
    navigate(STEP_PATHS[step - 1]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div className="flex items-center gap-2.5">
          <img src={agentopsIcon} alt="AgentOps" className="h-8 w-8 rounded-lg" />
          <span className="font-semibold text-slate-900">AgentOps Studio</span>
        </div>

        <button
          onClick={logout}
          className="text-sm text-slate-500 hover:text-slate-700 transition"
        >
          Sign out
        </button>
      </header>

      {/* Step progress bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl">
          {/*
            KEY LAYOUT FIX:
            Labels are taken out of the flex row (absolutely positioned below each circle).
            This means the flex row contains ONLY circles (fixed 32×32px) + connectors.
            Connectors therefore span exactly from one circle's right-edge to the next
            circle's left-edge — zero gap on either side.

            Colour rules:
              done (completed, not currently viewing) → emerald/green
              active (current URL step)               → brand blue + ring
              locked (not yet reached)                → slate gray, non-interactive
            Connectors → green if the step to their LEFT is done, gray otherwise.
            Numbers shown everywhere — no checkmark icons.
          */}
          <div className="flex items-center pb-8">
            {STEPS.map((s, i) => {
              // active   — step the user is currently VIEWING (URL-based)
              // done     — completed step the user is NOT currently viewing
              // frontier — the step the user SHOULD be working on (completedSteps+1),
              //            even when they've navigated away to a previous step.
              //            Stays blue + clickable so they can always return.
              // locked   — steps strictly beyond the frontier
              const active   = s.step === activeStep;
              const done     = s.step <= completedSteps && !active;
              const frontier = s.step === completedSteps + 1 && !active;
              const locked   = s.step > completedSteps + 1;

              return (
                <Fragment key={s.path}>
                  {/* Circle — flex-shrink-0 so it never compresses.
                      Label is absolutely positioned so it doesn't widen this container. */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStepClick(s.step)}
                      disabled={locked}
                      title={
                        locked   ? 'Complete previous steps first' :
                        done     ? `Go back to ${s.label}` :
                        frontier ? `Return to ${s.label}` :
                        undefined
                      }
                      className={[
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all',
                        done     ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600 hover:ring-4 hover:ring-emerald-100' : '',
                        active   ? 'bg-brand-600 text-white ring-4 ring-brand-100 cursor-default' : '',
                        frontier ? 'bg-brand-600 text-white cursor-pointer hover:bg-brand-700 hover:ring-4 hover:ring-brand-100' : '',
                        locked   ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {s.step}
                    </button>

                    {/* Label — absolutely below circle, centered on circle midpoint.
                        top-9 = 36px (just below h-8=32px circle + 4px gap).
                        left-1/2 + -translate-x-1/2 centres on the circle, not the container. */}
                    <span
                      className={[
                        'absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium transition-colors',
                        active || frontier ? 'text-brand-600' :
                        done               ? 'text-emerald-600' :
                        'text-slate-400',
                      ].join(' ')}
                    >
                      {s.label}
                    </span>
                  </div>

                  {/* Connector — flex-1 fills exactly the space between circle edges.
                      Green when the step to the LEFT is completed; gray otherwise. */}
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 transition-colors ${s.step <= completedSteps ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>

          {/* Personalised sub-header — visible from Step 2 onwards */}
          {showPersonalisedHeader && (
            <p className="text-center text-s text-slate-500">
              Setting up your AI agent for{' '}
              <span className="font-semibold text-slate-700">{currentOrg.name}</span>
            </p>
          )}
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
