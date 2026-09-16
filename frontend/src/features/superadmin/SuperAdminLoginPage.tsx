/**
 * SuperAdminLoginPage
 * Visually identical to LoginPage — same AuthLayout, same Tailwind classes.
 * Differences: identifier is a plain text field (not email-validated),
 * no "Forgot password?" / "Sign up" links, calls /superadmin/auth/login.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '@/utils/api';
import { AxiosError } from 'axios';

// ─── Schema (identifier is plain text, not email-validated) ──────────────────
const SALoginSchema = z.object({
  email:    z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
type SALoginValues = z.infer<typeof SALoginSchema>;

// ─── Component ────────────────────────────────────────────────────────────────
export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError]   = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SALoginValues>({
    resolver: zodResolver(SALoginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SALoginValues) {
    setServerError(null);
    try {
      await api.post('/superadmin/auth/login', {
        email:    values.email,
        password: values.password,
      });
      navigate('/superadmin', { replace: true });
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; code?: string }>;
      if (!axiosErr.response) {
        setServerError('Unable to connect to the server. Please try again in a moment.');
        return;
      }
      const code = axiosErr.response.data?.code;
      if (code === 'NOT_SUPER_ADMIN' || code === 'UNAUTHORIZED' || axiosErr.response.status === 401) {
        setServerError('Invalid username or password.');
      } else if (code === 'ACCOUNT_SUSPENDED') {
        setServerError('This account has been suspended.');
      } else {
        setServerError(axiosErr.response.data?.message ?? 'Something went wrong. Please try again.');
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Username / identifier */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            Username
          </label>
          <input
            id="email"
            type="text"
            autoComplete="username"
            {...register('email')}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition
              ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'}`}
            placeholder="Enter your username"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-600
            px-4 py-2.5 text-sm font-semibold text-white shadow-sm
            hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500
            disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
