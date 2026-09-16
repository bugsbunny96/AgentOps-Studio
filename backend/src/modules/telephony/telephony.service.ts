/**
 * Telephony Service — manages SIP trunk configuration for connecting
 * Indian PSTN phone numbers to Vapi assistants.
 *
 * Two providers supported:
 *
 * 1. Vobiz (RECOMMENDED for launch):
 *    - Native Vapi byo-sip-trunk integration — no bridge service required.
 *    - ~80ms latency, Indian regulated number series (140/1600/92).
 *    - Self-serve signup: https://vobiz.ai
 *    - KYC required for regulated number series.
 *    - Compliance: NDNC scrubbing documented, Tata DLT platform.
 *    - Legal entity: Ilaimitado Private Limited (Bangalore, 2025).
 *    - Set env vars: VOBIZ_SIP_DOMAIN, VOBIZ_AUTH_USERNAME,
 *                    VOBIZ_AUTH_PASSWORD, VOBIZ_GATEWAY_IP, VOBIZ_PHONE_NUMBER
 *
 * 2. Exotel (FALLBACK — proven compliance, higher latency):
 *    - Uses the Exotel-Vapi-Connector bridge (deploy separately).
 *    - ~300ms latency, decade-plus track record, explicit DND scrubbing.
 *    - Connector repo: https://github.com/exotel/Exotel-Vapi-Connector
 *    - Set env vars: EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SID,
 *                    EXOTEL_CONNECTOR_URL, VOBIZ_PHONE_NUMBER (same number, different trunk)
 *
 * Number strategy:
 *   - Default: NEW virtual number from Vobiz/Exotel (don't port existing number).
 *   - Client's existing number can forward to the new virtual number.
 *   - MNP porting is a phase-2 upgrade (~2 extra weeks).
 *
 * To register a SIP trunk in Vapi:
 *   1. POST https://api.vapi.ai/credential  with buildVapiCredentialPayload()
 *   2. Note the returned credentialId — store as org.vapiCredentialId
 *   3. POST https://api.vapi.ai/phone-number with buildVapiPhoneNumberPayload()
 *   4. Note the returned phoneNumberId — store as org.vapiPhoneNumberId
 */

import { env } from '../../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TelephonyProvider = 'vobiz' | 'exotel' | 'none';

export interface SipTrunkConfig {
  provider: TelephonyProvider;
  /** Vobiz: *.sip.vobiz.ai   Exotel: connector hostname */
  sipDomain?: string;
  authUsername?: string;
  authPassword?: string;
  /** SIP gateway IP — Vobiz resolves sipDomain to this */
  gatewayIp?: string;
  /** Phone number in E.164 format (e.g. +911XXXXXXXXXX) */
  phoneNumber: string;
  /** Vapi assistant ID to assign this number to */
  assistantId: string;
  /** Set after the Vapi credential is created — stored on org document */
  vapiCredentialId?: string;
  // Exotel-specific
  exotelConnectorUrl?: string;
}

// ─── Config Builders ──────────────────────────────────────────────────────────

/**
 * Build the Vobiz SIP trunk config from env vars.
 * Mirrors telephony/vobiz-setup.md step 2 from the POC project.
 */
export function buildVobizConfig(assistantId: string): SipTrunkConfig {
  return {
    provider:      'vobiz',
    sipDomain:     env.VOBIZ_SIP_DOMAIN,
    authUsername:  env.VOBIZ_AUTH_USERNAME,
    authPassword:  env.VOBIZ_AUTH_PASSWORD,
    gatewayIp:     env.VOBIZ_GATEWAY_IP,
    phoneNumber:   env.VOBIZ_PHONE_NUMBER ?? '',
    assistantId,
  };
}

/**
 * Build the Exotel fallback config from env vars.
 * The EXOTEL_CONNECTOR_URL is the deployed Exotel-Vapi-Connector host.
 */
