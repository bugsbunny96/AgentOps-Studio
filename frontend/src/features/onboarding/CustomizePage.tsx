/**
 * L2.F4 — CustomizePage (Onboarding Step 4: Customize)
 *
 * Collects:
 *  • Voice provider + specific voice  (via VoiceSelector)
 *  • Supported languages              (via VoiceSelector)
 *  • Fallback phone number            (optional text field)
 *
 * On submit → PATCH /api/v1/onboarding/org { step: 'customize', ... } → /onboarding/activate
 */

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mic } from 'lucide-react';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';
import VoiceSelector, { type VoiceSelectorValue } from '@/features/agents/VoiceSelector';
import type { VoiceProviderId, LanguageCode } from '@/features/agents/voice-catalog';

// ─── Form schema ─────────────────────────────────────────────────────────────

const CustomizeSchema = z.object({
  voiceProvider: z.enum(['openai', 'elevenlabs', 'cartesia', 'azure'] as const),
  voiceId: z.string().min(1),
  supportedLanguages: z
    .array(z.enum(['en-US', 'hi-IN', 'pa-IN'] as const))
    .min(1, 'Select at least one language for your AI agent'),
  fallbackNumber: z.string().optional(),
});

type CustomizeFormValues = z.infer<typeof CustomizeSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomizePage() {
  const { updateOnboardingStep, currentOrg } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomizeFormValues>({
    resolver: zodResolver(CustomizeSchema),
    defaultValues: {
      voiceProvider: (currentOrg?.preferredVoiceProvider as VoiceProviderId) ?? 'openai',
      voiceId:       (currentOrg?.preferredVoiceId as string) ?? 'nova',
      supportedLanguages: (currentOrg?.supportedLanguages as LanguageCode[]) ?? ['en-US'],
      fallbackNumber: currentOrg?.fallbackNumber ?? '',
    },
  });

  // Re-populate when currentOrg hydrates from the async fetchCurrentOrg() call
  useEffect(() => {
    if (!currentOrg) return;
    reset({
      voiceProvider: (currentOrg.preferredVoiceProvider as VoiceProviderId) ?? 'openai',
      voiceId:       (currentOrg.preferredVoiceId as string) ?? 'nova',
      supportedLanguages: (currentOrg.supportedLanguages as LanguageCode[]) ?? ['en-US'],
      fallbackNumber: currentOrg.fallbackNumber ?? '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  async function onSubmit(values: CustomizeFormValues) {
    setServerError(null);
    try {
      await updateOnboardingStep(
        {
          step: 'customize',
          voiceProvider: values.voiceProvider,
          voiceId: values.voiceId,
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
            Choose your agent's voice and the languages it will speak. You can change these any time from Agent Details.
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
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">

        {/* Voice selector (provider + voice + languages) */}
        <Controller
          name="voiceProvider"
          control={control}
          render={({ field: providerField }) => (
            <Controller
              name="voiceId"
              control={control}
              render={({ field: voiceField }) => (
                <Controller
                  name="supportedLanguages"
                  control={control}
                  render={({ field: langsField }) => {
                    const selectorValue: VoiceSelectorValue = {
                      voiceProvider: providerField.value,
                      voiceId: voiceField.value,
                      supportedLanguages: langsField.value,
                    };
                    return (
                      <VoiceSelector
                        value={selectorValue}
                        onChange={(next) => {
                          providerField.onChange(next.voiceProvider);
                          voiceField.onChange(next.voiceId);
                          langsField.onChange(next.supportedLanguages);
                        }}
                        disabled={isSubmitting}
                      />
                    );
                  }}
                />
              )}
            />
          )}
        />

        {errors.supportedLanguages && (
          <p className="text-xs text-red-600">{errors.supportedLanguages.message}</p>
        )}

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
