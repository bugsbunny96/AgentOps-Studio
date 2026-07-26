/**
 * SettingsPage — org configuration.
 *
 * Sections:
 *   1. Organisation Profile  — read-only identity (name, industry, timezone, slug, role)
 *   2. Languages & Fallback  — editable via PATCH /onboarding/org { step: 'customize' }
 *   3. Phone Number Setup    — live section
 *   4. Technical Details     — read-only IDs
 *   5. Profile               — user display name
 *   6. Security              — change password
 *
 * NOTE: Business Configuration (agent name, description, services, hours, contact,
 * locations, FAQs) was moved to the Knowledge Base page where it is auto-filled
 * from the website crawl and editable in context.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import {
  Copy, CheckCircle2, Phone, ExternalLink, Loader2,
  Pencil, Save, Eye, EyeOff,
} from 'lucide-react';
import { api } from '@/utils/api';
import type { AxiosError } from 'axios';

// ─── Language options ──────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS: Array<{ code: 'en-US' | 'hi-IN' | 'pa-IN'; label: string }> = [
  { code: 'en-US', label: 'English (en-US)' },
  { code: 'hi-IN', label: 'Hindi (hi-IN)'   },
  { code: 'pa-IN', label: 'Punjabi (pa-IN)' },
];

// ─── Form schemas ──────────────────────────────────────────────────────────────

const LanguagesSchema = z.object({
  supportedLanguages: z
    .array(z.enum(['en-US', 'hi-IN', 'pa-IN']))
    .min(1, 'Select at least one language'),
  fallbackNumber: z.string().optional(),
});
type LanguagesValues = z.infer<typeof LanguagesSchema>;

// ─── Shared sub-components ─────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-50 last:border-0">
      <span className="text-xs font-medium text-slate-400 w-40 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 text-right flex-1 leading-snug">{value}</span>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-50 last:border-0">
      <span className="text-xs font-medium text-slate-400 w-40 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-slate-50 border border-slate-100 rounded-md px-2 py-1
          font-mono text-slate-600 max-w-[200px] truncate">{value}</code>
        <button onClick={copy} title="Copy"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400
            hover:bg-slate-100 hover:text-slate-600 transition-colors">
          {copied
            ? <CheckCircle2 size={13} className="text-emerald-500" />
            : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}

/**
 * Card wrapper.
 * `action` renders in the header row (e.g. an Edit button).
 */
function Section({
  title,
  action,
  children,
}: {
  title:    string;
  action?:  React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between px-5 pt-5 pb-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="px-5 pb-4">{children}</div>
    </div>
  );
}

/** Inline success banner shown after a successful save. Auto-hides after 3 s. */
function SavedBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100
      px-4 py-2.5 mt-3 mb-1">
      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
      <span className="text-sm font-medium text-emerald-700">Changes saved successfully.</span>
    </div>
  );
}

/** Small pencil button used in section headers to open edit mode. */
function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
        px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300
        transition-colors shadow-sm"
    >
      <Pencil size={12} />
      Edit
    </button>
  );
}


// ─── Languages & Fallback edit form ───────────────────────────────────────────

function LanguagesForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { currentOrg, fetchCurrentOrg } = useAuth();
  const [serverError, setServerError]   = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LanguagesValues>({
    resolver: zodResolver(LanguagesSchema),
    defaultValues: {
      supportedLanguages: (currentOrg?.supportedLanguages as Array<'en-US' | 'hi-IN' | 'pa-IN'>) ?? ['en-US'],
      fallbackNumber:     currentOrg?.fallbackNumber ?? '',
    },
  });

  useEffect(() => {
    if (!currentOrg) return;
    reset({
      supportedLanguages: (currentOrg.supportedLanguages as Array<'en-US' | 'hi-IN' | 'pa-IN'>) ?? ['en-US'],
      fallbackNumber:     currentOrg.fallbackNumber ?? '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  const selectedLangs = watch('supportedLanguages') ?? [];

  async function onSubmit(values: LanguagesValues) {
    setServerError(null);
    try {
      await api.patch('/onboarding/org', {
        step:               'customize',
        supportedLanguages: values.supportedLanguages,
        fallbackNumber:     values.fallbackNumber || undefined,
      });
      await fetchCurrentOrg();
      onSaved();
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setServerError(e.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-5">
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Language checkboxes */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Supported languages</p>
        <div className="space-y-2.5">
          {LANGUAGE_OPTIONS.map(({ code, label }) => {
            const checked = selectedLangs.includes(code);
            return (
              <label
                key={code}
                className="flex items-center gap-3 cursor-pointer select-none group w-fit"
              >
                <span className="relative flex items-center">
                  <input
                    type="checkbox"
                    value={code}
                    {...register('supportedLanguages')}
                    className="sr-only"
                  />
                  <span
                    className={[
                      'h-4 w-4 rounded border-2 flex items-center justify-center transition',
                      checked
                        ? 'border-brand-500 bg-brand-500'
                        : 'border-slate-300 bg-white group-hover:border-brand-400',
                    ].join(' ')}
                  >
                    {checked && (
                      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white fill-current">
                        <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5"
                          fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </span>
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            );
          })}
        </div>
        {errors.supportedLanguages && (
          <p className="mt-2 text-xs text-red-600">{errors.supportedLanguages.message}</p>
        )}
      </div>

      {/* Fallback number */}
      <div>
        <label htmlFor="s-fallback" className="block text-sm font-medium text-slate-700 mb-1">
          Fallback number <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="s-fallback"
          type="tel"
          {...register('fallbackNumber')}
          placeholder="+91 98765 43210"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm
            outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition bg-white"
        />
        <p className="mt-1 text-xs text-slate-400">
          When the AI can't handle a call, it transfers to this number.
        </p>
      </div>

      {/* Form actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5
            text-sm font-semibold text-white hover:bg-brand-700
            disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting
            ? <Loader2 size={14} className="animate-spin" />
            : <Save size={14} />}
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500
            hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Profile form ──────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
});
type ProfileValues = z.infer<typeof ProfileSchema>;

function ProfileForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { user, updateProfile } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { name: user?.name ?? '' },
  });

  async function onSubmit(values: ProfileValues) {
    setServerError(null);
    try {
      await updateProfile({ name: values.name });
      onSaved();
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setServerError(e.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-3 space-y-4">
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor="s-profile-name" className="block text-sm font-medium text-slate-700 mb-1">
          Display name
        </label>
        <input
          id="s-profile-name"
          type="text"
          {...register('name')}
          maxLength={100}
          className={[
            'w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none',
            'focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition',
            errors.name ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white',
          ].join(' ')}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          Your name appears in team member lists and notification emails.
        </p>
      </div>

      {/* Read-only email notice */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        Email address cannot be changed here. Contact support to update your email.
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5
            text-sm font-semibold text-white hover:bg-brand-700
            disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting
            ? <Loader2 size={14} className="animate-spin" />
            : <Save size={14} />}
          {isSubmitting ? 'Saving…' : 'Save name'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500
            hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Change Password form ──────────────────────────────────────────────────────

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
type ChangePasswordValues = z.infer<typeof ChangePasswordSchema>;

function ChangePasswordForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { changePassword } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(values: ChangePasswordValues) {
    setServerError(null);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword:     values.newPassword,
      });
      onSaved();
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setServerError(e.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  }

  function PasswordField({
    id,
    label,
    name,
    show,
    onToggle,
  }: {
    id:       string;
    label:    string;
    name:     keyof ChangePasswordValues;
    show:     boolean;
    onToggle: () => void;
  }) {
    const hasError = !!errors[name];
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            type={show ? 'text' : 'password'}
            {...register(name)}
            autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
            className={[
              'w-full rounded-md border px-3 py-2 pr-10 text-sm shadow-sm outline-none',
              'focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition',
              hasError ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white',
            ].join(' ')}
          />
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400
              hover:text-slate-600 transition-colors"
            tabIndex={-1}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors[name] && (
          <p className="mt-1 text-xs text-red-600">{errors[name]?.message}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-3 space-y-4">
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <PasswordField
        id="s-current-pw"
        label="Current password"
        name="currentPassword"
        show={showCurrent}
        onToggle={() => setShowCurrent((v) => !v)}
      />
      <PasswordField
        id="s-new-pw"
        label="New password"
        name="newPassword"
        show={showNew}
        onToggle={() => setShowNew((v) => !v)}
      />
      <PasswordField
        id="s-confirm-pw"
        label="Confirm new password"
        name="confirmPassword"
        show={showConfirm}
        onToggle={() => setShowConfirm((v) => !v)}
      />

      <p className="text-xs text-slate-400">
        Password must be at least 8 characters, include an uppercase letter and a number.
        Your current session remains active after changing.
      </p>

      <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5
            text-sm font-semibold text-white hover:bg-brand-700
            disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting
            ? <Loader2 size={14} className="animate-spin" />
            : <Save size={14} />}
          {isSubmitting ? 'Updating…' : 'Update password'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500
            hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Phone Number Setup ────────────────────────────────────────────────────────

async function fetchPhoneNumber() {
  const res = await api.get<{
    success: boolean;
    data: { vapiPhoneNumberId: string | null; vapiAssistantId: string | null };
  }>('/agents/phone-number');
  return res.data.data;
}

async function savePhoneNumber(vapiPhoneNumberId: string) {
  const res = await api.post<{
    success: boolean;
    data: { vapiPhoneNumberId: string | null; message: string };
  }>('/agents/phone-number', { vapiPhoneNumberId });
  return res.data.data;
}

function PhoneNumberSetup() {
  const queryClient       = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saved, setSaved]           = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['phoneNumber'],
    queryFn:  fetchPhoneNumber,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: savePhoneNumber,
    onSuccess: () => {
      setSaved(true);
      setSaveError(null);
      setInputValue('');
      void queryClient.invalidateQueries({ queryKey: ['phoneNumber'] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save phone number';
      setSaveError(msg);
    },
  });

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setSaveError('Please enter the Vapi phone number ID');
      return;
    }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(trimmed)) {
      setSaveError('Should look like a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
      return;
    }
    setSaveError(null);
    mutation.mutate(trimmed);
  };

  return (
    <div className="mt-3 space-y-4">
      {/* Status row */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)' }}
        >
          <Phone size={15} className="text-brand-600" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-800">Inbound Call Routing</p>
          {isLoading ? (
            <p className="text-xs text-slate-400 mt-0.5">Loading…</p>
          ) : data?.vapiPhoneNumberId ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">Phone number linked</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-xs text-amber-600 font-medium">No phone number linked yet</span>
            </div>
          )}
        </div>
      </div>

      {data?.vapiPhoneNumberId && (
        <CopyRow label="Linked Phone ID" value={data.vapiPhoneNumberId} />
      )}

      {/* How-to instructions */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500
        leading-relaxed space-y-2">
        <p className="font-semibold text-slate-600">How to connect your Vapi phone number:</p>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            Open the{' '}
            <a
              href="https://dashboard.vapi.ai/phone-numbers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline inline-flex items-center gap-0.5"
            >
              Vapi Phone Numbers dashboard
              <ExternalLink size={10} className="inline" />
            </a>
          </li>
          <li>Buy or import a phone number (Twilio, Vonage, or Vapi-managed)</li>
          <li>
            In the number's settings, set <strong>Server URL</strong> to:<br />
            <code className="bg-white border border-slate-200 rounded px-1.5 py-0.5
              font-mono text-slate-700 text-[10px] break-all">
              https://your-api-domain.com/api/v1/webhooks/vapi
            </code>
          </li>
          <li>Copy the phone number's <strong>ID</strong> (UUID format) and paste it below</li>
        </ol>
      </div>

      {/* Input + save */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600" htmlFor="phoneNumberId">
          Vapi Phone Number ID
        </label>
        <div className="flex gap-2">
          <input
            id="phoneNumberId"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono
              text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
              focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
          <button
            onClick={handleSave}
            disabled={mutation.isPending || !inputValue.trim()}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium
              bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50
              disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : saved
                ? <CheckCircle2 size={14} className="text-emerald-300" />
                : null}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        {saveError && <p className="text-xs text-rose-500">{saveError}</p>}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { currentOrg, currentRole } = useAppSelector((s) => s.org);
  const { user }                    = useAuth();

  // Edit-mode toggles per section
  const [langEdit,      setLangEdit]      = useState(false);
  const [langSaved,     setLangSaved]     = useState(false);
  const [profileEdit,   setProfileEdit]   = useState(false);
  const [profileSaved,  setProfileSaved]  = useState(false);
  const [passwordEdit,  setPasswordEdit]  = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  function handleLangSaved() {
    setLangEdit(false);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 3500);
  }

  function handleProfileSaved() {
    setProfileEdit(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3500);
  }

  function handlePasswordSaved() {
    setPasswordEdit(false);
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 3500);
  }

  // Derived display values
  const LANG_LABELS: Record<string, string> = {
    'en-US': 'English',
    'hi-IN': 'Hindi',
    'pa-IN': 'Punjabi',
  };
  const langsDisplay = (currentOrg?.supportedLanguages ?? [])
    .map((l) => LANG_LABELS[l] ?? l)
    .join(', ') || '—';

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your organisation's configuration, voice settings, and phone number.
        </p>
      </div>

      {/* ── 1. Organisation Profile ──────────────────────────────────────── */}
      <Section title="Organisation Profile">
        <div className="flex items-center gap-4 mb-4 mt-3 pb-4 border-b border-slate-50">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl
              text-lg font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            {currentOrg?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 truncate">
              {currentOrg?.name ?? '—'}
            </p>
            <p className="text-xs text-slate-400 font-mono">{currentOrg?.slug}</p>
          </div>
          {currentRole && (
            <span className="flex-shrink-0 rounded-full border border-brand-100 bg-brand-50
              px-2.5 py-1 text-xs font-semibold text-brand-700">
              {currentRole}
            </span>
          )}
        </div>
        <InfoRow label="Industry"  value={currentOrg?.industry} />
        <InfoRow label="Timezone"  value={currentOrg?.timezone} />
        {currentOrg?.websiteUrl && (
          <InfoRow label="Website" value={currentOrg.websiteUrl} />
        )}
      </Section>

      {/* ── 2. Languages & Fallback ──────────────────────────────────────── */}
      <Section
        title="Languages &amp; Fallback"
        action={
          !langEdit
            ? <EditButton onClick={() => { setLangEdit(true); setLangSaved(false); }} />
            : undefined
        }
      >
        {langSaved && <SavedBanner />}

        {langEdit ? (
          <LanguagesForm
            onSaved={handleLangSaved}
            onCancel={() => setLangEdit(false)}
          />
        ) : (
          <div className="mt-2">
            <InfoRow label="Languages"       value={langsDisplay} />
            <InfoRow label="Fallback number" value={currentOrg?.fallbackNumber} />
          </div>
        )}
      </Section>

      {/* ── 3. Phone Number Setup ────────────────────────────────────────── */}
      <Section title="Phone Number Setup">
        <PhoneNumberSetup />
      </Section>

      {/* ── 4. Technical Details ─────────────────────────────────────────── */}
      <Section title="Technical Details">
        <div className="mt-2">
          <CopyRow label="Organisation ID" value={currentOrg?.id} />
          <CopyRow label="Vapi Agent ID"   value={currentOrg?.vapiAssistantId} />
          <InfoRow
            label="Created"
            value={
              currentOrg?.createdAt
                ? new Date(currentOrg.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : undefined
            }
          />
          <InfoRow label="Onboarding" value={currentOrg?.onboardingStatus} />
        </div>
      </Section>

      {/* ── 5. Profile ───────────────────────────────────────────────────── */}
      <Section
        title="Profile"
        action={
          !profileEdit
            ? <EditButton onClick={() => { setProfileEdit(true); setProfileSaved(false); }} />
            : undefined
        }
      >
        {profileSaved && <SavedBanner />}

        {profileEdit ? (
          <ProfileForm
            onSaved={handleProfileSaved}
            onCancel={() => setProfileEdit(false)}
          />
        ) : (
          <div className="mt-2">
            <InfoRow label="Name"  value={user?.name} />
            <InfoRow label="Email" value={user?.email} />
            <InfoRow label="Role"  value={currentRole ?? undefined} />
          </div>
        )}
      </Section>

      {/* ── 6. Security ──────────────────────────────────────────────────── */}
      <Section
        title="Security"
        action={
          !passwordEdit
            ? (
              <button
                onClick={() => { setPasswordEdit(true); setPasswordSaved(false); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white
                  px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50
                  hover:border-slate-300 transition-colors shadow-sm"
              >
                Change password
              </button>
            )
            : undefined
        }
      >
        {passwordSaved && <SavedBanner message="Password updated successfully." />}

        {passwordEdit ? (
          <ChangePasswordForm
            onSaved={handlePasswordSaved}
            onCancel={() => setPasswordEdit(false)}
          />
        ) : (
          <div className="mt-2">
            <div className="flex items-start justify-between gap-4 py-3">
              <span className="text-xs font-medium text-slate-400 w-40 flex-shrink-0 pt-0.5">Password</span>
              <span className="text-sm text-slate-400 tracking-widest select-none">••••••••</span>
            </div>
            <p className="text-xs text-slate-400 pb-1">
              Click "Change password" above to set a new password. You'll need your current password.
            </p>
          </div>
        )}
      </Section>

    </div>
  );
}
