/**
 * voice-catalog.ts
 *
 * Vapi-accurate voice catalog — provider IDs, voice IDs, and metadata are derived
 * directly from the @vapi-ai/web SDK type definitions (api.d.ts).
 *
 * DB storage convention:
 *   The DB stores our friendly provider IDs ('elevenlabs', 'playht').
 *   agent.service.ts VAPI_PROVIDER_MAP translates them to Vapi API names
 *   ('11labs', 'playht') before any Vapi API call.
 *
 * previewAvailable:true  → backend /agents/voice-preview streams audio via OpenAI TTS
 * previewAvailable:false → no server-side preview; user hears voice on first test call
 *
 * Providers that work through Vapi WITHOUT requiring your own API key:
 *   - openai    (Vapi uses its own OpenAI allocation)
 *   - elevenlabs (Vapi provides shared ElevenLabs named voices)
 *   - deepgram  (Vapi uses its own Deepgram allocation)
 *
 * Providers that require your own API key configured in Vapi dashboard:
 *   - cartesia
 *   - playht
 *   - azure
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Friendly provider IDs as stored in MongoDB VoiceAgent.voiceProvider */
export type VoiceProviderId =
  | 'openai'
  | 'elevenlabs'
  | 'deepgram'
  | 'cartesia'
  | 'playht'
  | 'azure';

export type LanguageCode = 'en-US' | 'hi-IN' | 'pa-IN';

export interface VoiceOption {
  id: string;           // voiceId sent to Vapi
  name: string;
  description: string;
  gender: 'female' | 'male' | 'neutral';
  accent: string;
  previewAvailable: boolean;
  /** true = this voice can speak Hindi and Punjabi correctly via TTS */
  supportsHindi?: boolean;
}

export interface VoiceProviderDef {
  id: VoiceProviderId;
  label: string;
  badge: string;
  tagline: string;
  /** true = works inside Vapi without your own provider API key */
  noKeyRequired: boolean;
  voices: VoiceOption[];
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const VOICE_CATALOG: VoiceProviderDef[] = [
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  // Vapi provider: "openai"
  // Voices from OpenAIVoice.voiceId in Vapi SDK: alloy|echo|fable|onyx|nova|shimmer|marin|cedar
  {
    id: 'openai',
    label: 'OpenAI',
    badge: 'Neural',
    tagline: 'Natural neural voices, works out-of-the-box through Vapi',
    noKeyRequired: true,
    voices: [
      { id: 'nova',    name: 'Nova',    description: 'Warm and friendly',        gender: 'female',  accent: 'American', previewAvailable: true,  supportsHindi: true },
      { id: 'alloy',   name: 'Alloy',   description: 'Neutral and versatile',    gender: 'neutral', accent: 'American', previewAvailable: true,  supportsHindi: true },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft and expressive',      gender: 'female',  accent: 'American', previewAvailable: true,  supportsHindi: true },
      { id: 'echo',    name: 'Echo',    description: 'Clear and direct',         gender: 'male',    accent: 'American', previewAvailable: true,  supportsHindi: true },
      { id: 'fable',   name: 'Fable',   description: 'Rich British storyteller', gender: 'male',    accent: 'British',  previewAvailable: true,  supportsHindi: true },
      { id: 'onyx',    name: 'Onyx',    description: 'Deep and authoritative',   gender: 'male',    accent: 'American', previewAvailable: true,  supportsHindi: true },
      { id: 'marin',   name: 'Marin',   description: 'Smooth and professional',  gender: 'female',  accent: 'American', previewAvailable: true,  supportsHindi: true },
      { id: 'cedar',   name: 'Cedar',   description: 'Warm and confident',       gender: 'male',    accent: 'American', previewAvailable: true,  supportsHindi: true },
    ],
  },

  // ── ElevenLabs ─────────────────────────────────────────────────────────────
  // Vapi provider: "11labs"  (DB stores "elevenlabs", service maps to "11labs")
  // These are Vapi's shared ElevenLabs voices — no ElevenLabs API key required.
  // Source: ElevenLabsVoice.voiceId in Vapi SDK.
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    badge: 'Studio',
    tagline: 'Studio-quality voices — shared via Vapi, no ElevenLabs key needed',
    noKeyRequired: true,
    voices: [
      { id: 'sarah',   name: 'Sarah',   description: 'Young, conversational',      gender: 'female', accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'matilda', name: 'Matilda', description: 'Sophisticated British',       gender: 'female', accent: 'British',  previewAvailable: false, supportsHindi: true },
      { id: 'andrea',  name: 'Andrea',  description: 'Warm and professional',       gender: 'female', accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'paula',   name: 'Paula',   description: 'Mature and composed',         gender: 'female', accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'myra',    name: 'Myra',    description: 'Expressive and energetic',    gender: 'female', accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'ryan',    name: 'Ryan',    description: 'Casual and friendly',         gender: 'male',   accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'paul',    name: 'Paul',    description: 'Clear and measured',          gender: 'male',   accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'phillip', name: 'Phillip', description: 'Authoritative and direct',    gender: 'male',   accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'mark',    name: 'Mark',    description: 'Balanced and articulate',     gender: 'male',   accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'mrb',     name: 'MrB',     description: 'Deep, commanding',            gender: 'male',   accent: 'British',  previewAvailable: false, supportsHindi: true },
    ],
  },

