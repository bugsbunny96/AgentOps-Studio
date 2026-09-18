import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // ── Server ──────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),

  // ── Database ─────────────────────────────────────────────────────────
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // ── Redis ─────────────────────────────────────────────────────────────
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // ── JWT ───────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SA_JWT_SECRET: z.string().min(32, 'SA_JWT_SECRET must be at least 32 characters').default('sa-dev-secret-change-in-production-32chars'),

  // ── CORS ──────────────────────────────────────────────────────────────
  CLIENT_URL: z.string().default('http://localhost:5173'),

  // ── Email (Resend) ────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@agentops.studio'),

  // ── AI Stack ──────────────────────────────────────────────────────────
  OPENAI_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),

  // ── Vapi ─────────────────────────────────────────────────────────────
  VAPI_API_KEY: z.string().optional(),
  VAPI_PUBLIC_KEY: z.string().optional(),   // from Vapi dashboard → Account → API Keys → Public
  VAPI_WEBHOOK_SECRET: z.string().optional(),
  /** ID of the Vapi 'end_receptionist_call' server tool */
  VAPI_TOOL_ID_END_CALL: z.string().optional(),
  /** ID of the Vapi 'submit_order' server tool */
  VAPI_TOOL_ID_SUBMIT_ORDER: z.string().optional(),
  /** ID of the electrical-shop-call-summary structured output schema in Vapi */
  VAPI_STRUCTURED_OUTPUT_ID: z.string().optional(),
  /**
   * Secret used to validate x-webhook-secret header on Vapi tool-call endpoints
   * (e.g. POST /api/v1/orders/submit). Separate from VAPI_WEBHOOK_SECRET.
   */
  VAPI_TOOL_WEBHOOK_SECRET: z.string().optional(),

  // ── Sarvam TTS Bridge (opt-in custom voice) ──────────────────────────
  SARVAM_API_KEY: z.string().optional(),
  /**
   * Public URL of the deployed TTS bridge service.
   * When set, Vapi assistants use 'custom-voice' provider pointing to this URL.
   * When absent, assistants use Vapi native 'Naina V2' voice instead.
   */
  SARVAM_BRIDGE_URL: z.string().optional(),
  /** Sarvam TTS model — default: 'bulbul:v3' */
  TTS_MODEL: z.string().default('bulbul:v3'),
  /** Sarvam TTS language code — default: 'hi-IN' */
  TTS_LANGUAGE_CODE: z.string().default('hi-IN'),
  /** Sarvam TTS speaker name — default: 'shubh' */
  TTS_SPEAKER: z.string().default('shubh'),

  // ── Vobiz SIP Trunk (sole telephony provider — https://vobiz.ai) ────────
  /**
   * Unique SIP domain for your outbound trunk.
   * Found in Vobiz Console → SIP Trunk → Outbound Trunks → your trunk
   * → Authentication & Linking → SIP Domain.
   * Format: <unique_id>.sip.vobiz.ai
   */
  VOBIZ_SIP_DOMAIN: z.string().optional(),
  /**
   * SIP trunk username (trunk-level, not the account Auth ID).
   * Found in the same Authentication & Linking section as VOBIZ_SIP_DOMAIN.
   */
  VOBIZ_AUTH_USERNAME: z.string().optional(),
  /** SIP trunk password — from Authentication & Linking section. */
  VOBIZ_AUTH_PASSWORD: z.string().optional(),
  /**
   * Vapi credential ID returned after POST https://api.vapi.ai/credential
   * with the byo-sip-trunk payload. Stored here as a shared outbound credential
   * (per-org inbound credential IDs are stored on the Organization document).
   */
  VOBIZ_VAPI_CREDENTIAL_ID: z.string().optional(),

  // ── Stripe ───────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY:          z.string().optional(), // sk_live_... or sk_test_...
  STRIPE_WEBHOOK_SECRET:      z.string().optional(), // whsec_...
  // Primary price IDs (used as fallback if INR variants are not set)
  // starter = Basic (₹9,999/mo), growth = Standard (₹17,999/mo), enterprise = Pro (₹25,999/mo)
  STRIPE_STARTER_PRICE_ID:    z.string().optional(), // price_... for Basic plan
  STRIPE_GROWTH_PRICE_ID:     z.string().optional(), // price_... for Standard plan
  STRIPE_PRO_PRICE_ID:        z.string().optional(), // price_... for Pro plan
  // INR-denominated price IDs — set these to charge Indian customers in ₹
  // Create them in your Stripe dashboard with currency = INR, then paste the IDs here.
  // When set, these take priority over the primary price IDs above.
  STRIPE_STARTER_PRICE_ID_INR: z.string().optional(), // price_... Basic plan (INR)
  STRIPE_GROWTH_PRICE_ID_INR:  z.string().optional(), // price_... Standard plan (INR)
  STRIPE_PRO_PRICE_ID_INR:     z.string().optional(), // price_... Pro plan (INR)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid / missing environment variables:\n');
  const errors = parsed.error.flatten().fieldErrors;
  Object.entries(errors).forEach(([key, messages]) => {
    console.error(`  ${key}: ${messages?.join(', ')}`);
  });
  console.error('\n  → Copy backend/.env.example to backend/.env and fill in the values.\n');
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
