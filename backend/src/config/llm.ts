/**
 * LLM model registry — single source of truth for the model every voice agent uses.
 *
 * Why this exists: the model was hard-coded as 'gpt-4o' in four places
 * (provision, adopt, voice/language update, KB sync) with two different
 * temperatures (0.3 and 0.65). GPT-4o is ~16× the per-token price of
 * GPT-4o-mini and was the largest provider cost per call-minute.
 *
 * Choose the model with LLM_MODEL in backend/.env (default: gpt-4o-mini).
 * Changing it only affects assistants pushed AFTER the change — run
 * `npx tsx scripts/resync-assistants.ts` to re-push every org's assistant.
 *
 * List prices (USD per 1M tokens, checked 2026-10-02 — update when providers reprice):
 *   gpt-4o-mini       in $0.15 · cached $0.075 · out $0.60
 *   gpt-4.1-mini      in $0.40 · cached $0.10  · out $1.60
 *   gemini-2.5-flash  in $0.30 · cached $0.03  · out $2.50
 *   gpt-4o (legacy)   in $2.50 · cached $1.25  · out $10.00
 */

import { env } from './env';

export type LlmProvider = 'openai' | 'google';

export interface LlmModelDef {
  provider:          LlmProvider;
  model:             string;
  label:             string;
  inputUsdPerM:      number;
  cachedInputUsdPerM: number;
  outputUsdPerM:     number;
}

export const LLM_MODELS = {
  'gpt-4o-mini':      { provider: 'openai', model: 'gpt-4o-mini',      label: 'GPT-4o mini (default)', inputUsdPerM: 0.15, cachedInputUsdPerM: 0.075, outputUsdPerM: 0.60 },
  'gpt-4.1-mini':     { provider: 'openai', model: 'gpt-4.1-mini',     label: 'GPT-4.1 mini',          inputUsdPerM: 0.40, cachedInputUsdPerM: 0.10,  outputUsdPerM: 1.60 },
  'gemini-2.5-flash': { provider: 'google', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash',      inputUsdPerM: 0.30, cachedInputUsdPerM: 0.03,  outputUsdPerM: 2.50 },
  'gpt-4o':           { provider: 'openai', model: 'gpt-4o',           label: 'GPT-4o (legacy, ~16× cost)', inputUsdPerM: 2.50, cachedInputUsdPerM: 1.25, outputUsdPerM: 10.00 },
} as const satisfies Record<string, LlmModelDef>;

export type LlmModelId = keyof typeof LLM_MODELS;

export const DEFAULT_LLM_MODEL: LlmModelId = 'gpt-4o-mini';

/**
 * Temperature for live voice agents. Low on purpose: an order-taking receptionist
 * must quote catalog prices exactly, and small models drift more at high temperature.
 */
export const VOICE_AGENT_TEMPERATURE = 0.3;

/** Spoken replies are short; 300 output tokens is ~200 words of headroom. */
export const VOICE_AGENT_MAX_TOKENS = 300;

/** Resolves the model for live voice agents from LLM_MODEL (falls back to the default). */
export function getVoiceAgentModel(): LlmModelDef {
  return LLM_MODELS[env.LLM_MODEL] ?? LLM_MODELS[DEFAULT_LLM_MODEL];
}
