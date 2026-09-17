/**
 * Telephony Service — manages SIP trunk configuration for connecting
 * Indian PSTN phone numbers to Vapi assistants via Vobiz SIP trunking.
 *
 * Provider: Vobiz (https://vobiz.ai)
 *   - Native Vapi byo-sip-trunk integration — no bridge service required.
 *   - ~80ms latency, Indian regulated number series (140/1600/92).
 *   - TRAI compliance: NDNC scrubbing documented, Tata DLT platform.
 *   - Legal entity: Ilaimitado Private Limited (Bangalore, 2025).
 *
 * Architecture (multi-tenant):
 *   - Shared Vobiz account → multiple phone numbers purchased under it.
 *   - Shared SIP trunk credentials → stored in ENV (VOBIZ_SIP_DOMAIN etc.)
 *   - Per-org phone number, vapiPhoneNumberId, vapiCredentialId → stored on
 *     the Organization document in MongoDB (NOT in env vars).
 *
 * Vapi integration steps (per org):
 *   1. POST https://api.vapi.ai/credential  → buildVapiOutboundCredentialPayload()
 *      → store returned credentialId on org.vapiCredentialId
 *   2. POST https://api.vapi.ai/phone-number → buildVapiPhoneNumberPayload()
 *      → store returned phoneNumberId on org.vapiPhoneNumberId
 *
 * Inbound call setup (one-time, in Vapi dashboard):
 *   1. In Vapi: Integrations → SIP Trunk → Create New SIP Trunk ("Vobiz Inbound")
 *      Add one gateway per Vobiz SIP signaling IP (port 5060, UDP, inbound only):
 *        13.203.7.132 / 65.2.100.211 / 13.126.98.234 / 13.235.11.131 / 13.233.44.61
 *        3.111.255.163 / 3.111.128.110 / 43.204.64.203 / 15.207.232.91 / 35.154.133.28
 *   2. Fetch the Vapi trunk ID: GET https://api.vapi.ai/credential → find your trunk → copy `id`
 *   3. In Vobiz Console → SIP Trunk → Inbound Trunks → Create New Trunk
 *      Set Primary URI: <VAPI_TRUNK_ID>.sip.vapi.ai
 *      Link your phone number(s) to this trunk.
 *   4. In Vapi: Phone Numbers → your number → Inbound Settings → assign assistant.
 *
 * Docs: https://www.vobiz.ai/docs/integrations/vapi-dashboard
 */

import { env } from '../../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TelephonyProvider = 'vobiz' | 'none';

export interface SipTrunkConfig {
  provider: TelephonyProvider;
  /**
   * Unique SIP domain for the outbound trunk.
   * Format: <unique_id>.sip.vobiz.ai
   * Source: Vobiz Console → SIP Trunk → Outbound Trunks → your trunk
   *         → Authentication & Linking → SIP Domain
   */
  sipDomain: string;
  /** SIP trunk username (from Authentication & Linking — trunk-level, not account Auth ID) */
  authUsername?: string;
  /** SIP trunk password (from Authentication & Linking) */
  authPassword?: string;
  /** Phone number in E.164 format (e.g. +918065354620) — stored per-org in DB */
  phoneNumber: string;
  /** Vapi assistant ID to assign this number to — stored per-org in DB */
  assistantId: string;
  /** Vapi credential ID returned after POST /credential — stored per-org in DB */
  vapiCredentialId?: string;
}

// ─── Config Builder ───────────────────────────────────────────────────────────

/**
 * Build the Vobiz SIP trunk config from env vars + per-org values.
 * Shared credentials come from ENV; phone number and assistant ID are per-org.
 */
export function buildVobizConfig(phoneNumber: string, assistantId: string): SipTrunkConfig {
  return {
    provider:     'vobiz',
    sipDomain:    env.VOBIZ_SIP_DOMAIN ?? '',
    authUsername: env.VOBIZ_AUTH_USERNAME,
    authPassword: env.VOBIZ_AUTH_PASSWORD,
    phoneNumber,
    assistantId,
  };
}

// ─── Vapi Payload Builders ────────────────────────────────────────────────────

/**
 * Returns the Vapi credential payload for a Vobiz byo-sip-trunk (outbound).
 * POST to: https://api.vapi.ai/credential
 * Authorization: Bearer VAPI_API_KEY
 *
 * The SIP domain (e.g. abc123.sip.vobiz.ai) is used as the gateway — Vapi
 * accepts both IP addresses and domain names in the gateways[].ip field.
 */
