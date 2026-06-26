/**
 * L2.F4 — ConfigurePage (Onboarding Step 3: Configure)
 * Collects business description, services, business hours, and contact details.
 * On submit → PATCH /api/v1/onboarding/org { step: 'configure' } → /onboarding/customize
 * All fields are optional — "Skip" sends an empty configure patch.
 */

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Settings2, Plus, X } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';

// ─── Form schema ─────────────────────────────────────────────────────────────
const ConfigureSchema = z.object({
  businessDescription: z.string().max(500, 'Max 500 characters').optional(),
  services: z.array(z.object({ value: z.string().max(100) })).max(20),
  businessHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use HH:MM format')
    .optional()
    .or(z.literal('')),
  businessHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use HH:MM format')
    .optional()
    .or(z.literal('')),
  contactEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
});

type ConfigureFormValues = z.infer<typeof ConfigureSchema>;

// ─── Component ───────────────────────────────────────────────────────────────
export default function ConfigurePage() {
  const { updateOnboardingStep } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [newService, setNewService] = useState('');

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ConfigureFormValues>({
    resolver: zodResolver(ConfigureSchema),
    defaultValues: {
      businessDescription: '',
      services: [],
      businessHoursStart: '09:00',
      businessHoursEnd: '18:00',
      contactEmail: '',
      contactPhone: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'services' });
  const description = watch('businessDescription') ?? '';

  function addService() {
    const trimmed = newService.trim();
    if (!trimmed || trimmed.length > 100 || fields.length >= 20) return;
    append({ value: trimmed });
    setNewService('');
  }

  function buildDto(values: ConfigureFormValues) {
    const dto: Parameters<typeof updateOnboardingStep>[0] = {
      step: 'configure',
      businessDescription: values.businessDescription || undefined,
      services: fields.map((f) => f.value).filter(Boolean),
      businessHours:
        values.businessHoursStart && values.businessHoursEnd
          ? { start: values.businessHoursStart, end: values.businessHoursEnd }
          : undefined,
      contactDetails:
        values.contactEmail || values.contactPhone
          ? {
              email: values.contactEmail || undefined,
              phone: values.contactPhone || undefined,
            }
          : undefined,
    };
    return dto;
  }

  async function onSubmit(values: ConfigureFormValues) {
    setServerError(null);
    try {
      await updateOnboardingStep(buildDto(values), '/onboarding/customize');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setServerError(axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  }

  async function handleSkip() {
    setServerError(null);
    try {
      await updateOnboardingStep({ step: 'configure' }, '/onboarding/customize');
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
          <Settings2 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configure your business</h1>
          <p className="mt-1 text-sm text-slate-500">
            This helps your AI answer questions accurately. All fields are optional.
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
        {/* Business description */}
        <div>
          <label htmlFor="business-description" className="block text-sm font-medium text-slate-700 mb-1">
            Business description
          </label>
          <textarea
            id="business-description"
            rows={3}
            {...register('businessDescription')}
            placeholder="e.g. We provide last-mile delivery services across Delhi NCR with real-time tracking…"
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none resize-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${errors.businessDescription ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
          />
          <div className="flex justify-between mt-1">
            {errors.businessDescription
              ? <p className="text-xs text-red-600">{errors.businessDescription.message}</p>
              : <span />
            }
            <p className="text-xs text-slate-400">{description.length}/500</p>
          </div>
        </div>

        {/* Services */}
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-2">
            Services / Products <span className="text-slate-400 font-normal">(up to 20)</span>
          </p>
          {/* Tag list */}
          {fields.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {fields.map((field, idx) => (
                <span
                  key={field.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200
                    px-3 py-1 text-xs font-medium text-brand-700"
                >
                  {field.value}
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="text-brand-400 hover:text-brand-700 transition"
                    aria-label={`Remove ${field.value}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Add service input */}
          {fields.length < 20 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addService(); }
                }}
                placeholder="e.g. Express Delivery"
                maxLength={100}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none
                  focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white"
              />
              <button
                type="button"
                onClick={addService}
                disabled={!newService.trim()}
                className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2
                  text-sm font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-40"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          )}
        </div>

        {/* Business hours */}
        <div>
          <p className="block text-sm font-medium text-slate-700 mb-2">Business hours</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label htmlFor="hours-start" className="text-xs text-slate-500 mb-1 block">Opens</label>
              <input
                id="hours-start"
                type="time"
                {...register('businessHoursStart')}
                className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                  focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white
                  ${errors.businessHoursStart ? 'border-red-400' : 'border-slate-300'}`}
              />
              {errors.businessHoursStart && (
                <p className="mt-0.5 text-xs text-red-600">{errors.businessHoursStart.message}</p>
              )}
            </div>
            <span className="mt-5 text-slate-400 text-sm">to</span>
            <div className="flex-1">
              <label htmlFor="hours-end" className="text-xs text-slate-500 mb-1 block">Closes</label>
              <input
                id="hours-end"
                type="time"
                {...register('businessHoursEnd')}
                className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                  focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white
                  ${errors.businessHoursEnd ? 'border-red-400' : 'border-slate-300'}`}
              />
              {errors.businessHoursEnd && (
                <p className="mt-0.5 text-xs text-red-600">{errors.businessHoursEnd.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700 mb-1">
              Support email
            </label>
            <input
              id="contact-email"
              type="email"
              {...register('contactEmail')}
              placeholder="support@yourcompany.com"
              className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
                ${errors.contactEmail ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            />
            {errors.contactEmail && (
              <p className="mt-1 text-xs text-red-600">{errors.contactEmail.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="contact-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Support phone
            </label>
            <input
              id="contact-phone"
              type="tel"
              {...register('contactPhone')}
              placeholder="+91 98765 43210"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none
                focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white"
            />
          </div>
        </div>

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
