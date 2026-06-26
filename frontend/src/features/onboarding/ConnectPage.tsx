/**
 * L2.F4 — ConnectPage (Onboarding Step 1: Connect)
 * Collects org name + industry. Timezone is auto-detected from the browser.
 * On submit → POST /api/v1/onboarding/org → navigates to /onboarding/learn.
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Building2 } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';

// ─── Industry list (mirrors backend INDUSTRY_OPTIONS) ──────────────────────
const INDUSTRY_OPTIONS = [
  'Technology',
  'Healthcare',
  'Real Estate',
  'Logistics & Delivery',
  'Finance & BFSI',
  'Education & EdTech',
  'Retail',
  'Hospitality & Food',
  'Legal',
  'Manufacturing',
  'Other',
] as const;

// ─── Form schema ────────────────────────────────────────────────────────────
const ConnectSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  industry: z.enum(INDUSTRY_OPTIONS, {
    errorMap: () => ({ message: 'Select an industry' }),
  }),
  timezone: z.string().default('Asia/Kolkata'),
});

type ConnectFormValues = z.infer<typeof ConnectSchema>;

// ─── Component ───────────────────────────────────────────────────────────────
export default function ConnectPage() {
  const { createOrg } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConnectFormValues>({
    resolver: zodResolver(ConnectSchema),
    defaultValues: { name: '', timezone: 'Asia/Kolkata' },
  });

  // Auto-detect browser timezone — user never sees this field
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setValue('timezone', detected);
    } catch {
      // Fallback stays at Asia/Kolkata
    }
  }, [setValue]);

  async function onSubmit(values: ConnectFormValues) {
    try {
      await createOrg(values);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; code?: string }>;
      const code = axiosErr.response?.data?.code;
      if (code === 'ORG_LIMIT_REACHED') {
        setError('root', {
          message: 'You already have an organization. Refresh the page to continue.',
        });
      } else {
        setError('root', {
          message:
            axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.',
        });
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Building2 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Connect your business</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tell us about your organisation so we can personalise your AI agent.
          </p>
        </div>
      </div>

      {/* Server error */}
      {errors.root && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Business name */}
        <div>
          <label htmlFor="org-name" className="block text-sm font-medium text-slate-700 mb-1">
            Business name <span className="text-red-500">*</span>
          </label>
          <input
            id="org-name"
            type="text"
            autoComplete="organization"
            autoFocus
            {...register('name')}
            placeholder="e.g. Acme Logistics"
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        {/* Industry */}
        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-slate-700 mb-1">
            Industry <span className="text-red-500">*</span>
          </label>
          <select
            id="industry"
            {...register('industry')}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white
              ${errors.industry ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
          >
            <option value="">Select your industry</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {errors.industry && (
            <p className="mt-1 text-xs text-red-600">{errors.industry.message}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            This helps us recommend the right conversation flows for your sector.
          </p>
        </div>

        {/* Hidden timezone (auto-detected) */}
        <input type="hidden" {...register('timezone')} />

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
            {isSubmitting ? 'Creating…' : 'Continue →'}
          </button>
        </div>
      </form>
    </div>
  );
}
