/**
 * VoiceSelector.tsx
 *
 * Reusable controlled component for picking:
 *  1. Voice provider  (tabs)
 *  2. Specific voice  (card grid with play/pause preview)
 *  3. Supported languages  (checkbox list)
 *
 * Used in:
 *  • AgentDetailPage — edit-mode panel
 *  • CustomizePage   — onboarding step 4
 *
 * Props
 *  value    — { voiceProvider, voiceId, supportedLanguages }
 *  onChange — called whenever any selection changes
 *  disabled — greys out the whole component (e.g. while saving)
 */

import { useState, useRef, useCallback } from 'react';
import { Play, Pause, Loader2, Volume2 } from 'lucide-react';
import { api } from '@/utils/api';
import { AxiosError } from 'axios';
import {
  VOICE_CATALOG,
  LANGUAGE_OPTIONS,
  defaultVoiceForProvider,
  type VoiceProviderId,
  type LanguageCode,
} from './voice-catalog';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceSelectorValue {
  voiceProvider: VoiceProviderId;
  voiceId: string;
  supportedLanguages: LanguageCode[];
}

interface VoiceSelectorProps {
  value: VoiceSelectorValue;
  onChange: (value: VoiceSelectorValue) => void;
  disabled?: boolean;
}

// ─── Audio preview state (one audio element, shared across voice cards) ───────

type PreviewState = 'idle' | 'loading' | 'playing';

// ─── Component ───────────────────────────────────────────────────────────────

