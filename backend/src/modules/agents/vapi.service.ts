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
  /** Vapi pre-attached server tool IDs (e.g. end_call, submit_order) */
  toolIds?: string[];
}

export interface VapiTranscriber {
  provider: 'deepgram' | 'assembly-ai';
  /**
   * STT language code or 'multi' for Deepgram multi-language detection.
   * Use 'multi' for English + Hindi support via Deepgram nova-3.
   */
  language?: string;
  model?: string;
}

export interface VapiVoice {
  provider: 'openai' | '11labs' | 'azure' | 'cartesia' | 'deepgram' | 'playht' | 'vapi' | 'custom-voice';
  voiceId?: string;
  speed?: number;
  /** Provider-specific TTS model. Required for ElevenLabs multilingual: 'eleven_multilingual_v2' */
  model?: string;
  /** Vapi native voice version, e.g. '2' for Naina V2 */
  version?: string;
  /** Auto-language detection mode for Vapi native voices */
  language?: string;
  /** For 'custom-voice' provider: the bridge server that handles TTS synthesis */
  server?: {
    url: string;
    timeoutSeconds?: number;
  };
}

export interface VapiAnalysisPlan {
  summaryPlan?: {
    /** When false, Vapi skips auto-summary generation (we use structuredDataOutput instead) */
    enabled: boolean;
  };
  successEvaluationPlan?: {
    /** When false, Vapi skips the success/failure rating */
    enabled: boolean;
  };
}

export interface VapiArtifactPlan {
  /** Whether Vapi should record the call and provide a recording URL */
  recordingEnabled?: boolean;
  /**
   * IDs of structured output schemas to populate from the call transcript.
   * e.g. ['5367c2b7-ae61-4ec2-ac6a-3c7f43ae907f'] for electrical-shop-call-summary
   */
  structuredOutputIds?: string[];
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
  /**
   * Seconds of silence before Vapi ends the call.
   * Live assistant v11 uses 20s.
   */
  silenceTimeoutSeconds?: number;
  backgroundSound?: 'office' | 'off';
  metadata?: Record<string, unknown>;
  /**
   * Controls Vapi's post-call AI analysis (summary, success evaluation).
   * Set summaryPlan.enabled: false when using structuredDataOutput instead.
   */
  analysisPlan?: VapiAnalysisPlan;
  /**
   * Controls call recording and structured output schema population.
   */
  artifactPlan?: VapiArtifactPlan;
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

export interface VapiOutboundCallPayload {
  /** Vapi assistant ID to use for the call */
  assistantId: string;
  /** Vapi phone number ID that will appear as caller ID */
  phoneNumberId: string;
  /** Destination number in E.164 format */
  customer: { number: string };
}

export interface VapiOutboundCall {
  id: string;
  type: 'outboundPhoneCall';
  status: string;
  assistantId: string;
  phoneNumberId: string;
  customer: { number: string };
  createdAt?: string;
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

/**
 * Initiate an outbound phone call via Vapi.
 * Vapi dials the customer number using the specified Vapi phone number as caller ID.
 *
 * Docs: POST https://api.vapi.ai/call/phone
 */
export async function vapiInitiateOutboundCall(
  payload: VapiOutboundCallPayload,
): Promise<VapiOutboundCall> {
  logger.info('Initiating Vapi outbound call', {
    assistantId:  payload.assistantId,
    phoneNumberId: payload.phoneNumberId,
    to:           payload.customer.number,
  });
  const call = await vapiRequest<VapiOutboundCall>('POST', '/call/phone', payload);
  logger.info('Vapi outbound call initiated', { vapiCallId: call.id });
  return call;
}
