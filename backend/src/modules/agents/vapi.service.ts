/**
 * Vapi REST API wrapper
 *
 * Thin wrapper around https://api.vapi.ai using Node 20 native fetch.
 * All calls require the private VAPI_API_KEY (server-side only — never expose to browser).
 *
 * Docs: https://docs.vapi.ai/api-reference/assistants/create
 */

import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const VAPI_BASE = 'https://api.vapi.ai';
const FETCH_TIMEOUT_MS = 15_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VapiModel {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface VapiTranscriber {
  provider: 'deepgram' | 'assembly-ai';
  language?: string;
  model?: string;
}

export interface VapiVoice {
  provider: 'openai' | '11labs' | 'azure' | 'cartesia';
  voiceId: string;
  speed?: number;
}

export interface VapiCreateAssistantPayload {
  name: string;
  model: VapiModel;
  transcriber?: VapiTranscriber;
  voice?: VapiVoice;
  firstMessage?: string;
  firstMessageMode?: 'assistant-speaks-first' | 'assistant-waits-for-user';
  endCallMessage?: string;
  endCallPhrases?: string[];
  maxDurationSeconds?: number;
  backgroundSound?: 'office' | 'off';
  metadata?: Record<string, unknown>;
}

export interface VapiAssistant {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface VapiWebCall {
  id: string;
  type: string;
  webCallUrl: string;
  status: string;
  assistantId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function vapiHeaders() {
  if (!env.VAPI_API_KEY) throw new Error('VAPI_API_KEY is not configured');
  return {
    Authorization: `Bearer ${env.VAPI_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function vapiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${VAPI_BASE}${path}`, {
      method,
      headers: vapiHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Vapi API ${resp.status} on ${method} ${path}: ${text.slice(0, 300)}`);
    }

    if (resp.status === 204) return undefined as T;
    return resp.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a Vapi assistant and return the full assistant object (including id).
 * The created assistant is immediately visible in the Vapi dashboard.
 */
export async function vapiCreateAssistant(
  payload: VapiCreateAssistantPayload,
): Promise<VapiAssistant> {
  logger.info('Creating Vapi assistant', { name: payload.name });
  const assistant = await vapiRequest<VapiAssistant>('POST', '/assistant', payload);
  logger.info('Vapi assistant created', { vapiAssistantId: assistant.id });
  return assistant;
}

/**
 * Update an existing Vapi assistant (e.g., after org data changes).
 */
export async function vapiUpdateAssistant(
  assistantId: string,
  payload: Partial<VapiCreateAssistantPayload>,
): Promise<VapiAssistant> {
  return vapiRequest<VapiAssistant>('PATCH', `/assistant/${assistantId}`, payload);
}

/**
 * Delete a Vapi assistant. 404 is treated as success (already gone).
 */
export async function vapiDeleteAssistant(assistantId: string): Promise<void> {
  try {
    await vapiRequest<void>('DELETE', `/assistant/${assistantId}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) return;  // already deleted
    throw err;
  }
}

/**
 * Create a Vapi web call for browser-based testing.
 * Returns a webCallUrl that the frontend Vapi SDK can connect to.
 */
export async function vapiCreateWebCall(assistantId: string): Promise<VapiWebCall> {
  logger.info('Creating Vapi web call', { assistantId });
  return vapiRequest<VapiWebCall>('POST', '/call', {
    type: 'webCall',
    assistantId,
  });
}
