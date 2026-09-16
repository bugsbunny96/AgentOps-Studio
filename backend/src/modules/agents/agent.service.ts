/**
 * Agent Service — provisioning + system prompt generation
 *
 * provisionAgent() is idempotent: calling it multiple times (e.g., on every
 * ActivatePage mount) is safe. If the assistant already exists in Vapi and the
 * local VoiceAgent record exists, it returns the cached data immediately.
 */

import {
  OrganizationModel,
  MembershipModel,
  type IOrganization,
} from '../organization/organization.model';
import { VoiceAgentModel, type IVoiceAgent } from './agent.model';
import {
  vapiCreateAssistant,
  vapiUpdateAssistant,
  type VapiCreateAssistantPayload,
  type VapiVoice,
  type VapiTranscriber,
} from './vapi.service';
import { generateSystemPrompt, buildFirstMessage, buildEndCallMessage } from './prompt.utils';
import { getKbContext } from '../knowledge-base/kb.service';
import { env } from '../../config/env';
import { NotFound } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import type { UpdateAgentConfigDto } from './agent.validation';

// Re-export generateSystemPrompt so existing importers (kb.service.ts → prompt.utils.ts) are unaffected.
// kb.service.ts already imports directly from prompt.utils now — this export is for any other callers.
export { generateSystemPrompt };

// ─── Vapi Provider Mapping ─────────────────────────────────────────────────────
// DB stores 'elevenlabs' (matches VoiceAgent schema); Vapi REST API expects '11labs'.

const VAPI_PROVIDER_MAP: Record<string, VapiVoice['provider']> = {
  openai:         'openai',
  elevenlabs:     '11labs',
  deepgram:       'deepgram',
  cartesia:       'cartesia',
  playht:         'playht',
  azure:          'azure',
  vapi:           'vapi',
  'custom-voice': 'custom-voice',
};

/**
 * Builds the Vapi voice config block from agent + env settings.
 * If SARVAM_BRIDGE_URL is set, uses the custom-voice bridge for Sarvam TTS.
 * Otherwise uses Vapi native Naina V2.
 */
function buildVapiVoice(
  rawProvider: string,
  voiceId: string,
  voiceVersion: string | undefined,
  hasNonEnglish: boolean,
): VapiVoice {
  const vapiProvider = VAPI_PROVIDER_MAP[rawProvider] ?? 'openai';

  // Custom-voice bridge (opt-in via SARVAM_BRIDGE_URL env var)
  if (vapiProvider === 'custom-voice' && env.SARVAM_BRIDGE_URL) {
    return {
      provider: 'custom-voice',
      server: {
        url: `${env.SARVAM_BRIDGE_URL}/api/synthesize`,
        timeoutSeconds: 10,
      },
    };
  }

  // Vapi native voice (e.g. Naina V2 for Hindi support)
  if (vapiProvider === 'vapi') {
    return {
      provider: 'vapi',
      voiceId:  voiceId || 'Naina',
      version:  voiceVersion || '2',
      language: 'auto',
    };
  }

  // ElevenLabs multilingual model
  if (vapiProvider === '11labs' && hasNonEnglish) {
    return { provider: '11labs', voiceId, model: 'eleven_multilingual_v2' };
  }

  return { provider: vapiProvider, voiceId };
}

