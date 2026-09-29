/**
 * Number service — lets a customer pick an Indian phone number in onboarding
 * Step 5 (Activate) and wires it to Vapi automatically.
 *
 * Model: shared number pool.
 *   The founder buys numbers in the shared Vobiz account and links each one to
 *   the "Vobiz Inbound" trunk in the Vobiz Console (one-time, per number).
 *   Customers then pick any unassigned number from that pool. Nothing is
 *   purchased on the customer's click, so no Vobiz balance is spent here.
 *
 * Claim flow (claimNumber):
 *   1. Validate + check the org does not already have a number.
 *   2. Confirm the number is in the Vobiz account and usable.
 *   3. Reserve it on the org (unique index blocks double-claims).
 *   4. Import it into Vapi against the shared inbound credential, WITHOUT an
 *      assistantId — inbound calls then hit the assistant-request webhook, which
 *      applies the minutes quota + business-hours routing (webhook.service.ts).
 *   5. Store vapiPhoneNumberId. Any failure after step 3 rolls the org back.
 */

import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  AppError,
  Conflict,
  Forbidden,
  NotFound,
  BadRequest,
} from '../../middleware/errorHandler';
import {
  MembershipModel,
  OrganizationModel,
  type IOrganization,
} from '../organization/organization.model';
import { vapiCreatePhoneNumber, vapiDeletePhoneNumber } from '../agents/vapi.service';
import { isVobizApiConfigured, listAccountNumbers, type VobizPhoneNumber } from './vobiz.client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvailableNumber {
  e164: string;
  /** Human-friendly, e.g. "+91 80 7138 7376" */
  display: string;
  region: string | null;
}

