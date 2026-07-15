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
import { VoiceAgentModel } from './agent.model';
import {
  vapiCreateAssistant,
  type VapiCreateAssistantPayload,
} from './vapi.service';
import { env } from '../../config/env';
import { NotFound } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

// ─── System Prompt Generator ───────────────────────────────────────────────────

/**
 * Produces a comprehensive system prompt from the org's onboarding data.
 * Used as the Vapi assistant's system-level instruction that governs all calls.
 */
export function generateSystemPrompt(org: IOrganization): string {
  const agentName = org.agentName || 'your AI receptionist';
  const bizName   = org.name;

  const parts: string[] = [
    `You are ${agentName}, the AI voice receptionist for ${bizName}. ` +
    `You handle inbound phone enquiries professionally, warmly, and concisely. ` +
    `Remember: this is a phone call. Keep every response under 40 words unless the caller needs a detailed answer.`,
  ];

  // Business description
  if (org.businessDescription) {
    parts.push(`\n## About ${bizName}\n${org.businessDescription}`);
  }

  // Services
  if (org.services?.length) {
    parts.push(
      `\n## Services\nWe offer the following:\n` +
      org.services.map((s) => `- ${s}`).join('\n'),
    );
  }

  // Business hours
  if (org.businessHours?.start && org.businessHours?.end) {
    parts.push(
      `\n## Business Hours\nWe are open from ${org.businessHours.start} to ${org.businessHours.end}.` +
      ` Outside these hours, offer to take a message.`,
    );
  }

  // Locations
  if (org.locations?.length) {
    parts.push(
      `\n## Location(s)\n` +
      org.locations.map((l) => `- ${l}`).join('\n'),
    );
  }

  // Contact
  const contact: string[] = [];
  if (org.contactDetails?.phone) contact.push(`Phone: ${org.contactDetails.phone}`);
  if (org.contactDetails?.email) contact.push(`Email: ${org.contactDetails.email}`);
  if (contact.length) {
    parts.push(`\n## Contact Information\n${contact.join('\n')}`);
  }

  // FAQs
  if (org.faqs?.length) {
    const faqBlock = org.faqs
      .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
      .join('\n\n');
    parts.push(`\n## Frequently Asked Questions\n${faqBlock}`);
  }

  // Fallback / transfer
  if (org.fallbackNumber) {
    parts.push(
      `\n## Transfer Policy\nIf the caller requests to speak with a human, or if you cannot ` +
      `answer their question, politely say you'll transfer them and use the transfer function ` +
      `to connect them to: ${org.fallbackNumber}.`,
    );
  }

  // Language policy
  const langs = org.supportedLanguages ?? ['en-US'];
  if (langs.length > 1) {
    const labelMap: Record<string, string> = {
      'en-US': 'English',
      'hi-IN': 'Hindi',
      'pa-IN': 'Punjabi',
    };
    const langNames = langs.map((l) => labelMap[l] ?? l).join(', ');
    parts.push(
      `\n## Language\nDetect the caller's preferred language and respond in it. ` +
      `Supported languages: ${langNames}.`,
    );
  }

  // Core behaviour rules
  parts.push(`
## Behaviour Rules
1. Always greet the caller by mentioning the business name ("Thank you for calling ${bizName}!").
2. Be warm, professional, and efficient.
3. Never make up information not provided above.
4. If asked something you cannot answer, offer to take their name and callback number.
5. Do not discuss pricing unless it is listed in the services above.
6. End every call with a friendly sign-off (e.g., "Have a great day!").`);

  return parts.join('\n');
}

// ─── Vapi Payload Builder ──────────────────────────────────────────────────────

function buildVapiPayload(
  org: IOrganization,
  systemPrompt: string,
): VapiCreateAssistantPayload {
  const agentName = org.agentName || org.name;
  const greeting  = `Hello! Thank you for calling ${org.name}. I'm ${org.agentName || 'your assistant'}. How can I help you today?`;

  return {
    name: `${agentName} — AgentOps Studio`,
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.65,
      maxTokens: 300,
    },
    transcriber: {
      provider: 'deepgram',
      language: (org.supportedLanguages?.length ?? 0) > 1 ? 'multi' : 'en-US',
      model: 'nova-2',
    },
    voice: {
      provider: 'openai',
      voiceId: 'nova',   // Clear, natural female voice — no ElevenLabs creds required
    },
    firstMessage: greeting,
    firstMessageMode: 'assistant-speaks-first',
    endCallMessage: `Thank you for calling ${org.name}. Have a wonderful day!`,
    endCallPhrases: ['goodbye', 'bye', "that's all", 'thank you, bye', 'end call'],
    maxDurationSeconds: 1800,  // 30 min hard cap
    backgroundSound: 'off',
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
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
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

  const systemPrompt  = generateSystemPrompt(org);
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
        voiceProvider: 'openai',
        voiceId: 'nova',
        primaryLanguage: 'en-US',
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
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
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
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
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
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
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
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
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

/**
 * Returns a single VoiceAgent by its MongoDB _id.
 * Validates that it belongs to the authenticated owner's org.
 */
export async function getAgentById(userId: string, agentId: string) {
  const membership = await MembershipModel.findOne({ userId, role: 'Owner' }).populate<{
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
