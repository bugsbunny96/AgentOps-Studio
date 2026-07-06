/**
 * CrawlLoadingPage — Onboarding Step 2b
 *
 * Shown after the user submits Path A (crawl my website) on LearnPage.
 * Polls GET /api/v1/onboarding/crawl-status every 2 seconds.
 *
 * States:
 *   pending / processing  → animated progress screen (this page)
 *   completed             → navigate to /onboarding/configure (with org pre-populated)
 *   failed                → error screen with Skip + Retry options
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  Search,
  Database,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ─── Progress step definitions ────────────────────────────────────────────────

interface ProgressStep {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  durationMs: number;   // approximate time before auto-advancing (visual only)
}

const STEPS: ProgressStep[] = [
  {
    icon: <Globe size={20} />,
    label: 'Connecting to your website',
    sublabel: 'Fetching your homepage…',
    durationMs: 3_000,
  },
  {
    icon: <Search size={20} />,
    label: 'Discovering pages',
    sublabel: 'Finding service pages, contact info, FAQs…',
    durationMs: 5_000,
  },
  {
    icon: <FileText size={20} />,
    label: 'Reading your content',
    sublabel: 'Scanning up to 15 pages across your site…',
    durationMs: 7_000,
  },
  {
    icon: <Sparkles size={20} />,
    label: 'Extracting knowledge',
    sublabel: 'AI is structuring your services, hours, and FAQs…',
    durationMs: 6_000,
  },
  {
    icon: <Database size={20} />,
    label: 'Building knowledge base',
    sublabel: 'Almost done — preparing your AI agent…',
    durationMs: 4_000,
  },
];

// ─── Animated pulsing bar ─────────────────────────────────────────────────────

function PulsingBar({ progress }: { progress: number }) {
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      {/* animated shimmer */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-brand-400 via-brand-600 to-violet-500 transition-all duration-700 ease-out"
        style={{ width: `${progress}%` }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
          animation: 'shimmer 1.5s infinite',
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  );
}

// ─── Animated orbit dots ──────────────────────────────────────────────────────

