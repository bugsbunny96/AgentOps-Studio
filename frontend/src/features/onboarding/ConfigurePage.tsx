/**
 * L2.F4 — ConfigurePage (Onboarding Step 3: Configure)
 *
 * Sections:
 *   1. Agent Identity  — agentName (what the AI says when it picks up)
 *   2. Business Context — description (unlimited, resizable) + services/products
 *   3. Business Hours  — with "Open 24 hours" checkbox
 *   4. Contact Details
 *   5. Office Locations
 *   6. FAQs           — up to 10 voice-friendly Q&A pairs
 *
 * Auto-population: if the user chose "crawl my website" in LearnPage, any fields
 * the backend has already extracted are pre-populated from currentOrg. A banner
 * confirms this and field-level badges mark auto-filled values.
 *
 * All fields optional — Skip sends an empty configure patch.
 * On submit → PATCH /api/v1/onboarding/org { step: 'configure' } → /onboarding/customize
 */

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2, Settings2, Plus, X, ChevronDown, ChevronUp,
  Globe, CheckCircle2,
} from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when a set of saved business hours represents 24-hour operation */
function is24HourSchedule(start?: string, end?: string): boolean {
  return start === '00:00' && end === '23:59';
}

// ─── Form schema ──────────────────────────────────────────────────────────────
const ConfigureSchema = z.object({
  // 1. Agent identity
  agentName: z
    .string()
    .max(50, 'Agent name must be at most 50 characters')
    .optional()
    .or(z.literal('')),

  // 2. Business context — no character limit; user controls length
  businessDescription: z.string().optional(),
  services: z.array(z.object({ value: z.string().max(100) })).max(20),

  // 3. Business hours
  isOpen24Hours: z.boolean(),
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

  // 4. Contact details
  contactEmail: z.string().email('Enter a valid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),

  // 5. Locations
  locations: z.array(z.object({ value: z.string().max(200) })).max(10),

  // 6. FAQs — voice-friendly Q&A pairs
  faqs: z.array(
    z.object({
      question: z.string().max(200, 'Question max 200 characters'),
      answer: z.string().max(300, 'Answer max 300 characters'),
    }),
  ).max(10),
});

type ConfigureFormValues = z.infer<typeof ConfigureSchema>;

// ─── CrawlBadge — small "From website" indicator ─────────────────────────────
function CrawlBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      <Globe size={9} /> From website
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ConfigurePage() {
  const { updateOnboardingStep, currentOrg } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [newService, setNewService]   = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [faqsOpen, setFaqsOpen]       = useState(false);

  // Detect crawl context — used for banner and field badges
  const crawlEnabled = Boolean(currentOrg?.crawlEnabled && currentOrg?.websiteUrl);

  // Which specific fields were auto-populated from the crawl?
  const crawledFields = crawlEnabled ? {
    description: Boolean(currentOrg?.businessDescription),
    services:    (currentOrg?.services?.length ?? 0) > 0,
    hours:       Boolean(currentOrg?.businessHours?.start),
    email:       Boolean(currentOrg?.contactDetails?.email),
    phone:       Boolean(currentOrg?.contactDetails?.phone),
    locations:   (currentOrg?.locations?.length ?? 0) > 0,
    faqs:        (currentOrg?.faqs?.length ?? 0) > 0,
  } : {};

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ConfigureFormValues>({
    resolver: zodResolver(ConfigureSchema),
    defaultValues: {
      agentName:           currentOrg?.agentName           ?? '',
      businessDescription: currentOrg?.businessDescription ?? '',
      services:            (currentOrg?.services ?? []).map((v) => ({ value: v })),
      isOpen24Hours:       is24HourSchedule(currentOrg?.businessHours?.start, currentOrg?.businessHours?.end),
      businessHoursStart:  currentOrg?.businessHours?.start ?? '09:00',
      businessHoursEnd:    currentOrg?.businessHours?.end   ?? '18:00',
      contactEmail:        currentOrg?.contactDetails?.email ?? '',
      contactPhone:        currentOrg?.contactDetails?.phone ?? '',
      locations:           (currentOrg?.locations ?? []).map((v) => ({ value: v })),
      faqs:                currentOrg?.faqs?.length
        ? currentOrg.faqs.map((f) => ({ question: f.question, answer: f.answer }))
        : [],
    },
  });

  // Re-populate when currentOrg hydrates (async fetchCurrentOrg on layout mount)
  useEffect(() => {
    if (!currentOrg) return;
    const hasFaqs = (currentOrg.faqs ?? []).length > 0;
    const saved24h = is24HourSchedule(currentOrg.businessHours?.start, currentOrg.businessHours?.end);

    reset({
      agentName:           currentOrg.agentName           ?? '',
      businessDescription: currentOrg.businessDescription ?? '',
      services:            (currentOrg.services ?? []).map((v) => ({ value: v })),
      isOpen24Hours:       saved24h,
      businessHoursStart:  saved24h ? '09:00' : (currentOrg.businessHours?.start ?? '09:00'),
      businessHoursEnd:    saved24h ? '18:00' : (currentOrg.businessHours?.end   ?? '18:00'),
      contactEmail:        currentOrg.contactDetails?.email ?? '',
      contactPhone:        currentOrg.contactDetails?.phone ?? '',
      locations:           (currentOrg.locations ?? []).map((v) => ({ value: v })),
      faqs: hasFaqs
        ? currentOrg.faqs.map((f) => ({ question: f.question, answer: f.answer }))
        : [],
    });
    if (hasFaqs) setFaqsOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  // Field arrays
  const { fields: serviceFields,  append: appendService,  remove: removeService  } =
    useFieldArray({ control, name: 'services' });
  const { fields: locationFields, append: appendLocation, remove: removeLocation } =
    useFieldArray({ control, name: 'locations' });
  const { fields: faqFields,      append: appendFaq,      remove: removeFaq      } =
    useFieldArray({ control, name: 'faqs' });

  const isOpen24Hours = watch('isOpen24Hours');

  function addService() {
    const v = newService.trim();
    if (!v || v.length > 100 || serviceFields.length >= 20) return;
    appendService({ value: v });
    setNewService('');
  }

  function addLocation() {
    const v = newLocation.trim();
    if (!v || v.length > 200 || locationFields.length >= 10) return;
    appendLocation({ value: v });
    setNewLocation('');
  }

  function buildDto(values: ConfigureFormValues) {
    return {
      step: 'configure' as const,
      agentName:           values.agentName || undefined,
      businessDescription: values.businessDescription || undefined,
      services:  serviceFields.map((f)  => f.value).filter(Boolean),
      businessHours: values.isOpen24Hours
        ? { start: '00:00', end: '23:59' }
        : (values.businessHoursStart && values.businessHoursEnd
            ? { start: values.businessHoursStart, end: values.businessHoursEnd }
            : undefined),
      contactDetails:
        values.contactEmail || values.contactPhone
          ? {
              email: values.contactEmail || undefined,
              phone: values.contactPhone || undefined,
            }
          : undefined,
      locations: locationFields.map((f) => f.value).filter(Boolean),
      faqs: faqFields
        .filter((f) => f.question.trim() && f.answer.trim())
        .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })),
    };
  }

  async function onSubmit(values: ConfigureFormValues) {
    setServerError(null);
    try {
      await updateOnboardingStep(buildDto(values), '/onboarding/customize');
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setServerError(e.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  }

  async function handleSkip() {
    setServerError(null);
    try {
      await updateOnboardingStep({ step: 'configure' }, '/onboarding/customize');
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setServerError(e.response?.data?.message ?? 'Something went wrong. Please try again.');
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
            Help your AI answer callers accurately. All fields are optional — fill them in from
            the dashboard later.
          </p>
        </div>
      </div>

      {/* ── Crawl auto-populate banner ─────────────────────────────────── */}
      {crawlEnabled && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              Fields pre-filled from your website
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              We scanned{' '}
              <span className="font-medium underline decoration-dotted">
                {currentOrg?.websiteUrl}
              </span>{' '}
              and filled in what we found. Review each section, edit anything, and save.
            </p>
          </div>
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">

        {/* ── 1. Agent Identity ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Agent identity</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              How your AI introduces itself on every call.
            </p>
          </div>

          <div>
            <label htmlFor="agent-name" className="block text-sm font-medium text-slate-700 mb-1">
              Agent name <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="agent-name"
              type="text"
              {...register('agentName')}
              placeholder="e.g. Priya, Alex, Rita"
              maxLength={50}
              className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
                ${errors.agentName ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            />
            {errors.agentName ? (
              <p className="mt-1 text-xs text-red-600">{errors.agentName.message}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                Your AI will say:{' '}
                <em>
                  "Hi, I'm [Agent name] from {currentOrg?.name ?? 'your company'}. How can I help
                  you today?"
                </em>
              </p>
            )}
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* ── 2. Business Context ───────────────────────────────────────── */}
        <section className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Business context</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Helps the AI describe your business and answer common questions.
            </p>
          </div>

          {/* Description — unlimited, user-resizable */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label
                htmlFor="business-description"
                className="block text-sm font-medium text-slate-700"
              >
                Business description
              </label>
              {crawledFields.description && <CrawlBadge />}
            </div>
            <textarea
              id="business-description"
              rows={4}
              {...register('businessDescription')}
              placeholder="e.g. We provide last-mile delivery services across Delhi NCR with real-time tracking and same-day fulfillment for e-commerce brands…"
              className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                resize-y min-h-[96px]
                focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
                ${errors.businessDescription ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            />
            <p className="mt-1 text-xs text-slate-400">
              No character limit. Drag the bottom-right corner to resize.
            </p>
            {errors.businessDescription && (
              <p className="mt-0.5 text-xs text-red-600">{errors.businessDescription.message}</p>
            )}
          </div>

          {/* Services */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="block text-sm font-medium text-slate-700">
                Services / Products{' '}
                <span className="text-slate-400 font-normal">(up to 20)</span>
              </p>
              {crawledFields.services && <CrawlBadge />}
            </div>
            {serviceFields.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {serviceFields.map((field, idx) => (
                  <span
                    key={field.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-50
                      border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700"
                  >
                    {field.value}
                    <button
                      type="button"
                      onClick={() => removeService(idx)}
                      className="text-brand-400 hover:text-brand-700 transition"
                      aria-label={`Remove ${field.value}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {serviceFields.length < 20 && (
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
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm
                    outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white"
                />
                <button
                  type="button"
                  onClick={addService}
                  disabled={!newService.trim()}
                  className="flex items-center gap-1 rounded-md border border-slate-300 bg-white
                    px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition
                    disabled:opacity-40"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            )}
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* ── 3. Business Hours ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Business hours</h2>
              {crawledFields.hours && <CrawlBadge />}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Your AI mentions these when callers ask about availability.
            </p>
          </div>

          {/* 24-hour checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none group w-fit">
            <span className="relative flex items-center">
              <input
                type="checkbox"
                id="is-open-24h"
                {...register('isOpen24Hours')}
                className="sr-only peer"
              />
              <span
                className={`h-4 w-4 rounded border-2 flex items-center justify-center transition
                  ${isOpen24Hours
                    ? 'border-brand-500 bg-brand-500'
                    : 'border-slate-300 bg-white group-hover:border-brand-400'}`}
              >
                {isOpen24Hours && (
                  <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white fill-current">
                    <path
                      d="M1 4l2.5 2.5L9 1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </span>
            <span className="text-sm font-medium text-slate-700">
              Open 24 hours{' '}
              <span className="text-slate-400 font-normal text-xs">(runs all day, every day)</span>
            </span>
          </label>

          {/* Time pickers — hidden when 24h checked */}
          {!isOpen24Hours && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label htmlFor="hours-start" className="text-xs text-slate-500 mb-1 block">
                  Opens
                </label>
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
                <label htmlFor="hours-end" className="text-xs text-slate-500 mb-1 block">
                  Closes
                </label>
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
          )}

          {/* 24h confirmation */}
          {isOpen24Hours && (
            <p className="text-xs text-brand-600 bg-brand-50 border border-brand-100 rounded-md px-3 py-2">
              ✓ Your AI will tell callers that your business is open 24 hours a day.
            </p>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* ── 4. Contact Details ────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Contact details</h2>
              {(crawledFields.email || crawledFields.phone) && <CrawlBadge />}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Shared with callers who ask how to reach your team directly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="contact-email"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
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
              <label
                htmlFor="contact-phone"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Support phone
              </label>
              <input
                id="contact-phone"
                type="tel"
                {...register('contactPhone')}
                placeholder="+91 98765 43210"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm
                  outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white"
              />
            </div>
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* ── 5. Locations ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">
                Office / branch locations{' '}
                <span className="text-slate-400 font-normal text-xs">(up to 10)</span>
              </h2>
              {crawledFields.locations && <CrawlBadge />}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cities or areas your business serves or operates from.
            </p>
          </div>

          {locationFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {locationFields.map((field, idx) => (
                <span
                  key={field.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100
                    border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {field.value}
                  <button
                    type="button"
                    onClick={() => removeLocation(idx)}
                    className="text-slate-400 hover:text-slate-700 transition"
                    aria-label={`Remove ${field.value}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {locationFields.length < 10 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addLocation(); }
                }}
                placeholder="e.g. Delhi, Mumbai, Bangalore"
                maxLength={200}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm
                  outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white"
              />
              <button
                type="button"
                onClick={addLocation}
                disabled={!newLocation.trim()}
                className="flex items-center gap-1 rounded-md border border-slate-300 bg-white
                  px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition
                  disabled:opacity-40"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* ── 6. FAQs ──────────────────────────────────────────────────── */}
        <section className="space-y-4">
          {/* Collapsible header */}
          <button
            type="button"
            onClick={() => setFaqsOpen((v) => !v)}
            className="w-full flex items-center justify-between text-left group"
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-800 group-hover:text-brand-600 transition">
                  Frequently asked questions{' '}
                  <span className="text-slate-400 font-normal text-xs">(up to 10)</span>
                </h2>
                {crawledFields.faqs && <CrawlBadge />}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Answers spoken aloud by your AI. Keep each answer under 30 words.
              </p>
            </div>
            <span className="ml-4 flex-shrink-0 text-slate-400 group-hover:text-brand-600 transition">
              {faqsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {faqsOpen && (
            <div className="space-y-4">
              {faqFields.map((field, idx) => (
                <div
                  key={field.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      FAQ {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFaq(idx)}
                      className="text-slate-400 hover:text-red-500 transition"
                      aria-label="Remove FAQ"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      Question
                    </label>
                    <input
                      type="text"
                      {...register(`faqs.${idx}.question`)}
                      placeholder="e.g. What are your delivery charges?"
                      maxLength={200}
                      className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                        bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
                        ${errors.faqs?.[idx]?.question ? 'border-red-400' : 'border-slate-300'}`}
                    />
                    {errors.faqs?.[idx]?.question && (
                      <p className="mt-0.5 text-xs text-red-600">
                        {errors.faqs[idx]?.question?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      Answer{' '}
                      <span className="text-slate-400 font-normal">(spoken aloud — keep it concise)</span>
                    </label>
                    <textarea
                      rows={2}
                      {...register(`faqs.${idx}.answer`)}
                      placeholder="e.g. Delivery is free above ₹500. Standard orders cost ₹49."
                      maxLength={300}
                      className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
                        resize-none bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                        transition ${errors.faqs?.[idx]?.answer ? 'border-red-400' : 'border-slate-300'}`}
                    />
                    {errors.faqs?.[idx]?.answer && (
                      <p className="mt-0.5 text-xs text-red-600">
                        {errors.faqs[idx]?.answer?.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {faqFields.length < 10 && (
                <button
                  type="button"
                  onClick={() => appendFaq({ question: '', answer: '' })}
                  className="flex items-center gap-2 rounded-md border border-dashed border-slate-300
                    px-4 py-2.5 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600
                    transition w-full justify-center"
                >
                  <Plus size={14} /> Add a question
                </button>
              )}

              {faqFields.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-1">
                  No FAQs yet. Click "Add a question" to start.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Actions ──────────────────────────────────────────────────── */}
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