  // ── Deepgram Aura ───────────────────────────────────────────────────────────
  // Vapi provider: "deepgram"
  // Model: "aura-2" (latest) — ultra-low latency, ideal for real-time voice agents
  // Source: DeepgramVoice.voiceId in Vapi SDK
  // Preview: backend calls Deepgram /v1/speak?model=aura-{voiceId}-en via DEEPGRAM_API_KEY
  {
    id: 'deepgram',
    label: 'Deepgram Aura',
    badge: 'Fastest',
    tagline: 'Ultra-low latency (~100ms) — best for real-time voice agents, via Vapi',
    noKeyRequired: true,
    voices: [
      { id: 'asteria',  name: 'Asteria',  description: 'Warm and conversational', gender: 'female', accent: 'American', previewAvailable: true },
      { id: 'luna',     name: 'Luna',     description: 'Soft and calming',         gender: 'female', accent: 'American', previewAvailable: true },
      { id: 'stella',   name: 'Stella',   description: 'Expressive and upbeat',    gender: 'female', accent: 'American', previewAvailable: true },
      { id: 'athena',   name: 'Athena',   description: 'Authoritative and clear',  gender: 'female', accent: 'British',  previewAvailable: true },
      { id: 'hera',     name: 'Hera',     description: 'Formal and confident',     gender: 'female', accent: 'American', previewAvailable: true },
      { id: 'orion',    name: 'Orion',    description: 'Rich and measured',        gender: 'male',   accent: 'American', previewAvailable: true },
      { id: 'arcas',    name: 'Arcas',    description: 'Warm and approachable',    gender: 'male',   accent: 'American', previewAvailable: true },
      { id: 'perseus',  name: 'Perseus',  description: 'Clear and professional',   gender: 'male',   accent: 'American', previewAvailable: true },
      { id: 'angus',    name: 'Angus',    description: 'Friendly Irish accent',    gender: 'male',   accent: 'Irish',    previewAvailable: true },
      { id: 'orpheus',  name: 'Orpheus',  description: 'Deep and resonant',        gender: 'male',   accent: 'American', previewAvailable: true },
      { id: 'helios',   name: 'Helios',   description: 'Energetic and bright',     gender: 'male',   accent: 'British',  previewAvailable: true },
      { id: 'zeus',     name: 'Zeus',     description: 'Commanding and bold',      gender: 'male',   accent: 'American', previewAvailable: true },
    ],
  },

  // ── PlayHT ─────────────────────────────────────────────────────────────────
  // Vapi provider: "playht"
  // Source: PlayHTVoice.voiceId in Vapi SDK (Play3.0-mini / PlayDialog models)
  // Requires PlayHT API key configured in Vapi dashboard
  {
    id: 'playht',
    label: 'PlayHT',
    badge: 'Emotive',
    tagline: 'Hyper-realistic with emotion control — requires PlayHT API key in Vapi',
    noKeyRequired: false,
    voices: [
      { id: 'jennifer', name: 'Jennifer', description: 'Conversational and warm',   gender: 'female', accent: 'American', previewAvailable: false },
      { id: 'melissa',  name: 'Melissa',  description: 'Professional and polished',  gender: 'female', accent: 'American', previewAvailable: false },
      { id: 'ruby',     name: 'Ruby',     description: 'Energetic and engaging',     gender: 'female', accent: 'American', previewAvailable: false },
      { id: 'donna',    name: 'Donna',    description: 'Mature and trustworthy',     gender: 'female', accent: 'American', previewAvailable: false },
      { id: 'will',     name: 'Will',     description: 'Casual and friendly',        gender: 'male',   accent: 'American', previewAvailable: false },
      { id: 'chris',    name: 'Chris',    description: 'Clear and upbeat',           gender: 'male',   accent: 'American', previewAvailable: false },
      { id: 'matt',     name: 'Matt',     description: 'Warm and approachable',      gender: 'male',   accent: 'American', previewAvailable: false },
      { id: 'jack',     name: 'Jack',     description: 'Confident and authoritative',gender: 'male',   accent: 'American', previewAvailable: false },
      { id: 'davis',    name: 'Davis',    description: 'Deep and composed',          gender: 'male',   accent: 'American', previewAvailable: false },
      { id: 'michael',  name: 'Michael',  description: 'Smooth and professional',    gender: 'male',   accent: 'American', previewAvailable: false },
    ],
  },