export function buildVapiOutboundCredentialPayload(config: SipTrunkConfig): Record<string, unknown> {
  return {
    provider:     'byo-sip-trunk',
    name:         `Vobiz Outbound — ${config.phoneNumber}`,
    gateways:     [{ ip: config.sipDomain }],
    authUsername: config.authUsername ?? '',
    authPassword: config.authPassword ?? '',
    outboundEnabled: true,
    inboundEnabled:  false,
  };
}

/**
 * Returns the Vapi phone-number payload (outbound caller ID / inbound routing).
 * POST to: https://api.vapi.ai/phone-number
 * Authorization: Bearer VAPI_API_KEY
 *
 * The credential must already exist (call buildVapiOutboundCredentialPayload first).
 */
export function buildVapiPhoneNumberPayload(config: SipTrunkConfig): Record<string, unknown> {
  return {
    provider:     'byo-phone-number',
    number:       config.phoneNumber,
    credentialId: config.vapiCredentialId ?? '[CREATE_CREDENTIAL_FIRST]',
    assistantId:  config.assistantId,
  };
}

// ─── Vobiz Inbound SIP Signaling IPs ─────────────────────────────────────────

/**
 * Complete list of Vobiz SIP signaling IPs for inbound call setup.
 * All 10 must be added as gateways in the Vapi inbound SIP trunk credential
 * (port 5060, UDP, inbound only, outbound disabled).
 *
 * Source: https://www.vobiz.ai/docs/concepts/ip-whitelisting#sip-signaling
 * ⚠ These IPs can change — verify against Vobiz docs before configuring.
 */
export const VOBIZ_SIGNALING_IPS = [
  '13.203.7.132',
  '65.2.100.211',
  '13.126.98.234',
  '13.235.11.131',
  '13.233.44.61',
  '3.111.255.163',
  '3.111.128.110',
  '43.204.64.203',
  '15.207.232.91',
  '35.154.133.28',
] as const;

/**
 * Returns the Vapi inbound SIP trunk credential payload.
 * This is a ONE-TIME shared setup (not per-org).
 * POST to: https://api.vapi.ai/credential
 *
 * After creation, fetch the credential ID via GET /credential, then
 * create the Vobiz inbound trunk pointing to <credentialId>.sip.vapi.ai
 */
export function buildVapiInboundCredentialPayload(): Record<string, unknown> {
  return {
    provider: 'byo-sip-trunk',
    name:     'Vobiz Inbound',
    gateways: VOBIZ_SIGNALING_IPS.map(ip => ({
      ip,
      port:            5060,
      netmask:         32,
      outboundEnabled: false,
      inboundEnabled:  true,
    })),
    outboundEnabled: false,
    inboundEnabled:  true,
  };
}

// ─── Status Summary ───────────────────────────────────────────────────────────

/**
 * Returns the active telephony configuration summary.
 * Useful for the admin dashboard / health check / debugging.
 */
export function getTelephonyStatus() {
  const vobizConfigured = !!(env.VOBIZ_SIP_DOMAIN && env.VOBIZ_AUTH_USERNAME && env.VOBIZ_AUTH_PASSWORD);

  return {
    activeProvider: vobizConfigured ? 'vobiz' as const : 'none' as const,
    vobiz: {
      configured:       vobizConfigured,
      sipDomain:        env.VOBIZ_SIP_DOMAIN     ?? 'not set',
      authUsername:     env.VOBIZ_AUTH_USERNAME   ?? 'not set',
      latency:          '~80ms',
      integration:      'Native Vapi byo-sip-trunk (no bridge service required)',
      compliance:       'NDNC scrubbing documented, Tata DLT platform',
      inboundSetup:     'See VOBIZ_SIGNALING_IPS in telephony.service.ts — whitelist all 10 IPs in Vapi',
      docs:             'https://www.vobiz.ai/docs/integrations/vapi-dashboard',
    },
    phoneNumbers: {
      note:   'Per-org phone numbers are stored on the Organization document (not in env vars).',
      fields: ['phoneNumber', 'vapiPhoneNumberId', 'vapiCredentialId', 'vapiAssistantId'],
    },
  };
}