function OrbitLoader() {
  return (
    <div className="relative h-20 w-20 mx-auto">
      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg">
          <Zap size={18} />
        </div>
      </div>
      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            animation: `spin ${1.2 + i * 0.3}s linear infinite`,
            animationDelay: `${i * 0.15}s`,
          }}
        >
          <div
            className="absolute h-3 w-3 rounded-full shadow-sm"
            style={{
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              background: `hsl(${220 + i * 40}, 80%, 55%)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CrawlLoadingPage() {
  const navigate = useNavigate();
  const { currentOrg, getCrawlStatus } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(5);
  const [crawlFailed, setCrawlFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Step auto-advance (visual progress, independent of real crawl timing) ──
  useEffect(() => {
    let currentStepIndex = 0;

    function advanceStep() {
      if (!mountedRef.current) return;
      currentStepIndex++;
      if (currentStepIndex < STEPS.length) {
        setActiveStep(currentStepIndex);
        // Progress: 5% → 90% spread across steps
        setProgress(5 + Math.round((currentStepIndex / (STEPS.length - 1)) * 85));
        stepTimerRef.current = setTimeout(advanceStep, STEPS[currentStepIndex].durationMs);
      }
    }

    // Start from step 0
    setActiveStep(0);
    setProgress(5);
    stepTimerRef.current = setTimeout(advanceStep, STEPS[0].durationMs);

    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, []);

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // If org already shows completed (e.g., fast crawl before mount), go straight to configure
    if (currentOrg?.crawlStatus === 'completed') {
      navigate('/onboarding/configure', { replace: true });
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const { crawlStatus, crawlError } = await getCrawlStatus();

        if (crawlStatus === 'completed') {
          clearInterval(pollIntervalRef.current!);
          setProgress(100);
          setActiveStep(STEPS.length - 1);
          // Brief pause so user sees 100%
          setTimeout(() => {
            if (mountedRef.current) navigate('/onboarding/configure', { replace: true });
          }, 800);
        } else if (crawlStatus === 'failed') {
          clearInterval(pollIntervalRef.current!);
          setCrawlFailed(true);
          setErrorMessage(
            crawlError ?? 'We could not reach your website. Please check the URL and try again.',
          );
        }
        // 'pending' / 'processing' → keep polling
      } catch {
        // Network error during polling — keep polling silently
      }
    }, 2_000);

    return () => {
      mountedRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Retry handler ─────────────────────────────────────────────────────────
  async function handleRetry() {
    setIsRetrying(true);
    // Navigate back to LearnPage — user can re-submit the URL
    navigate('/onboarding/learn', { replace: true });
  }

  // ── Skip handler (go to configure with empty fields) ─────────────────────
  function handleSkip() {
    navigate('/onboarding/configure', { replace: true });
  }

  // ─── Keyframes injected once ──────────────────────────────────────────────
  useEffect(() => {
    const id = 'crawl-loading-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
      @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  // ─── Failed state ─────────────────────────────────────────────────────────
  if (crawlFailed) {
    return (
      <div className="space-y-6" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Couldn't scan your website</h1>
          <p className="mt-1 text-sm text-slate-500">
            No worries — you can fill in the details manually, or try again with the URL.
          </p>
        </div>

        {/* Error card */}
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
          <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Scan failed</p>
            <p className="mt-0.5 text-xs text-red-700 leading-relaxed">{errorMessage}</p>
          </div>
        </div>

        {/* What was tried */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 space-y-1.5">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            What we tried
          </p>
          <p className="text-xs text-slate-500">
            We attempted to reach{' '}
            <span className="font-medium text-slate-700 underline decoration-dotted">
              {currentOrg?.websiteUrl ?? 'your website'}
            </span>{' '}
            but couldn't load any pages. This can happen if the site requires login,
            uses bot protection, or the URL is incorrect.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-600
              px-4 py-2.5 text-sm font-semibold text-white shadow-sm
              hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500
              disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <RefreshCw size={15} className={isRetrying ? 'animate-spin' : ''} />
            Try a different URL
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full flex items-center justify-center gap-2 rounded-md border
              border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700
              hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500
              transition"
          >
            Skip and fill in manually
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────────────────────────────
  return (
    <div className="space-y-8" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scanning your website…</h1>
        <p className="mt-1 text-sm text-slate-500">
          We're reading{' '}
          <span className="font-medium text-slate-700 underline decoration-dotted">
            {currentOrg?.websiteUrl ?? 'your website'}
          </span>{' '}
          to build your AI's knowledge base. This takes about 15–30 seconds.
        </p>
      </div>

      {/* Orbit loader */}
      <div className="flex flex-col items-center gap-4 py-2">
        <OrbitLoader />
        <p
          className="text-sm font-medium text-brand-700"
          style={{ animation: 'pulse-soft 2s ease-in-out infinite' }}
        >
          {STEPS[activeStep]?.label}
        </p>
        <p className="text-xs text-slate-400 text-center">
          {STEPS[activeStep]?.sublabel}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <PulsingBar progress={progress} />
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Scanning…</span>
          <span>{progress}%</span>
        </div>
      </div>

      {/* Step checklist */}
      <div className="space-y-2.5">
        {STEPS.map((step, idx) => {
          const isDone = idx < activeStep;
          const isActive = idx === activeStep;
          return (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-300 ${
                isActive
                  ? 'bg-brand-50 border border-brand-100'
                  : isDone
                  ? 'opacity-60'
                  : 'opacity-30'
              }`}
            >
              {/* Icon */}
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-600'
                    : isActive
                    ? 'bg-brand-100 text-brand-600'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isDone ? <CheckCircle2 size={14} /> : step.icon}
              </span>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-semibold truncate ${
                    isDone
                      ? 'text-emerald-700'
                      : isActive
                      ? 'text-brand-700'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </p>
              </div>

              {/* Status dot */}
              {isActive && (
                <span
                  className="h-2 w-2 rounded-full bg-brand-500 flex-shrink-0"
                  style={{ animation: 'pulse-soft 1s ease-in-out infinite' }}
                />
              )}
              {isDone && (
                <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footnote */}
      <p className="text-center text-[11px] text-slate-400 leading-relaxed">
        Don't close this tab — we'll take you to the next step automatically.
        <br />
        Scanning up to 15 pages across your site.
      </p>
    </div>
  );
}
