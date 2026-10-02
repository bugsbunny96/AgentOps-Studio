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
  /** Inline function tools (e.g. search_catalog) served by our own backend */
  tools?: VapiInlineTool[];
}

/** An inline Vapi function tool whose calls are POSTed to our backend. */
export interface VapiInlineTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  };
  server: {
    url: string;
    headers?: Record<string, string>;
    timeoutSeconds?: number;
  };
}

/**
 * Per-call cost breakdown Vapi sends in end-of-call-report (`message.costBreakdown`)
 * and returns from GET /call/:id. All amounts are USD.
 */
export interface VapiCostBreakdown {
  transport?: number;
  stt?:       number;
  llm?:       number;
  tts?:       number;
  vapi?:      number;
  total?:     number;
  llmPromptTokens?:     number;
  llmCompletionTokens?: number;
  ttsCharacters?:       number;
}

/** Subset of the Vapi call object we read for cost backfill. */
export interface VapiCallRecord {
  id:             string;
  cost?:          number;
  costBreakdown?: VapiCostBreakdown;
  startedAt?:     string;
  endedAt?:       string;
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
  provider: 'openai' | '11labs' | 'azure' | 'cartesia' | 'deepgram' | 'playht' | 'vapi';
  voiceId?: string;
  speed?: number;
  /** Provider-specific TTS model. Required for ElevenLabs multilingual: 'eleven_multilingual_v2' */
  model?: string;
  /** Vapi native voice version, e.g. '2' for Naina V2 */
  version?: string;
  /** Auto-language detection mode for Vapi native voices */
  language?: string;
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

/** Inline tools we add and remove ourselves, depending on catalog / KB size. */
const MANAGED_INLINE_TOOLS = new Set(['search_catalog', 'search_knowledge_base']);

/**
 * Tool safety net. Vapi's PATCH replaces the whole `model` object, so a model
 * update that omits a tool silently detaches it from the live agent. This merges
 * the tools the assistant has NOW into the outgoing model:
 *   • toolIds  — union of current and new (submit_order / end-call are never dropped)
 *   • inline tools — every current tool is kept unless it is one of our managed
 *     lookup tools (those follow `next`); a tool in `next` replaces one of the same name.
 */
export function mergeModelTools(
  current: Partial<VapiModel> | undefined,
  next: VapiModel,
): VapiModel {
  const toolIds = [...new Set([...(current?.toolIds ?? []), ...(next.toolIds ?? [])])];

  const nextTools = next.tools ?? [];
  const nextNames = new Set(nextTools.map((t) => t.function?.name));
  const keptCurrent = (current?.tools ?? []).filter((t) => {
    const name = t.function?.name;
    return !MANAGED_INLINE_TOOLS.has(name) && !nextNames.has(name);
  });
  const tools = [...keptCurrent, ...nextTools];

  const { toolIds: _ids, tools: _tools, ...rest } = next;
  return {
    ...rest,
    ...(toolIds.length ? { toolIds } : {}),
    ...(tools.length ? { tools } : {}),
  };
}

/**
 * Update an existing Vapi assistant (e.g., after org data changes).
 *
 * When the patch includes `model`, the assistant's current tools are read first
 * and merged in (see mergeModelTools) so no update can remove submit_order or
 * end_receptionist_call. If that read fails, the update is NOT sent.
 */
export async function vapiUpdateAssistant(
  assistantId: string,
  payload: Partial<VapiCreateAssistantPayload>,
): Promise<VapiAssistant> {
  let body = payload;
  if (payload.model) {
    const current = await vapiRequest<{ model?: Partial<VapiModel> }>('GET', `/assistant/${assistantId}`);
    body = { ...payload, model: mergeModelTools(current?.model, payload.model) };
  }
  return vapiRequest<VapiAssistant>('PATCH', `/assistant/${assistantId}`, body);
}

/** Fetch an assistant's live config (used by maintenance scripts). */
export async function vapiGetAssistant(assistantId: string): Promise<Record<string, unknown>> {
  return vapiRequest<Record<string, unknown>>('GET', `/assistant/${assistantId}`);
}

/** Fetch one call record — used to backfill the real per-call cost. */
export async function vapiGetCall(callId: string): Promise<VapiCallRecord> {
  return vapiRequest<VapiCallRecord>('GET', `/call/${callId}`);
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

// ─── Phone numbers (BYO SIP trunk) ────────────────────────────────────────────

export interface VapiCreateByoPhoneNumberPayload {
  provider: 'byo-phone-number';
  name: string;
  /** E.164, e.g. +918071387376 */
  number: string;
  numberE164CheckEnabled?: boolean;
  /** byo-sip-trunk credential the number is reached through */
  credentialId: string;
  /**
   * Deliberately omitted by onboarding: with no assistantId, Vapi sends an
   * assistant-request webhook, which is where quota + business-hours routing runs.
   */
  assistantId?: string;
}

export interface VapiPhoneNumber {
  id: string;
  number?: string;
  name?: string;
  credentialId?: string;
}

/**
 * Import a BYO (Vobiz) phone number into Vapi.
 * Docs: POST https://api.vapi.ai/phone-number
 */
export async function vapiCreatePhoneNumber(
  payload: VapiCreateByoPhoneNumberPayload,
): Promise<VapiPhoneNumber> {
  logger.info('Importing phone number into Vapi', { number: payload.number });
  const phone = await vapiRequest<VapiPhoneNumber>('POST', '/phone-number', payload);
  logger.info('Vapi phone number created', { vapiPhoneNumberId: phone.id });
  return phone;
}

/**
 * Remove a phone number from Vapi. 404 is treated as success (already gone).
 */
export async function vapiDeletePhoneNumber(phoneNumberId: string): Promise<void> {
  try {
    await vapiRequest<void>('DELETE', `/phone-number/${phoneNumberId}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) return;
    throw err;
  }
}
