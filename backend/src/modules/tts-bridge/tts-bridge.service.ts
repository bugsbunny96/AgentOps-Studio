/**
 * TTS Bridge Service — bridges Vapi's custom-voice protocol to Sarvam AI's Bulbul v3 TTS.
 *
 * In production:
 * - Set SARVAM_API_KEY + SARVAM_BRIDGE_URL to activate.
 * - The Vapi assistant is configured with provider: "custom-voice" pointing at
 *   /api/tts/synthesize on this server.
 * - Sarvam returns WAV audio; we strip the WAV header and return raw PCM16LE mono
 *   as Vapi requires (application/octet-stream).
 *
 * Without SARVAM_API_KEY:
 * - Falls back to silence PCM so the rest of the call pipeline still functions.
 * - This is safe for development / staging environments.
 *
 * Protocol reference: https://docs.vapi.ai/customization/custom-voices/custom-tts
 * Sarvam SDK docs:    https://docs.sarvam.ai/api-reference-docs/text-to-speech
 */

import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SynthesizeOptions {
  /** Text to synthesise. */
  text: string;
  /** PCM sample rate in Hz. Vapi typically sends 24000 Hz. */
  sampleRate?: number;
}

export interface SynthesizeResult {
  /** Raw PCM16LE mono buffer ready to stream back to Vapi. */
  pcm: Buffer;
  /** Milliseconds taken for the synthesis round-trip. */
  elapsedMs: number;
  /** Whether the real Sarvam API was used (false = silence fallback). */
  usedSarvam: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips the WAV container headers to extract raw PCM data.
 * Direct port of sarvam-bridge/audio-utils.js wavToRawPcm().
 *
 * WAV format: [RIFF chunk][fmt chunk][data chunk]
 * We scan for the "data" marker and read the payload after the 8-byte sub-chunk header.
 */
export function wavToRawPcm(wavBuf: Buffer): Buffer {
  const dataIdx = wavBuf.indexOf('data');
  if (dataIdx === -1) {
    // Not a WAV container — return as-is (shouldn't happen with Sarvam)
    return wavBuf;
  }
  const dataLength = wavBuf.readUInt32LE(dataIdx + 4);
  const dataStart  = dataIdx + 8;
  return wavBuf.subarray(dataStart, dataStart + dataLength);
}

/**
 * Generate a silent PCM16LE buffer.
 * Used as a fallback when SARVAM_API_KEY is not set.
 */
function generateSilencePcm(text: string, sampleRate: number): Buffer {
  // Rough duration: ~50ms per character, capped at 10 s
  const durationSeconds = Math.min(text.length * 0.05, 10);
  const numSamples = Math.floor(sampleRate * durationSeconds);
  return Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample, zero-filled = silence
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Synthesise text to PCM16LE audio using Sarvam Bulbul v3.
 *
 * Falls back to silence when SARVAM_API_KEY is absent so the pipeline
 * works end-to-end in development without real credentials.
 */
export async function synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
  const { text, sampleRate = 24000 } = options;
  const t0 = Date.now();

  if (!env.SARVAM_API_KEY) {
    logger.warn('[tts-bridge] SARVAM_API_KEY not set — returning silence PCM (dev fallback)');
    const pcm = generateSilencePcm(text, sampleRate);
    return { pcm, elapsedMs: Date.now() - t0, usedSarvam: false };
  }

  try {
    // Dynamic import so sarvamai is optional — if the package isn't installed,
    // the fallback path above catches the missing API key first anyway.
    // When deploying to production: npm install sarvamai
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SarvamAI } = require('sarvamai') as { SarvamAI: new (opts: { apiSubscriptionKey: string }) => unknown };

    const client = new SarvamAI({ apiSubscriptionKey: env.SARVAM_API_KEY }) as {
      textToSpeech: {
        convert: (params: {
          text: string;
          model: string;
          language_code: string;
          speaker: string;
          speech_sample_rate: number;
          output_audio_codec: string;
        }) => Promise<{ audios: string[] }>;
      };
    };

    const response = await client.textToSpeech.convert({
      text,
      model:              env.TTS_MODEL         ?? 'bulbul:v3',
      language_code:      env.TTS_LANGUAGE_CODE ?? 'hi-IN',
      speaker:            env.TTS_SPEAKER       ?? 'shubh',
      speech_sample_rate: sampleRate,
      output_audio_codec: 'wav',
    });

    // Sarvam returns base64-encoded WAV chunks — decode, concatenate, strip headers
    const wavBuf = Buffer.from(response.audios.join(''), 'base64');
    const pcm    = wavToRawPcm(wavBuf);

    const elapsedMs = Date.now() - t0;
    logger.info(
      `[tts-bridge] synthesized ${text.length} chars in ${elapsedMs}ms at ${sampleRate}Hz | ` +
      `"${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`,
    );

    return { pcm, elapsedMs, usedSarvam: true };
  } catch (err) {
    logger.error('[tts-bridge] Sarvam synthesis failed — returning silence fallback', { err });
    const pcm = generateSilencePcm(text, sampleRate);
    return { pcm, elapsedMs: Date.now() - t0, usedSarvam: false };
  }
}