function buildVapiPayload(
  org: IOrganization,
  systemPrompt: string,
  agentConfig?: {
    transcriberProvider?: IVoiceAgent['transcriberProvider'];
    transcriberModel?: string;
    transcriberLanguage?: string;
    vapiToolIds?: string[];
    vapiStructuredOutputId?: string;
    voiceProvider?: string;
    voiceId?: string;
    voiceVersion?: string;
  },
): VapiCreateAssistantPayload {
  const agentName = org.agentName || org.name;
  const isMultilingual = (org.supportedLanguages?.length ?? 0) > 1;
  const hasNonEnglish  = org.supportedLanguages?.some((l) => l !== 'en-US') ?? false;

  // Resolve voice provider from agent config or org onboarding choice
  const rawProvider  = agentConfig?.voiceProvider ?? org.preferredVoiceProvider ?? 'openai';
  const voiceId      = agentConfig?.voiceId ?? org.preferredVoiceId ?? 'nova';
  const voiceVersion = agentConfig?.voiceVersion;

  const voice: VapiVoice = buildVapiVoice(rawProvider, voiceId, voiceVersion, hasNonEnglish);

  // Transcriber — use agent-level config when available
  const transcriberProvider = agentConfig?.transcriberProvider ?? 'deepgram';
  const transcriberLanguage = agentConfig?.transcriberLanguage ??
    (isMultilingual ? 'multi' : (org.supportedLanguages?.[0] ?? 'en-US'));
  const transcriberModel = agentConfig?.transcriberModel ??
    (isMultilingual ? 'nova-3' : 'nova-2');

  const transcriber: VapiTranscriber = {
    provider: transcriberProvider,
    language: transcriberLanguage,
    model:    transcriberModel,
  };

  // Tool IDs — from agent config or env defaults
  const toolIds: string[] = agentConfig?.vapiToolIds?.length
    ? agentConfig.vapiToolIds
    : [
        env.VAPI_TOOL_ID_END_CALL,
        env.VAPI_TOOL_ID_SUBMIT_ORDER,
      ].filter(Boolean) as string[];

  // Structured output schema ID
  const structuredOutputId = agentConfig?.vapiStructuredOutputId ?? env.VAPI_STRUCTURED_OUTPUT_ID;

  return {
    name: `${agentName} — AgentOps Studio`,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.3,
      maxTokens: 300,
      ...(toolIds.length ? { toolIds } : {}),
    },
    transcriber,
    voice,
    firstMessage: buildFirstMessage(org),
    firstMessageMode: 'assistant-speaks-first',
    endCallMessage: buildEndCallMessage(org),
    endCallPhrases: ['goodbye', 'bye', "that's all", 'thank you, bye', 'end call', 'धन्यवाद', 'ਧੰਨਵਾਦ'],
    maxDurationSeconds: 900,          // 15 min cap (POC uses 900s)
    silenceTimeoutSeconds: 20,        // end call after 20s silence
    backgroundSound: 'off',
    // Disable Vapi's built-in analysis — we use structured output schema instead
    analysisPlan: {
      summaryPlan:           { enabled: false },
      successEvaluationPlan: { enabled: false },
    },
    // Enable recording + structured output schema
    artifactPlan: {
      recordingEnabled: true,
      ...(structuredOutputId ? { structuredOutputIds: [structuredOutputId] } : {}),
    },
    metadata: {
      organizationId: org._id.toString(),
      platform: 'agentops-studio',
    },
  };
}

// ─── provisionAgent ────────────────────────────────────────────────────────────

/**
 * Idempotent agent provisioner.
 *
 * Flow:
 *  1. Look up the owner's org.
 *  2. If vapiAssistantId + local VoiceAgent record already exist → return cached.
 *  3. Otherwise generate systemPrompt → create Vapi assistant → save IDs.
 *
 * Safe to call on every ActivatePage mount.
 */
export async function provisionAgent(userId: string) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) throw NotFound('Organization');

  const org    = membership.organizationId as IOrganization;
  const orgId  = org._id;

  // ── Fast path: already provisioned ────────────────────────────────
  if (org.vapiAssistantId) {
    const existingAgent = await VoiceAgentModel.findOne({ organizationId: orgId });
    if (existingAgent) {
      logger.info('Agent already provisioned — returning cached', {
        orgId: orgId.toString(),
        vapiAssistantId: org.vapiAssistantId,
      });
      return {
        agent: existingAgent.toJSON(),
        vapiAssistantId: org.vapiAssistantId,
        vapiPublicKey: env.VAPI_PUBLIC_KEY ?? null,
      };
    }
  }

  // ── Provision: generate prompt + create Vapi assistant ─────────────
  logger.info('Provisioning new Vapi assistant', { orgId: orgId.toString() });

  // Inject any existing KB docs so the initial Vapi prompt is fully populated.
  const kbContext     = await getKbContext(orgId);
  const systemPrompt  = generateSystemPrompt(org, kbContext);
  const vapiPayload   = buildVapiPayload(org, systemPrompt);
  const vapiAssistant = await vapiCreateAssistant(vapiPayload);

  // Persist vapiAssistantId on the org document
  await OrganizationModel.findByIdAndUpdate(orgId, {
    $set: { vapiAssistantId: vapiAssistant.id },
  });

  // Create local VoiceAgent record
  // upsert in case of a partial write from a previous attempt
  const agent = await VoiceAgentModel.findOneAndUpdate(
    { organizationId: orgId },
    {
      $setOnInsert: {
        organizationId: orgId,
        name: org.agentName || org.name,
        systemPrompt,
        vapiAssistantId: vapiAssistant.id,
        voiceProvider: (org.preferredVoiceProvider as IVoiceAgent['voiceProvider']) ?? 'openai',
        voiceId: org.preferredVoiceId ?? 'nova',
        primaryLanguage: org.supportedLanguages?.[0] ?? 'en-US',
        supportedLanguages: org.supportedLanguages ?? ['en-US'],
        status: 'Active',
      },
    },
    { upsert: true, new: true },
  );

  logger.info('Agent provisioned successfully', {
    orgId: orgId.toString(),
    vapiAssistantId: vapiAssistant.id,
    agentId: agent!._id.toString(),
  });

  return {
    agent: agent!.toJSON(),
    vapiAssistantId: vapiAssistant.id,
    vapiPublicKey: env.VAPI_PUBLIC_KEY ?? null,
  };
}

