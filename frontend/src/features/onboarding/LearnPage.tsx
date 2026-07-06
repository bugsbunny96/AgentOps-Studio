/**
 * L2.F4 — LearnPage (Onboarding Step 2: Learn)
 *
 * Three explicit paths (locked — Session 4 product review):
 *   Path A — "Yes, crawl my website"    hasWebsite=true  crawlEnabled=true  websiteUrl=https://...
 *   Path B — "I'll add content manually" hasWebsite=true  crawlEnabled=false
 *   Path C — "No website yet"           hasWebsite=false crawlEnabled=false
 *
 * URL validation: HTTPS-only (http:// crawls fail silently on most hosts).
 * No "Skip" button — Path C is the explicit no-website choice.
 *
 * On submit → PATCH /api/v1/onboarding/org { step: 'learn', ... } → /onboarding/configure
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Globe, FileText, Building2 } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';

// ─── Path types ──────────────────────────────────────────────────────────────
type LearnPath = 'crawl' | 'manual' | 'no-website';

const PATH_CONFIG: Array<{
  id: LearnPath;
  icon: React.ReactNode;
  title: string;
  description: string;
}> = [
  {
    id: 'crawl',
    icon: <Globe size={20} />,
    title: 'Yes, scan my website',
    description:
      "We'll scan it automatically and build your AI's knowledge base — no manual work needed.",
  },
  {
    id: 'manual',
    icon: <FileText size={20} />,
    title: "I'll add content manually",
    description:
      "I have a website but prefer to describe my business myself in the next step.",
  },
  {
    id: 'no-website',
    icon: <Building2 size={20} />,
    title: 'No website yet',
    description:
      "No problem — you can describe your business in your own words in the next step.",
  },
];

// ─── Form schema ─────────────────────────────────────────────────────────────
const LearnSchema = z
  .object({
    path: z.enum(['crawl', 'manual', 'no-website'], {
      errorMap: () => ({ message: 'Please select an option to continue' }),
    }),
    websiteUrl: z
      .union([
        z
          .string()
          .url('Enter a valid HTTPS URL (e.g. https://yourcompany.com)')
          .refine(
            (url) => url.startsWith('https://'),
            { message: 'Website URL must use HTTPS (e.g. https://yourcompany.com)' },
          ),
        z.literal(''),
      ])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.path === 'crawl' && !data.websiteUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['websiteUrl'],
        message: 'Please enter your website URL to enable scanning',
      });
    }
  });

type LearnFormValues = z.infer<typeof LearnSchema>;

// ─── Derive backend DTO from form path ───────────────────────────────────────
function buildDto(values: LearnFormValues) {
  if (values.path === 'crawl') {
    return {
      step: 'learn' as const,
      hasWebsite: true,
      crawlEnabled: true,
      websiteUrl: values.websiteUrl || undefined,
    };
  }
  if (values.path === 'manual') {
    return { step: 'learn' as const, hasWebsite: true, crawlEnabled: false };
  }
  // no-website
  return { step: 'learn' as const, hasWebsite: false, crawlEnabled: false };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LearnPage() {
  const { updateOnboardingStep, currentOrg } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LearnFormValues>({
    resolver: zodResolver(LearnSchema),
    defaultValues: { path: undefined, websiteUrl: '' },
  });

  const selectedPath = watch('path');

  // Pre-populate from saved org data (covers both same-session nav-back and page refresh)
  useEffect(() => {
    if (!currentOrg || currentOrg.onboardingStatus === 'ORG_CREATION') return;
    // Derive path from what was previously saved
    let savedPath: LearnPath;
    if (currentOrg.crawlEnabled) {
      savedPath = 'crawl';
    } else if (currentOrg.hasWebsite) {
      savedPath = 'manual';
    } else {
      savedPath = 'no-website';
    }
    setValue('path', savedPath, { shouldValidate: false });
    if (savedPath === 'crawl' && currentOrg.websiteUrl) {
      setValue('websiteUrl', currentOrg.websiteUrl);
    }
  }, [currentOrg?.id, currentOrg?.onboardingStatus, setValue]);

  function selectPath(id: LearnPath) {
    setValue('path', id, { shouldValidate: false });
    // Clear URL when switching away from crawl
    if (id !== 'crawl') setValue('websiteUrl', '');
  }

  async function onSubmit(values: LearnFormValues) {
    setServerError(null);
    try {
      const dto = buildDto(values);
      // Path A (crawl): go to the crawl-loading screen; it will poll and redirect to configure.
      // Paths B & C (manual / no-website): go directly to configure.
      const nextPath =
        dto.crawlEnabled ? '/onboarding/crawling' : '/onboarding/configure';
      await updateOnboardingStep(dto, nextPath);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setServerError(
        axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Does your business have a website?</h1>
        <p className="mt-1 text-sm text-slate-500">
          We use your website to train the AI on your services, tone, and FAQs — so it answers
          like a real member of your team.
        </p>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Hidden register for path */}
        <input type="hidden" {...register('path')} />

        {/* 3-path selector */}
        <div className="space-y-3">
          {PATH_CONFIG.map((option, i) => {
            const isSelected = selectedPath === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectPath(option.id)}
                className={`w-full flex items-start gap-4 rounded-xl border-2 px-5 py-4 text-left transition
                  ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
              >
                {/* Icon + recommended badge */}
                <div className="relative mt-0.5">
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition
                      ${isSelected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {option.icon}
                  </span>
                  {/* Recommended badge on first option */}
                  {i === 0 && (
                    <span className="absolute -top-2 -right-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                      Recommended
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      isSelected ? 'text-brand-700' : 'text-slate-800'
                    }`}
                  >
                    {option.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    {option.description}
                  </p>
                </div>

                {/* Selection indicator */}
                <span
                  className={`mt-1 flex h-4 w-4 flex-shrink-0 rounded-full border-2 items-center justify-center transition
                    ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`}
                >
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Path error (if submitted with no selection) */}
        {errors.path && (
          <p className="text-xs text-red-600">{errors.path.message}</p>
        )}

        {/* Website URL input — only for Path A (crawl) */}
        {selectedPath === 'crawl' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <label htmlFor="website-url" className="block text-sm font-medium text-slate-700">
              Website URL <span className="text-red-500">*</span>
            </label>
            <input
              id="website-url"
              type="url"
              autoFocus
              {...register('websiteUrl')}
              placeholder="https://yourcompany.com"
              className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none bg-white
                focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
                ${errors.websiteUrl ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
            />
            {errors.websiteUrl ? (
              <p className="text-xs text-red-600">{errors.websiteUrl.message}</p>
            ) : (
              <p className="text-xs text-slate-400">
                Use the full HTTPS address. We'll scan up to 50 public pages to build your AI's
                knowledge base.
              </p>
            )}
          </div>
        )}

        {/* Path B context message */}
        {selectedPath === 'manual' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">You're in control.</span> In the next step, you can
              describe your services, business hours, and contact details manually. You can always
              connect your website later from Settings.
            </p>
          </div>
        )}

        {/* Path C context message */}
        {selectedPath === 'no-website' && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-xs text-sky-800">
              <span className="font-semibold">That's completely fine.</span> Businesses without
              websites do great with our AI. You'll describe your services in the next step, and
              you can upload documents or add a website later from Settings.
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !selectedPath}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-600
              px-4 py-2.5 text-sm font-semibold text-white shadow-sm
              hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500
              disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      </form>
    </div>
  );
}
