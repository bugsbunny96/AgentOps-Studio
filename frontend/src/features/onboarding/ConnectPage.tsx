/**
 * L2.F4 — ConnectPage (Onboarding Step 1: Connect)
 *
 * Collects:
 *   - Business name  → seeds AI greeting, slug, KB title, all emails
 *   - Industry       → drives Configure defaults, AI terminology, persona tone
 *   - Timezone       → visible + editable (pre-filled from browser); drives Configure business hours
 *
 * Design decisions (Session 4 product review):
 *   - Timezone is NOT hidden. VPN users / border-region users need to correct it.
 *   - Timezone shown as a collapsed confirm chip; expands to searchable select on request.
 *   - Heading frames the agent, not the org ("AI receptionist" not "business").
 *   - Industry hint explains why we ask, reducing drop-off.
 *   - No Skip — all 3 fields are mandatory to create a functional agent.
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Bot, ChevronDown } from 'lucide-react';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// ─── Industry list (mirrors backend INDUSTRY_OPTIONS) ───────────────────────
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

// ─── Curated timezone list (covers Indian SMB ICP + common global zones) ────
// Full IANA names used for DB; display labels for readability.
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Asia/Kolkata',      label: 'India Standard Time (IST) — UTC+5:30' },
  { value: 'Asia/Dubai',        label: 'Gulf Standard Time (GST) — UTC+4:00' },
  { value: 'Asia/Singapore',    label: 'Singapore Time (SGT) — UTC+8:00' },
  { value: 'Asia/Bangkok',      label: 'Indochina Time (ICT) — UTC+7:00' },
  { value: 'Asia/Tokyo',        label: 'Japan Standard Time (JST) — UTC+9:00' },
  { value: 'Asia/Shanghai',     label: 'China Standard Time (CST) — UTC+8:00' },
  { value: 'Asia/Karachi',      label: 'Pakistan Standard Time (PKT) — UTC+5:00' },
  { value: 'Asia/Dhaka',        label: 'Bangladesh Time (BDT) — UTC+6:00' },
  { value: 'Asia/Colombo',      label: 'Sri Lanka Time (SLST) — UTC+5:30' },
  { value: 'Asia/Kathmandu',    label: 'Nepal Time (NPT) — UTC+5:45' },
  { value: 'Europe/London',     label: 'Greenwich Mean Time (GMT) — UTC+0:00' },
  { value: 'Europe/Paris',      label: 'Central European Time (CET) — UTC+1:00' },
  { value: 'Europe/Berlin',     label: 'Central European Time (CET) — UTC+1:00' },
  { value: 'America/New_York',  label: 'Eastern Time (ET) — UTC-5:00' },
  { value: 'America/Chicago',   label: 'Central Time (CT) — UTC-6:00' },
  { value: 'America/Denver',    label: 'Mountain Time (MT) — UTC-7:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) — UTC-8:00' },
  { value: 'America/Toronto',   label: 'Eastern Time Canada (ET) — UTC-5:00' },
  { value: 'America/Vancouver', label: 'Pacific Time Canada (PT) — UTC-8:00' },
  { value: 'America/Sao_Paulo', label: 'Brasilia Time (BRT) — UTC-3:00' },
  { value: 'Africa/Nairobi',    label: 'East Africa Time (EAT) — UTC+3:00' },
  { value: 'Africa/Lagos',      label: 'West Africa Time (WAT) — UTC+1:00' },
  { value: 'Australia/Sydney',  label: 'Australian Eastern Time (AEST) — UTC+10:00' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time (AEST) — UTC+10:00' },
  { value: 'Pacific/Auckland',  label: 'New Zealand Time (NZST) — UTC+12:00' },
];

function getTimezoneLabel(iana: string): string {
  return TIMEZONE_OPTIONS.find((t) => t.value === iana)?.label ?? iana;
}

// ─── Form schema ─────────────────────────────────────────────────────────────
const ConnectSchema = z.object({
  name: z
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be at most 100 characters')
    .trim(),
  industry: z.enum(INDUSTRY_OPTIONS, {
    errorMap: () => ({ message: 'Please select an industry' }),
  }),
  timezone: z.string().min(1, 'Timezone is required').default('Asia/Kolkata'),
});

type ConnectFormValues = z.infer<typeof ConnectSchema>;

// ─── Component ───────────────────────────────────────────────────────────────
export default function ConnectPage() {
  const { createOrg, currentOrg } = useAuth();
  const navigate = useNavigate();
  const [timezoneExpanded, setTimezoneExpanded] = useState(false);

  // Pre-fill from saved org when user navigates back to this step.
  // NOTE: no redirect here — the progress bar handles navigation intentionally.
  // We pre-populate the form so the user sees what they saved.
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConnectFormValues>({
    resolver: zodResolver(ConnectSchema),
    defaultValues: {
      name:     currentOrg?.name     ?? '',
      industry: currentOrg?.industry ?? ('' as ConnectFormValues['industry']),
      timezone: currentOrg?.timezone ?? 'Asia/Kolkata',
    },
  });

  const timezone = watch('timezone');

  // Auto-detect browser timezone only on first visit (no saved org yet).
  // On back-navigation the form is already pre-filled from currentOrg above.
  useEffect(() => {
    if (currentOrg?.timezone) return; // already have saved timezone
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setValue('timezone', detected);
    } catch {
      // Fallback stays at Asia/Kolkata
    }
  }, [currentOrg?.timezone, setValue]);

  async function onSubmit(values: ConnectFormValues) {
    try {
      await createOrg(values);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; code?: string }>;
      const code = axiosErr.response?.data?.code;
      if (code === 'ORG_LIMIT_REACHED') {
        // Org already exists — user is reviewing Step 1 data. Navigate forward.
        navigate('/onboarding/learn');
      } else if (!axiosErr.response) {
        setError('root', { message: 'Unable to connect to server. Please try again.' });
      } else {
        setError('root', {
          message: axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.',
        });
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Let's set up your AI receptionist
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            First, tell us about your business.
          </p>
        </div>
      </div>

      {/* Server / root error */}
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
            placeholder="e.g. Acme Logistics Pvt. Ltd."
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            Your AI will say: "Thank you for calling <em>[Business Name]</em>."
          </p>
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
          {errors.industry ? (
            <p className="mt-1 text-xs text-red-600">{errors.industry.message}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              This helps your AI use the right language and terminology for your sector.
            </p>
          )}
        </div>

        {/* Timezone — visible confirm chip, expandable to full select */}
        <div>
          <button
            type="button"
            onClick={() => setTimezoneExpanded((v) => !v)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition group"
          >
            <span className="text-slate-400">🕐</span>
            <span>
              Timezone auto-detected:{' '}
              <span className="font-medium text-slate-700">{getTimezoneLabel(timezone)}</span>
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform text-slate-400 group-hover:text-slate-600 ${timezoneExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {timezoneExpanded && (
            <div className="mt-2">
              <select
                id="timezone"
                {...register('timezone')}
                className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                  focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white
                  ${errors.timezone ? 'border-red-400' : 'border-slate-300'}`}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              {errors.timezone && (
                <p className="mt-1 text-xs text-red-600">{errors.timezone.message}</p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                Used to set your business hours and route calls correctly.
              </p>
            </div>
          )}
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
            {isSubmitting ? 'Creating your workspace…' : 'Create my workspace →'}
          </button>
        </div>
      </form>
    </div>
  );
}