// ─── getAgentConfig ────────────────────────────────────────────────────────────

/**
 * Returns the current agent config for the authenticated owner.
 * Used by ActivatePage on mount to skip the provision step if already done.
 */
export async function getAgentConfig(userId: string) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) throw NotFound('Organization');

  const org   = membership.organizationId as IOrganization;
  const agent = await VoiceAgentModel.findOne({ organizationId: org._id });

  return {
    vapiPublicKey:   env.VAPI_PUBLIC_KEY ?? null,
    vapiAssistantId: org.vapiAssistantId ?? null,
    agent:           agent?.toJSON() ?? null,
  };
}

// ─── listAgents ───────────────────────────────────────────────────────────────

/**
 * Returns all VoiceAgent records for the authenticated owner's org.
 * Currently 1-per-org during onboarding, but the list pattern is future-proof.
 */
export async function listAgents(userId: string) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) throw NotFound('Organization');

  const org    = membership.organizationId as IOrganization;
  const agents = await VoiceAgentModel.find({ organizationId: org._id }).sort({ createdAt: -1 });

  return {
    agents:          agents.map((a) => a.toJSON()),
    vapiPublicKey:   env.VAPI_PUBLIC_KEY ?? null,
    vapiAssistantId: org.vapiAssistantId ?? null,
  };
}

// ─── linkPhoneNumber ──────────────────────────────────────────────────────────

/**
 * Saves the Vapi phone number ID (UUID from the Vapi dashboard) on the org.
 * This is the ID that Vapi includes in `assistant-request` webhook events so
 * we can route calls to the correct org's assistant.
 *
 * Called from Settings → Phone Number Setup (founder manual step).
 */
export async function linkPhoneNumber(userId: string, vapiPhoneNumberId: string) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) throw NotFound('Organization');

  const org = membership.organizationId as IOrganization;

  const updated = await OrganizationModel.findByIdAndUpdate(
    org._id,
    { $set: { vapiPhoneNumberId } },
    { new: true },
  );

  if (!updated) throw NotFound('Organization');

  logger.info('Phone number linked to org', {
    orgId: org._id.toString(),
    vapiPhoneNumberId,
  });

  return {
    vapiPhoneNumberId: updated.vapiPhoneNumberId,
    message: 'Phone number linked successfully',
  };
}

/**
 * Returns the currently linked phone number for the org.
 */
export async function getPhoneNumber(userId: string) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) throw NotFound('Organization');

  const org = membership.organizationId as IOrganization;

  return {
    vapiPhoneNumberId: org.vapiPhoneNumberId ?? null,
    vapiAssistantId:   org.vapiAssistantId   ?? null,
  };
}

// ─── getAgentById ─────────────────────────────────────────────────────────────

// ─── updateAgentVoice ─────────────────────────────────────────────────────────

/**
 * Update the voice provider + voiceId (and optionally languages) on a VoiceAgent.
 * Syncs the change to Vapi immediately.
 *
 * DTO fields:
 *   voiceProvider      — one of 'openai' | 'elevenlabs' | 'deepgram' | 'cartesia' | 'playht' | 'azure'
 *   voiceId            — provider-specific voice ID (e.g. 'nova', 'asteria')
 *   supportedLanguages — optional; triggers: Deepgram language mode update + system prompt regeneration
 *
 * When supportedLanguages changes the Vapi assistant is patched with:
 *   • transcriber.language = 'multi' (2+ languages) or specific code (1 language)
 *   • model.messages[0].content = regenerated system prompt with correct language rules
 *   • firstMessage / endCallMessage = multilingual-aware greeting
 */
