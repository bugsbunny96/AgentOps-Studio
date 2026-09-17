import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/utils/api';
import { AxiosError } from 'axios';

// ─── Form schema ───────────────────────────────────────────────────────────
const ResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof ResetPasswordSchema>;

// ─── Component ────────────────────────────────────────────────────────────
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // ─── No token in URL ─────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <XCircle size={48} className="text-red-500" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">Invalid reset link</h2>
            <p className="mt-2 text-sm text-slate-500">
              This reset link is missing a token. Please request a new one.
            </p>
          </div>
        </div>
        <Link
          to="/forgot-password"
          className="block text-center text-sm font-medium text-brand-600 hover:underline"
        >
          Request a new reset link →
        </Link>
      </div>
    );
  }

  // ─── Success state ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <CheckCircle2 size={48} className="text-green-500" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">Password updated!</h2>
            <p className="mt-2 text-sm text-slate-500">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-600
            px-4 py-2.5 text-sm font-semibold text-white shadow-sm
            hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
        >
          Sign in →
        </button>
      </div>
    );
  }

  // ─── Reset form ──────────────────────────────────────────────────────────
  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: values.password,
      });
      setSuccess(true);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; code?: string }>;
      const code = axiosErr.response?.data?.code;
      if (code === 'INVALID_RESET_TOKEN') {
        setServerError(
          'This reset link has expired or already been used. Please request a new one.'
        );
      } else {
        setServerError(
          axiosErr.response?.data?.message ?? 'Something went wrong. Please try again.'
        );
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a strong password you haven't used before.
        </p>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {serverError}{' '}
          {serverError.includes('expired') && (
            <Link to="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* New password */}
        <div>
          <label
            htmlFor="reset-password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${errors.password ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            placeholder="At least 8 characters"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label
            htmlFor="reset-confirm"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Confirm new password
          </label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${errors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            placeholder="Repeat the password"
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
          {isSubmitting ? 'Updating password…' : 'Reset password'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
