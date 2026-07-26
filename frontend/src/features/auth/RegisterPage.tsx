import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { api } from '@/utils/api';
import { AxiosError } from 'axios';

// ─── Form schema ───────────────────────────────────────────────────────────
const RegisterSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Minimum 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type RegisterFormValues = z.infer<typeof RegisterSchema>;

// ─── Component ────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate            = useNavigate();
  const [searchParams]      = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError]   = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);

  // ?email pre-fills the form when coming from an invite link
  // ?next is preserved and forwarded to the login page after verification
  const prefilledEmail = searchParams.get('email') ?? '';
  const nextPath       = searchParams.get('next')  ?? '';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      name:            '',
      email:           prefilledEmail,
      password:        '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  const rules = [
    { label: '8+ characters',    ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number',           ok: /[0-9]/.test(password) },
  ];

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    try {
      await api.post('/auth/register', {
        name:      values.name,
        email:     values.email,
        password:  values.password,
        // Forwarded into the verification email URL so the invite chain survives
        ...(nextPath    && { next:      nextPath }),
        ...(prefilledEmail && { emailHint: prefilledEmail }),
      });
      setSuccess(true);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; code?: string }>;
      const code = axiosErr.response?.data?.code;
      if (code === 'EMAIL_TAKEN') {
        setServerError('An account with this email already exists. Try signing in.');
      } else {
        setServerError(
          axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.'
        );
      }
    }
  }

  // Build the post-verification login URL, preserving ?next and ?email
  function buildLoginUrl() {
    const params = new URLSearchParams();
    if (nextPath)       params.set('next',  nextPath);
    if (prefilledEmail) params.set('email', prefilledEmail);
    const qs = params.toString();
    return qs ? `/login?${qs}` : '/login';
  }

  // ─── Success state: "Check your inbox" ────────────────────────────────────
  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 border border-brand-100">
            <Mail size={28} className="text-brand-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Check your inbox</h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              We've sent a verification link to <strong>{prefilledEmail || 'your email'}</strong>.
              Click it to activate your account, then sign in to continue.
            </p>
            {nextPath && (
              <p className="mt-2 text-xs text-brand-600 font-medium">
                After verifying, you'll be taken straight back to accept the invitation.
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate(buildLoginUrl())}
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold
            text-white hover:bg-brand-700 transition"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  // ─── Invite context banner ─────────────────────────────────────────────────
  const showInviteBanner = Boolean(prefilledEmail && nextPath);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          {showInviteBanner
            ? 'Create an account to accept your invitation.'
            : 'Start your 14-day free trial. No credit card required.'}
        </p>
      </div>

      {/* Invite context banner — shown when coming from an invite link */}
      {showInviteBanner && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-brand-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-brand-700 leading-relaxed">
            <strong>You have a pending invitation.</strong> Create your account using{' '}
            <strong>{prefilledEmail}</strong> and you'll be added to the workspace automatically.
          </div>
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            {...register('name')}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            placeholder="Jane Smith"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        {/* Email — readonly if pre-filled from invite */}
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1">
            Work email
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            readOnly={Boolean(prefilledEmail)}
            {...register('email')}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${prefilledEmail ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}
              ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
            placeholder="you@company.com"
          />
          {prefilledEmail && (
            <p className="mt-1 text-xs text-slate-400">
              This email matches your invitation and cannot be changed.
            </p>
          )}
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
              className={`w-full rounded-md border px-3 py-2 pr-10 text-sm shadow-sm outline-none
                focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
                ${errors.password ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="mt-2 flex gap-4 flex-wrap">
              {rules.map((r) => (
                <span
                  key={r.label}
                  className={`text-xs flex items-center gap-1 ${r.ok ? 'text-green-600' : 'text-slate-400'}`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${r.ok ? 'bg-green-500' : 'bg-slate-300'}`} />
                  {r.label}
                </span>
              ))}
            </div>
          )}
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${errors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-600
            px-4 py-2.5 text-sm font-semibold text-white shadow-sm
            hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500
            disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to={buildLoginUrl()} className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
