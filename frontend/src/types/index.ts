// ── Shared Global Types ───────────────────────────────────────────────────────

export type UserRole = 'Owner' | 'Admin' | 'Member';

export type OnboardingStatus =
  | 'REGISTRATION'
  | 'ORG_CREATION'
  | 'WEBSITE_CRAWL'
  | 'BUSINESS_CONFIG'
  | 'VOICE_SETUP'
  | 'COMPLETED';

export type CrawlStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export interface User {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  status: 'Active' | 'Suspended' | 'Pending';
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  industry: string;
  onboardingStatus: OnboardingStatus;
  // Step 2 — Learn
  hasWebsite: boolean;
  crawlEnabled: boolean;
  websiteUrl?: string;
  crawlStatus: CrawlStatus;
  crawlError?: string;
  // Step 3 — Configure
  agentName?: string;
  businessDescription?: string;
  services: string[];
  faqs: Array<{ question: string; answer: string }>;
  businessHours: { start: string; end: string };
  contactDetails?: { email?: string; phone?: string };
  locations: string[];
  // Step 4 — Customize
  supportedLanguages: string[];
  fallbackNumber?: string;
  // Step 5 — Activate (Vapi provisioning)
  vapiAssistantId?: string;
  createdAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  createdAt: string;
}

export interface VoiceAgent {
  id: string;
  organizationId: string;
  name: string;
  systemPrompt: string;
  vapiAssistantId: string;
  voiceProvider: 'openai' | 'elevenlabs' | 'cartesia' | 'azure';
  voiceId: string;
  primaryLanguage: string;
  supportedLanguages: string[];
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Call {
  id: string;
  organizationId: string;
  agentId: string;
  vapiCallId: string;
  direction: 'Inbound' | 'Outbound';
  duration: number;
  status: 'active' | 'completed' | 'failed';
  callerNumber: string;
  recordingUrl?: string;
  cost: number;
  createdAt: string;
}

export interface TranscriptTurn {
  speaker: 'agent' | 'user';
  text: string;
  language?: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
