/**
 * L2.F4 — CustomizePage (Onboarding Step 4: Customize)
 * Collects supported languages and optional fallback phone number.
 * On submit → PATCH /api/v1/onboarding/org { step: 'customize' } → /onboarding/activate
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mic } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';

// ─── Language options (mirrors backend SUPPORTED_LANGUAGE_CODES) ─────────────
const LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'English', sublabel: 'English (US)' },
  { code: 'hi-IN', label: 'हिन्दी', sublabel: 'Hindi' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ', sublabel: 'Punjabi' },
] as const;

type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]['code'];

// ─── Form schema ─────────────────────────────────────────────────────────────
const CustomizeSchema = z.object({
  supportedLanguages: z
    .array(z.enum(['en-US', 'hi-IN', 'pa-IN'] as const))
    .min(1, 'Select at least one language for your AI agent'),
  fallbackNumber: z.string().optional(),
});

type CustomizeFormValues = z.infer<typeof CustomizeSchema>;

// ─── Component ───────────────────────────────────────────────────────────────
export default function CustomizePage() {
  const { updateOnboardingStep } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomizeFormValues>({
    resolver: zodResolver(CustomizeSchema),
    defaultValues: {
      supportedLanguages: ['en-US'],
      fallbackNumber: '',
    },
  });

  const selectedLanguages = watch('supportedLanguages') ?? [];

  function toggleLanguage(code: LanguageCode) {
    const current = selectedLanguages;
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setValue('supportedLanguages', next as LanguageCode[], { shouldValidate: true });
  }

  async function onSubmit(values: CustomizeFormValues) {
    setServerError(null);
    try {
      await updateOnboardingStep(
        {
          step: 'customize',
          supportedLanguages: values.supportedLanguages,
          fallbackNumber: values.fallbackNumber || undefined,
        },
        '/onboarding/activate',
      );
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
          <Mic size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customize your AI agent</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose the languages your agent will speak and set a fallback number for escalations.
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
        {/* Language selection */}
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1">
            Supported languages <span className="text-red-500">*</span>
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Your AI agent will respond in whichever of these languages the caller uses.
          </p>
          <div className="space-y-2">
            {LANGUAGE_OPTIONS.map(({ code, label, sublabel }) => {
              const isSelected = selectedLanguages.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleLanguage(code)}
                  className={`w-full flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition
                    ${isSelected
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox indicator */}
                    <span
                      className={`h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition
                        ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white fill-current">
                          <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span>
                      <span className={`text-sm font-medium ${isSelected ? 'text-brand-700' : 'text-slate-700'}`}>
                        {label}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">{sublabel}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Hidden register so RHF tracks the array */}
          <input type="hidden" {...register('supportedLanguages')} />
          {errors.supportedLanguages && (
            <p className="mt-2 text-xs text-red-600">{errors.supportedLanguages.message}</p>
          )}
        </div>

        {/* Fallback number */}
        <div>
          <label htmlFor="fallback-number" className="block text-sm font-medium text-slate-700 mb-1">
            Fallback number{' '}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="fallback-number"
            type="tel"
            {...register('fallbackNumber')}
            placeholder="+91 98765 43210"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white"
          />
          <p className="mt-1 text-xs text-slate-400">
            When the AI can't handle a call, it will transfer to this number.
          </p>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
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
