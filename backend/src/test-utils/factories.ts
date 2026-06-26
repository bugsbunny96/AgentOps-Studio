/**
 * Test data factories — generate valid objects for use in tests.
 * Keeps test setup DRY and co-locates default values.
 */

export const userFactory = (overrides: Record<string, unknown> = {}) => ({
  name: 'Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'Password123!',
  isVerified: true,
  status: 'Active' as const,
  ...overrides,
});

export const orgFactory = (overrides: Record<string, unknown> = {}) => ({
  name: 'Test Org',
  slug: `test-org-${Date.now()}`,
  timezone: 'Asia/Kolkata',
  industry: 'Technology',
  onboardingStatus: 'COMPLETED' as const,
  supportedLanguages: ['en-US'],
  primaryLanguage: 'en-US',
  businessHours: { start: '09:00', end: '18:00' },
  ...overrides,
});

export const voiceAgentFactory = (organizationId: string, overrides: Record<string, unknown> = {}) => ({
  organizationId,
  name: 'Test Agent',
  systemPrompt: 'You are a helpful assistant.',
  primaryLanguage: 'en-US',
  supportedLanguages: ['en-US', 'hi-IN'],
  voiceSettings: {
    provider: 'elevenlabs' as const,
    voiceId: 'test-voice-id',
    speed: 1.0,
    pitch: 1.0,
  },
  status: 'Active' as const,
  ...overrides,
});

export const callFactory = (organizationId: string, agentId: string, overrides: Record<string, unknown> = {}) => ({
  organizationId,
  agentId,
  vapiCallId: `vapi_${Date.now()}`,
  direction: 'Inbound' as const,
  duration: 120,
  status: 'completed' as const,
  callerNumber: '+919876543210',
  cost: 0.05,
  ...overrides,
});
