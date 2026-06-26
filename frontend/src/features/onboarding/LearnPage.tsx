/**
 * L2.F4 — LearnPage (Onboarding Step 2: Learn)
 * Collects whether the business has a website + optional URL.
 * On submit → PATCH /api/v1/onboarding/org { step: 'learn' } → /onboarding/configure
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Globe } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';

// ─── Form schema ─────────────────────────────────────────────────────────────
const LearnSchema = z
  .object({
    hasWebsite: z.boolean(),
    websiteUrl: z
      .string()
      .url('Enter a valid URL (e.g. https://example.com)')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.hasWebsite && !data.websiteUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['websiteUrl'],
        message: 'Please enter your website URL',
      });
    }
  });

type LearnFormValues = z.infer<typeof LearnSchema>;

// ─── Component ───────────────────────────────────────────────────────────────
export default function LearnPage() {
  const { updateOnboardingStep } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasWebsiteSelected, setHasWebsiteSelected] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LearnFormValues>({
    resolver: zodResolver(LearnSchema),
    defaultValues: { hasWebsite: false, websiteUrl: '' },
  });

  const hasWebsite = watch('hasWebsite');

  async function onSubmit(values: LearnFormValues) {
    setServerError(null);
    try {
      await updateOnboardingStep(
        {
          step: 'learn',
          hasWebsite: values.hasWebsite,
          websiteUrl: values.hasWebsite ? values.websiteUrl || undefined : undefined,
        },
        '/onboarding/configure',
      );
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setServerError(axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  }

  async function handleSkip() {
    setServerError(null);
    try {
      await updateOnboardingStep({ step: 'learn', hasWebsite: false }, '/onboarding/configure');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setServerError(axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Globe size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tell us about your online presence</h1>
          <p className="mt-1 text-sm text-slate-500">
            We'll use your website to train the AI on your products, services, and tone of voice.
          </p>
        </div>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Has website toggle */}
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-3">
            Does your business have a website?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setHasWebsiteSelected(true);
                setValue('hasWebsite', true, { shouldValidate: false });
              }}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition
                ${hasWebsite
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
            >
              Yes, I have a website
            </button>
            <button
              type="button"
              onClick={() => {
                setHasWebsiteSelected(true);
                setValue('hasWebsite', false, { shouldValidate: false });
                setValue('websiteUrl', '');
              }}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition
                ${hasWebsiteSelected && !hasWebsite
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
            >
              No, I don't
            </button>
          </div>
          <input type="hidden" {...register('hasWebsite')} />
        </div>

        {/* Website URL — shown only when hasWebsite = true */}
        {hasWebsite && (
          <div>
            <label htmlFor="website-url" className="block text-sm font-medium text-slate-700 mb-1">
              Website URL <span className="text-red-500">*</span>
            </label>
            <input
              id="website-url"
              type="url"
              autoFocus
              {...register('websiteUrl')}
              placeholder="https://yourcompany.com"
              className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
                ${errors.websiteUrl ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            />
            {errors.websiteUrl && (
              <p className="mt-1 text-xs text-red-600">{errors.websiteUrl.message}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              We'll crawl publicly accessible pages to build your AI's knowledge base.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-md bg-brand-600
              px-4 py-2.5 text-sm font-semibold text-white shadow-sm
              hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500
              disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {isSubmitting ? 'Saving…' : 'Continue →'}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSkip}
            className="rounded-md px-4 py-2.5 text-sm font-medium text-slate-500
              hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  );
}