export async function updateAgentVoice(
  userId: string,
  agentId: string,
  dto: {
    voiceProvider: string;
    voiceId: string;
    supportedLanguages?: string[];
  },
) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) throw NotFound('Organization');

  const org   = membership.organizationId as IOrganization;
  const agent = await VoiceAgentModel.findOne({ _id: agentId, organizationId: org._id });
  if (!agent) throw NotFound('Agent');

  const vapiProvider   = VAPI_PROVIDER_MAP[dto.voiceProvider] ?? 'openai';
  const hasNonEnglish  = (dto.supportedLanguages ?? org.supportedLanguages ?? []).some((l) => l !== 'en-US');
  const isMultilingual = (dto.supportedLanguages ?? org.supportedLanguages ?? []).length > 1;

  // Build local VoiceAgent update
  const localUpdates: Partial<{
    voiceProvider: IVoiceAgent['voiceProvider'];
    voiceId: string;
    supportedLanguages: string[];
    systemPrompt: string;
  }> = {
    voiceProvider: dto.voiceProvider as IVoiceAgent['voiceProvider'],
    voiceId: dto.voiceId,
  };
  if (dto.supportedLanguages) localUpdates.supportedLanguages = dto.supportedLanguages;

  // When languages change, regenerate system prompt with updated language rules.
  // Also re-inject current KB context so it is not wiped from the Vapi prompt
  // (DRIFT-4 fix: language update previously dropped KB content).
  let newSystemPrompt: string | undefined;
  if (dto.supportedLanguages) {
    const orgWithNewLangs = {
      ...org.toObject(),
      supportedLanguages: dto.supportedLanguages,
    } as IOrganization;
    const kbContext     = await getKbContext(org._id);
    newSystemPrompt     = generateSystemPrompt(orgWithNewLangs, kbContext);
    localUpdates.systemPrompt = newSystemPrompt;
  }

  const updated = await VoiceAgentModel.findByIdAndUpdate(
    agentId,
    { $set: localUpdates },
    { new: true },
  );

  // Sync to Vapi if org has an assistant ID
  if (org.vapiAssistantId) {
    // ElevenLabs needs eleven_multilingual_v2 to speak Hindi/Punjabi correctly
    const voice: VapiVoice = {
      provider: vapiProvider,
      voiceId: dto.voiceId,
      ...(vapiProvider === '11labs' && hasNonEnglish ? { model: 'eleven_multilingual_v2' } : {}),
    };

    const vapiPatch: Partial<VapiCreateAssistantPayload> = { voice };

    if (dto.supportedLanguages) {
      // Rebuild transcriber with correct language mode.
      // nova-3 for multilingual (better short-utterance accuracy in Hindi/Punjabi).
      vapiPatch.transcriber = {
        provider: 'deepgram',
        language: isMultilingual ? 'multi' : (dto.supportedLanguages[0] ?? 'en-US'),
        model: isMultilingual ? 'nova-3' : 'nova-2',
      };

      // Push regenerated system prompt and updated greetings
      const orgForGreeting = {
        ...org.toObject(),
        supportedLanguages: dto.supportedLanguages,
      } as IOrganization;
      vapiPatch.model = {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'system', content: newSystemPrompt! }],
        temperature: 0.65,
        maxTokens: 300,
      };
      vapiPatch.firstMessage    = buildFirstMessage(orgForGreeting);
      vapiPatch.endCallMessage  = buildEndCallMessage(orgForGreeting);
    }

    await vapiUpdateAssistant(org.vapiAssistantId, vapiPatch);
    logger.info('Vapi voice + language updated', {
      agentId,
      provider: vapiProvider,
      voiceId: dto.voiceId,
      languages: dto.supportedLanguages ?? 'unchanged',
      multilingual: isMultilingual,
    });
  }

  return {
    agent:           updated!.toJSON(),
    vapiPublicKey:   env.VAPI_PUBLIC_KEY ?? null,
    vapiAssistantId: org.vapiAssistantId ?? null,
  };
}

// ─── updateAgentConfig ────────────────────────────────────────────────────────

/**
 * Update agent name and/or business description, then regenerate the system
 * prompt and push the updated prompt (and optional name) to Vapi.
 *
 * - `name`               → updates VoiceAgent.name + Organization.agentName
 * - `businessDescription`→ updates Organization.businessDescription
 * - Always regenerates systemPrompt using latest org data + KB context
 * - Always pushes updated model.messages to Vapi assistant
 */
