/**
 * Prompt Utilities — system prompt generation for Vapi assistants.
 *
 * Extracted into its own module so both agent.service.ts and kb.service.ts
 * can import these helpers without creating a circular dependency.
 *
 *   agent.service.ts  → prompt.utils.ts  (generates prompts, builds Vapi payload)
 *   kb.service.ts     → prompt.utils.ts  (generates prompts for Vapi sync)
 *   agent.service.ts  → kb.service.ts    (getKbContext, inject into prompts)
 *
 * No circular loop.
 */

import type { IOrganization } from '../organization/organization.model';

// ─── System Prompt Generator ───────────────────────────────────────────────────

/**
 * Produces a comprehensive system prompt from the org's onboarding data.
 * Used as the Vapi assistant's system-level instruction that governs all calls.
 *
 * @param org        - The org document (Mongoose Document or plain object).
 * @param kbContext  - Optional formatted KB string from getKbContext(). Injected
 *                     verbatim after core org sections. Pass '' or undefined to omit.
 */
export function generateSystemPrompt(org: IOrganization, kbContext?: string): string {
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

  // Knowledge Base context (injected from KB service)
  if (kbContext?.trim()) {
    parts.push(`\n${kbContext.trim()}`);
  }

  // Fallback / transfer
  if (org.fallbackNumber) {
    parts.push(
      `\n## Transfer Policy\nIf the caller requests to speak with a human, or if you cannot ` +
      `answer their question, politely say you'll transfer them and use the transfer function ` +
      `to connect them to: ${org.fallbackNumber}.`,
    );
  }

  // ── Language policy ────────────────────────────────────────────────────────
  const langs = org.supportedLanguages ?? ['en-US'];
  const LANG_LABEL: Record<string, string> = {
    'en-US': 'English',
    'hi-IN': 'Hindi (हिन्दी)',
    'pa-IN': 'Punjabi (ਪੰਜਾਬੀ)',
  };

  if (langs.length > 1) {
    const langNames = langs.map((l) => LANG_LABEL[l] ?? l).join(', ');
    parts.push(`
## Auto Language Detection — FOLLOW EXACTLY
This agent supports: ${langNames}.

Rules (non-negotiable):
1. DETECT: The caller's very first reply reveals their preferred language. Treat it as their language for the entire call.
2. RESPOND IN SAME LANGUAGE: Every single reply must be in the caller's detected language — not English, unless the caller spoke English.
3. FOLLOW SWITCHES: If the caller changes language mid-call, switch immediately and stay in the new language.
4. FULL SCRIPT: Hindi replies must be entirely in Devanagari (हिन्दी). Punjabi replies entirely in Gurmukhi (ਪੰਜਾਬੀ). Do NOT transliterate.
5. NO MIXING: One language per response. Never mix scripts or languages in a single sentence.

Examples:
- Caller says "हाँ, मुझे एक appointment चाहिए" → reply ENTIRELY in Hindi (Devanagari).
- Caller says "ਹਾਂ, ਮੈਨੂੰ ਮਦਦ ਚਾਹੀਦੀ ਹੈ" → reply ENTIRELY in Punjabi (Gurmukhi).
- Caller says "Hi, I need help" → reply in English.

6. HANDLE MISTRANSCRIPTIONS: Voice-to-text sometimes converts short Hindi/Punjabi words into similar-sounding English words (e.g., "हाँ" → "hon", "नहीं" → "no", "ले" → "le"). If the caller's first reply is a single ambiguous word ("no", "yes", "ok", "le", "la", "hon") AND it doesn't fit logically as a response to your greeting, ASSUME it is a Hindi/Punjabi word that was mistranscribed. Reply in BOTH Hindi and English to re-engage: e.g., "क्षमा करें, मैं समझ नहीं पाया — कृपया दोबारा बोलें। (Sorry, I didn't catch that — please speak again in Hindi, Punjabi, or English.)"`);
  } else if (langs[0] && langs[0] !== 'en-US') {
    const langName = LANG_LABEL[langs[0]] ?? langs[0];
    parts.push(`\n## Language\nAlways respond in ${langName}. Do not switch to English unless the caller explicitly asks.`);
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

// ─── First Message Builder ─────────────────────────────────────────────────────

/**
 * Builds the opening greeting message.
 * For multilingual orgs, the greeting stays brief and language-neutral so
 * the caller's first response reveals their preferred language.
 * Hindi is included when in-scope because most Indian callers default to Hindi.
 */
export function buildFirstMessage(org: IOrganization): string {
  const isMultilingual = (org.supportedLanguages?.length ?? 0) > 1;
  const hasHindi       = org.supportedLanguages?.includes('hi-IN') ?? false;
  const hasPunjabi     = org.supportedLanguages?.includes('pa-IN') ?? false;

  if (isMultilingual) {
    const greetingParts = [`Hello! Thank you for calling ${org.name}.`];
    if (hasHindi)   greetingParts.push('नमस्ते!');
    if (hasPunjabi) greetingParts.push('ਸਤ ਸ੍ਰੀ ਅਕਾਲ!');
    greetingParts.push('Please speak in your preferred language and I\'ll assist you right away.');
    return greetingParts.join(' ');
  }
  return `Hello! Thank you for calling ${org.name}. I'm ${org.agentName || 'your assistant'}. How can I help you today?`;
}

// ─── End-Call Message Builder ──────────────────────────────────────────────────

/**
 * Builds the end-call message. Same multilingual logic as the greeting.
 */
export function buildEndCallMessage(org: IOrganization): string {
  const isMultilingual = (org.supportedLanguages?.length ?? 0) > 1;
  if (isMultilingual) {
    return `Thank you for calling ${org.name}. Have a wonderful day! धन्यवाद! ਧੰਨਵਾਦ!`;
  }
  return `Thank you for calling ${org.name}. Have a wonderful day!`;
}