  // ── Azure ───────────────────────────────────────────────────────────────────
  // Vapi provider: "azure"
  // Source: AzureVoice.voiceId in Vapi SDK (voiceId: "andrew" | "brian" | "emma" | string)
  // Requires Azure Speech key configured in Vapi dashboard.
  //
  // IMPORTANT: "andrew", "brian", "emma" → en-US-*Neural (ENGLISH ONLY)
  // For Hindi/Punjabi TTS use the Multilingual variants below (supportsHindi: true).
  // Multilingual voiceIds use the full Azure voice name passed as a string to Vapi.
  {
    id: 'azure',
    label: 'Azure',
    badge: 'Multi-lingual',
    tagline: 'Microsoft neural voices — requires Azure key in Vapi dashboard',
    noKeyRequired: false,
    voices: [
      // ── Multilingual voices (Hindi + Punjabi capable) ──────────────────────
      { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew (Multi)', description: 'Natural male — speaks Hindi, Punjabi, English', gender: 'male',   accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'en-US-AvaMultilingualNeural',    name: 'Ava (Multi)',    description: 'Warm female — speaks Hindi, Punjabi, English',  gender: 'female', accent: 'American', previewAvailable: false, supportsHindi: true },
      { id: 'en-US-EmmaMultilingualNeural',   name: 'Emma (Multi)',   description: 'Clear female — speaks Hindi, Punjabi, English',  gender: 'female', accent: 'American', previewAvailable: false, supportsHindi: true },
      // ── English-only voices ────────────────────────────────────────────────
      { id: 'andrew', name: 'Andrew (EN)', description: 'English only — do not use with Hindi/Punjabi', gender: 'male',   accent: 'American', previewAvailable: false, supportsHindi: false },
      { id: 'brian',  name: 'Brian (EN)',  description: 'English only — do not use with Hindi/Punjabi', gender: 'male',   accent: 'British',  previewAvailable: false, supportsHindi: false },
      { id: 'emma',   name: 'Emma (EN)',   description: 'English only — do not use with Hindi/Punjabi', gender: 'female', accent: 'American', previewAvailable: false, supportsHindi: false },
    ],
  },
];

// ─── Language options ─────────────────────────────────────────────────────────

export const LANGUAGE_OPTIONS = [
  { code: 'en-US' as LanguageCode, label: 'English',  sublabel: 'English (US)',    flag: '🇺🇸' },
  { code: 'hi-IN' as LanguageCode, label: 'हिन्दी',   sublabel: 'Hindi (India)',   flag: '🇮🇳' },
  { code: 'pa-IN' as LanguageCode, label: 'ਪੰਜਾਬੀ',   sublabel: 'Punjabi (India)', flag: '🇮🇳' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getProviderById(id: string): VoiceProviderDef | undefined {
  return VOICE_CATALOG.find((p) => p.id === id);
}

export function getVoiceById(providerId: string, voiceId: string): VoiceOption | undefined {
  return getProviderById(providerId)?.voices.find((v) => v.id === voiceId);
}

export function defaultVoiceForProvider(providerId: VoiceProviderId): string {
  const defaults: Record<VoiceProviderId, string> = {
    openai:     'nova',
    elevenlabs: 'sarah',
    deepgram:   'asteria',
    cartesia:   '',        // user must supply their own Cartesia voice ID
    playht:     'jennifer',
    azure:      'en-US-AvaMultilingualNeural',  // multilingual by default — can speak Hindi/Punjabi
  };
  return defaults[providerId] ?? '';
}