export function buildExotelConfig(assistantId: string): SipTrunkConfig {
  return {
    provider:           'exotel',
    authUsername:       env.EXOTEL_API_KEY,
    gatewayIp:          env.EXOTEL_CONNECTOR_URL,
    phoneNumber:        env.VOBIZ_PHONE_NUMBER ?? '',  // same number, different trunk
    assistantId,
    exotelConnectorUrl: env.EXOTEL_CONNECTOR_URL,
  };
}

// ─── Vapi Payload Builders ────────────────────────────────────────────────────

/**
 * Returns the Vapi credential payload for a byo-sip-trunk.
 * POST to: https://api.vapi.ai/credential
 * Authorization: Bearer VAPI_API_KEY
 *
 * For Vobiz: gateways[0].ip = Vobiz gateway IP; authUsername/Password from Vobiz console.
 * For Exotel: gatewayIp = Exotel-Vapi-Connector host; credentials from Exotel dashboard.
 */
export function buildVapiCredentialPayload(config: SipTrunkConfig): Record<string, unknown> {
  if (config.provider === 'vobiz') {
    return {
      provider:     'byo-sip-trunk',
      gateways:     [{ ip: config.gatewayIp ?? config.sipDomain }],
      authUsername: config.authUsername,
      authPassword: config.authPassword ?? '[SET_VOBIZ_AUTH_PASSWORD]',
      // For inbound calls: add inboundEnabled: true and Vobiz signaling IPs
      // (request signaling IPs from Vobiz support)
    };
  }

  // Exotel path — the connector handles SIP bridging
  return {
    provider:     'byo-sip-trunk',
    gateways:     [{ ip: config.gatewayIp }],
    authUsername: config.authUsername ?? '[SET_EXOTEL_API_KEY]',
    authPassword: env.EXOTEL_API_TOKEN ?? '[SET_EXOTEL_API_TOKEN]',
  };
}

/**
 * Returns the Vapi phone-number payload.
 * POST to: https://api.vapi.ai/phone-number
 * Authorization: Bearer VAPI_API_KEY
 *
 * This links the SIP trunk credential to a phone number
 * and assigns the assistant to answer calls on that number.
 * The credential must already exist (buildVapiCredentialPayload + POST first).
 */
export function buildVapiPhoneNumberPayload(config: SipTrunkConfig): Record<string, unknown> {
  return {
    provider:     'byo-phone-number',
    number:       config.phoneNumber,
    credentialId: config.vapiCredentialId ?? '[CREATE_CREDENTIAL_FIRST]',
    assistantId:  config.assistantId,
  };
}

// ─── Status Summary ───────────────────────────────────────────────────────────

/**
 * Returns the active telephony configuration summary.
 * Useful for the admin dashboard / health check / debugging.
 */
export function getTelephonyStatus() {
  const vobizConfigured  = !!env.VOBIZ_SIP_DOMAIN;
  const exotelConfigured = !!env.EXOTEL_API_KEY;

  const activeProvider: TelephonyProvider =
    vobizConfigured  ? 'vobiz'  :
    exotelConfigured ? 'exotel' :
    'none';

  return {
    activeProvider,
    vobiz: {
      configured:        vobizConfigured,
      sipDomain:         env.VOBIZ_SIP_DOMAIN     ?? 'not set',
      phoneNumber:       env.VOBIZ_PHONE_NUMBER    ?? 'not set',
      latency:           '~80ms',
      integration:       'Native Vapi byo-sip-trunk (no bridge service required)',
      complianceStatus:  'Verify before go-live — DND scrubbing documented, carrier not fully disclosed',
    },
    exotel: {
      configured:        exotelConfigured,
      latency:           '~300ms',
      integration:       'Exotel-Vapi-Connector bridge (deploy separately)',
      connectorRepo:     'https://github.com/exotel/Exotel-Vapi-Connector',
      complianceStatus:  'Proven — decade-plus track record, explicit real-time DND scrubbing',
    },
    numberStrategy: {
      recommendation: "New virtual number — don't port existing",
      reasoning:      'MNP porting adds ~2 weeks, no functional benefit for launch',
      alternative:    "Forward client's existing number to the new virtual number",
    },
  };
}