export default function VoiceSelector({ value, onChange, disabled = false }: VoiceSelectorProps) {
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [previewState, setPreviewState]     = useState<PreviewState>('idle');
  const [previewError, setPreviewError]     = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const provider = VOICE_CATALOG.find((p) => p.id === value.voiceProvider) ?? VOICE_CATALOG[0]!;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function stopCurrentAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended  = null;
      audioRef.current.onerror  = null;
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPreviewVoiceId(null);
    setPreviewState('idle');
  }

  const handlePreview = useCallback(async (voiceId: string) => {
    // If same voice is playing → stop
    if (previewVoiceId === voiceId && previewState === 'playing') {
      stopCurrentAudio();
      return;
    }

    // Stop any playing audio first
    stopCurrentAudio();
    setPreviewError(null);
    setPreviewVoiceId(voiceId);
    setPreviewState('loading');

    try {
      const res = await api.get<Blob>('/agents/voice-preview', {
        // Pass the current provider so backend routes to the right TTS engine
        params: { provider: value.voiceProvider, voiceId },
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(res.data);
      blobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      audio.onended = () => {
        stopCurrentAudio();
      };
      audio.onerror = () => {
        setPreviewState('idle');
        setPreviewError('Audio playback failed — try again');
      };

      await audio.play();
      setPreviewState('playing');
    } catch (err) {
      setPreviewState('idle');
      setPreviewVoiceId(null);
      // Surface the server's specific error message (e.g. quota exceeded)
      const axiosErr = err as AxiosError<{ message?: string }>;
      const serverMsg = axiosErr.response?.data?.message;
      setPreviewError(serverMsg ?? 'Could not load voice preview');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewVoiceId, previewState, value.voiceProvider]);

  // ── Provider tab click ───────────────────────────────────────────────────────

  function handleProviderChange(providerId: VoiceProviderId) {
    stopCurrentAudio();
    setPreviewError(null);
    onChange({
      ...value,
      voiceProvider: providerId,
      voiceId: defaultVoiceForProvider(providerId),
    });
  }

  // ── Voice card click ─────────────────────────────────────────────────────────

  function handleVoiceChange(voiceId: string) {
    if (previewVoiceId && previewVoiceId !== voiceId) stopCurrentAudio();
    onChange({ ...value, voiceId });
  }

  // ── Language toggle ──────────────────────────────────────────────────────────

  function toggleLanguage(code: LanguageCode) {
    const current = value.supportedLanguages;
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : ([...current, code] as LanguageCode[]);
    if (next.length === 0) return; // always keep at least one
    onChange({ ...value, supportedLanguages: next });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <fieldset disabled={disabled} className="space-y-6 disabled:opacity-60">

      {/* ── Provider tabs ───────────────────────────────────────────────────── */}
      <div>
        <p className="block text-sm font-medium text-slate-700 mb-2">Voice provider</p>
        <div className="flex flex-wrap gap-2">
          {VOICE_CATALOG.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderChange(p.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition
                ${value.voiceProvider === p.id
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              {p.label}
              <span className={`rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide
                ${value.voiceProvider === p.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                {p.badge}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">{provider.tagline}</p>

        {/* Language compatibility warning — Deepgram Aura is English-only */}
        {value.voiceProvider === 'deepgram' &&
          value.supportedLanguages.some((l) => l !== 'en-US') && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <span className="mt-0.5 flex-shrink-0">⚠️</span>
            <span>
              <strong>Deepgram Aura is English-only.</strong> Your agent has non-English languages selected.
              Switch to <strong>OpenAI</strong>, <strong>ElevenLabs</strong>, or <strong>Azure Multilingual</strong> for
              Hindi / Punjabi support.
            </span>
          </div>
        )}

        {/* Critical warning — selected voice cannot speak Hindi/Punjabi */}
        {value.supportedLanguages.some((l) => l !== 'en-US') && (() => {
          const selectedVoice = provider.voices.find((v) => v.id === value.voiceId);
          if (selectedVoice && selectedVoice.supportsHindi === false) {
            return (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <span className="mt-0.5 flex-shrink-0">🚨</span>
                <span>
                  <strong>"{selectedVoice.name}" cannot speak Hindi or Punjabi.</strong>{' '}
                  This voice is English-only — callers speaking Hindi/Punjabi will hear garbled audio.{' '}
                  Switch to an <strong>OpenAI</strong> or <strong>ElevenLabs</strong> voice, or pick an{' '}
                  <strong>Azure (Multi)</strong> voice above.
                </span>
              </div>
            );
          }
          return null;
        })()}

        {/* Key-required notice for providers that need Vapi dashboard setup */}
        {!provider.noKeyRequired && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <span className="mt-0.5 flex-shrink-0">ℹ️</span>
            <span>
              {provider.label} requires your API key configured in the{' '}
              <strong>Vapi dashboard → Provider Keys</strong> before this voice will work on calls.
            </span>
          </div>
        )}
      </div>

      {/* ── Voice grid ─────────────────────────────────────────────────────── */}
      <div>
        <p className="block text-sm font-medium text-slate-700 mb-2">Voice</p>
        {previewError && (
          <p className="mb-2 text-xs text-amber-600">{previewError}</p>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {provider.voices.map((voice) => {
            const isSelected  = value.voiceId === voice.id;
            const isThisPlaying  = previewVoiceId === voice.id && previewState === 'playing';
            const isThisLoading  = previewVoiceId === voice.id && previewState === 'loading';

            return (
              <div
                key={voice.id}
                onClick={() => handleVoiceChange(voice.id)}
                className={`relative flex cursor-pointer items-start gap-3 rounded-lg border-2 px-3 py-3 transition
                  ${isSelected
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
              >
                {/* Selection indicator */}
                <span
                  className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition
                    ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`}
                >
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-medium ${isSelected ? 'text-brand-700' : 'text-slate-700'}`}>
                      {voice.name}
                    </span>
                    <span className={`text-[10px] font-medium uppercase tracking-wide px-1 rounded
                      ${voice.gender === 'female' ? 'bg-pink-50 text-pink-600'
                        : voice.gender === 'male' ? 'bg-blue-50 text-blue-600'
                        : 'bg-slate-100 text-slate-500'}`}>
                      {voice.gender}
                    </span>
                    <span className="text-[10px] text-slate-400">{voice.accent}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{voice.description}</p>
                </div>

                {/* Play/Pause preview button — available for OpenAI and Deepgram */}
                {voice.previewAvailable ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handlePreview(voice.id);
                    }}
                    title={isThisPlaying ? 'Stop preview' : 'Preview voice'}
                    className={`flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full border transition
                      ${isThisPlaying || isThisLoading
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-500'
                      }`}
                  >
                    {isThisLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isThisPlaying ? (
                      <Pause size={12} />
                    ) : (
                      <Play size={12} />
                    )}
                  </button>
                ) : (
                  // Clickable info button for providers without server-side preview
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewError(
                        `${provider.label} voices can't be previewed here — save your selection and make a test call to hear this voice.`
                      );
                    }}
                    title={`${provider.label} preview: make a test call to hear this voice`}
                    className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-500 transition"
                  >
                    <Volume2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!provider.voices.some((v) => v.previewAvailable) && (
          <p className="mt-2 text-xs text-slate-400">
            {provider.label} voices don't support server-side preview. Save your selection and make a test call to hear the voice.
          </p>
        )}
      </div>

      {/* ── Language multi-select ────────────────────────────────────────────── */}
      <div>
        <p className="block text-sm font-medium text-slate-700 mb-1">
          Supported languages <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-slate-400 mb-2">
          Your AI agent will auto-detect and reply in the caller's language.
        </p>
        <div className="space-y-2">
          {LANGUAGE_OPTIONS.map(({ code, label, sublabel, flag }) => {
            const isChecked = value.supportedLanguages.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleLanguage(code)}
                className={`w-full flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition
                  ${isChecked
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox indicator */}
                  <span
                    className={`h-4 w-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition
                      ${isChecked ? 'border-brand-500 bg-brand-500' : 'border-slate-300'}`}
                  >
                    {isChecked && (
                      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 text-white fill-current">
                        <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.5" fill="none"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-base">{flag}</span>
                  <span>
                    <span className={`text-sm font-medium ${isChecked ? 'text-brand-700' : 'text-slate-700'}`}>
                      {label}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{sublabel}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {value.supportedLanguages.length === 0 && (
          <p className="mt-2 text-xs text-red-600">Select at least one language</p>
        )}
      </div>

    </fieldset>
  );
}