export async function updateAgentConfig(
  userId: string,
  agentId: string,
  dto: UpdateAgentConfigDto,
) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');
  if (!membership) throw NotFound('Organization');

  const org   = membership.organizationId as IOrganization;
  const agent = await VoiceAgentModel.findOne({ _id: agentId, organizationId: org._id });
  if (!agent) throw NotFound('Agent');

  // ── Persist org-level changes ──────────────────────────────────────────────
  const orgUpdates: Record<string, string> = {};
  if (dto.name !== undefined)                orgUpdates['agentName']            = dto.name;
  if (dto.businessDescription !== undefined) orgUpdates['businessDescription']  = dto.businessDescription;

  if (Object.keys(orgUpdates).length > 0) {
    await OrganizationModel.findByIdAndUpdate(org._id, { $set: orgUpdates });
  }

  // ── Build org override for prompt generation (avoids a second DB fetch) ────
  const orgForPrompt = {
    ...org.toObject(),
    ...orgUpdates,
  } as IOrganization;

  // ── Regenerate system prompt ───────────────────────────────────────────────
  const kbContext       = await getKbContext(org._id);
  const newSystemPrompt = generateSystemPrompt(orgForPrompt, kbContext);

  // ── Update VoiceAgent record ───────────────────────────────────────────────
  const agentUpdates: Partial<{ name: string; systemPrompt: string }> = {
    systemPrompt: newSystemPrompt,
  };
  if (dto.name !== undefined) agentUpdates.name = dto.name;

  const updated = await VoiceAgentModel.findByIdAndUpdate(
    agentId,
    { $set: agentUpdates },
    { new: true },
  );

  // ── Push to Vapi ───────────────────────────────────────────────────────────
  if (org.vapiAssistantId) {
    // Build the full payload (including transcriber, voice, analysisPlan, artifactPlan)
    // so a config update never accidentally drops these settings from the assistant.
    const orgForPayload = {
      ...org.toObject(),
      ...orgUpdates,
    } as IOrganization;

    const fullPayload = buildVapiPayload(orgForPayload, newSystemPrompt, {
      transcriberProvider:   agent.transcriberProvider,
      transcriberModel:      agent.transcriberModel,
      transcriberLanguage:   agent.transcriberLanguage,
      vapiToolIds:           agent.vapiToolIds,
      vapiStructuredOutputId: agent.vapiStructuredOutputId,
      voiceProvider:         agent.voiceProvider,
      voiceId:               agent.voiceId,
      voiceVersion:          agent.voiceVersion,
    });

    const vapiPatch: Partial<VapiCreateAssistantPayload> = {
      model:         fullPayload.model,
      transcriber:   fullPayload.transcriber,
      voice:         fullPayload.voice,
      analysisPlan:  fullPayload.analysisPlan,
      artifactPlan:  fullPayload.artifactPlan,
      silenceTimeoutSeconds: fullPayload.silenceTimeoutSeconds,
      maxDurationSeconds:    fullPayload.maxDurationSeconds,
    };

    // Vapi assistant name mirrors the agent name when it changes
    if (dto.name !== undefined) {
      vapiPatch.name = `${dto.name} — AgentOps Studio`;
    }
    await vapiUpdateAssistant(org.vapiAssistantId, vapiPatch);
  }

  logger.info('Agent config updated', {
    agentId,
    nameChanged:                dto.name !== undefined,
    businessDescriptionChanged: dto.businessDescription !== undefined,
    orgId: org._id.toString(),
  });

  return {
    agent:           updated!.toJSON(),
    vapiAssistantId: org.vapiAssistantId ?? null,
  };
}

// ─── getAgentById ─────────────────────────────────────────────────────────────

/**
 * Returns a single VoiceAgent by its MongoDB _id.
 * Validates that it belongs to the authenticated owner's org.
 */
export async function getAgentById(userId: string, agentId: string) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');

  if (!membership) throw NotFound('Organization');

  const org   = membership.organizationId as IOrganization;
  const agent = await VoiceAgentModel.findOne({ _id: agentId, organizationId: org._id });

  if (!agent) throw NotFound('Agent');

  return {
    agent:           agent.toJSON(),
    vapiPublicKey:   env.VAPI_PUBLIC_KEY ?? null,
    vapiAssistantId: org.vapiAssistantId ?? null,
  };
}