export interface AssignedNumber {
  phoneNumber: string | null;
  display: string | null;
  vapiPhoneNumberId: string | null;
  /** true when the org has a Vapi phone ID but it was linked manually (no E.164 on file) */
  linkedManually: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INDIA_E164_RE = /^\+91\d{8,12}$/;

export function formatIndianNumber(e164: string): string {
  if (!e164.startsWith('+91')) return e164;
  const rest = e164.slice(3);
  if (rest.length === 10) return `+91 ${rest.slice(0, 2)} ${rest.slice(2, 6)} ${rest.slice(6)}`;
  return `+91 ${rest}`;
}

/** A number customers may be given: Indian, active, voice on, not blocked, KYC satisfied. */
export function isUsable(n: VobizPhoneNumber): boolean {
  if (!n.e164 || !INDIA_E164_RE.test(n.e164)) return false;
  if (n.status && n.status !== 'active') return false;
  if (n.voice_enabled === false) return false;
  if (n.is_blocked) return false;
  if (n.aadhaar_verification_required && !n.aadhaar_verified) return false;
  return true;
}

function inboundCredentialId(): string | undefined {
  return env.VOBIZ_VAPI_INBOUND_CREDENTIAL_ID || env.VOBIZ_VAPI_CREDENTIAL_ID || undefined;
}

function notConfigured(): AppError {
  return new AppError(
    503,
    'Phone numbers are not available yet. You can launch now and add a number later from Settings.',
    'TELEPHONY_NOT_CONFIGURED',
  );
}

async function getMembership(userId: string) {
  const membership = await MembershipModel.findOne({ userId }).populate<{
    organizationId: IOrganization;
  }>('organizationId');
  if (!membership || !membership.organizationId) throw NotFound('Organization');
  return { org: membership.organizationId as IOrganization, role: membership.role };
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAssignedNumber(userId: string): Promise<AssignedNumber> {
  const { org } = await getMembership(userId);
  return {
    phoneNumber:       org.phoneNumber ?? null,
    display:           org.phoneNumber ? formatIndianNumber(org.phoneNumber) : null,
    vapiPhoneNumberId: org.vapiPhoneNumberId ?? null,
    linkedManually:    !!org.vapiPhoneNumberId && !org.phoneNumber,
  };
}

/** Unassigned, usable numbers from the shared Vobiz pool. */
export async function listAvailableNumbers(userId: string): Promise<AvailableNumber[]> {
  await getMembership(userId);
  if (!isVobizApiConfigured() || !inboundCredentialId()) throw notConfigured();

  let pool: VobizPhoneNumber[];
  try {
    pool = (await listAccountNumbers()).filter(isUsable);
  } catch (err) {
    logger.error('Vobiz number listing failed', { error: (err as Error).message });
    throw new AppError(502, 'Could not load phone numbers right now. Please try again.', 'VOBIZ_UNAVAILABLE');
  }

  const taken = await OrganizationModel.find(
    { phoneNumber: { $in: pool.map((n) => n.e164) } },
    { phoneNumber: 1 },
  ).lean();
  const takenSet = new Set(taken.map((o) => o.phoneNumber));

  return pool
    .filter((n) => !takenSet.has(n.e164))
    .sort((a, b) => a.e164.localeCompare(b.e164))
    .map((n) => ({ e164: n.e164, display: formatIndianNumber(n.e164), region: n.region ?? null }));
}

/** Assign a pool number to the caller's org and import it into Vapi. Idempotent for the same number. */
export async function claimNumber(userId: string, e164Raw: string): Promise<AssignedNumber> {
  const e164 = (e164Raw ?? '').trim();
  if (!INDIA_E164_RE.test(e164)) throw BadRequest('Please choose a valid Indian phone number.', 'INVALID_NUMBER');

  const { org, role } = await getMembership(userId);
  if (role !== 'Owner') throw Forbidden('Only the workspace owner can choose a phone number.');

  // Idempotent repeat (e.g. double click / refresh after success)
  if (org.phoneNumber === e164 && org.vapiPhoneNumberId) return getAssignedNumber(userId);
  if (org.phoneNumber || org.vapiPhoneNumberId) {
    throw Conflict('Your workspace already has a phone number.', 'NUMBER_ALREADY_ASSIGNED');
  }

  const credentialId = inboundCredentialId();
  if (!isVobizApiConfigured() || !credentialId) throw notConfigured();

  // ── Confirm it is really ours and usable ─────────────────────────────────
  let match: VobizPhoneNumber | undefined;
  try {
    match = (await listAccountNumbers(e164)).find((n) => n.e164 === e164);
  } catch (err) {
    logger.error('Vobiz number lookup failed', { error: (err as Error).message, e164 });
    throw new AppError(502, 'Could not verify that number right now. Please try again.', 'VOBIZ_UNAVAILABLE');
  }
  if (!match || !isUsable(match)) {
    throw Conflict('That number is no longer available. Please pick another.', 'NUMBER_UNAVAILABLE');
  }

  // ── Reserve on the org (unique index stops two orgs taking the same number) ─
  try {
    const reserved = await OrganizationModel.updateOne(
      { _id: org._id, phoneNumber: null, vapiPhoneNumberId: null },
      { $set: { phoneNumber: e164, telephonyProvider: 'vobiz' } },
    );
    if (reserved.matchedCount === 0) {
      throw Conflict('Your workspace already has a phone number.', 'NUMBER_ALREADY_ASSIGNED');
    }
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw Conflict('That number was just taken. Please pick another.', 'NUMBER_TAKEN');
    }
    throw err;
  }

  const rollback = async () => {
    await OrganizationModel.updateOne(
      { _id: org._id, phoneNumber: e164 },
      { $unset: { phoneNumber: 1, telephonyProvider: 1, vapiPhoneNumberId: 1, vapiCredentialId: 1 } },
    ).catch((e: Error) => logger.error('Number claim rollback failed', { orgId: org._id.toString(), error: e.message }));
  };

  // ── Import into Vapi (no assistantId → assistant-request routing) ─────────
  let vapiPhoneNumberId: string;
  try {
    const phone = await vapiCreatePhoneNumber({
      provider:               'byo-phone-number',
      name:                   `${org.name}`.slice(0, 40),
      number:                 e164,
      numberE164CheckEnabled: true,
      credentialId,
    });
    vapiPhoneNumberId = phone.id;
  } catch (err) {
    await rollback();
    logger.error('Vapi phone import failed', { orgId: org._id.toString(), e164, error: (err as Error).message });
    throw new AppError(502, 'We could not connect that number. Please try again or pick another.', 'VAPI_PHONE_IMPORT_FAILED');
  }

  try {
    await OrganizationModel.updateOne(
      { _id: org._id },
      { $set: { vapiPhoneNumberId, vapiCredentialId: credentialId } },
    );
  } catch (err) {
    await vapiDeletePhoneNumber(vapiPhoneNumberId).catch(() => undefined);
    await rollback();
    throw err;
  }

  logger.info('Phone number claimed', { orgId: org._id.toString(), e164, vapiPhoneNumberId });
  return {
    phoneNumber:       e164,
    display:           formatIndianNumber(e164),
    vapiPhoneNumberId,
    linkedManually:    false,
  };
}
