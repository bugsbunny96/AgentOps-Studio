/**
 * Number service — the customer's own business phone number.
 *
 * Model (number automation, 2026-10-08):
 *   - Trial accounts do NOT get their own number. They call out from the shared
 *     trial numbers (VOBIZ_TRIAL_NUMBERS / VAPI_TRIAL_PHONE_NUMBER_IDS, see
 *     calls/outbound.service.ts); inbound needs a paid plan.
 *   - Paid plans choose a number (or "pick one for me"):
 *       1. spare numbers already owned in the Vobiz account (no extra cost), then
 *       2. local numbers from Vobiz inventory (≤ NUMBER_MAX_MONTHLY_FEE_INR/month,
 *          no 92-series) — bought on claim, linked to VOBIZ_INBOUND_TRUNK_GROUP_ID.
 *   - When a plan is cancelled the number is unlinked from the org and Vapi but
 *     kept in the Vobiz account (spare pool) — releasing costs ₹700.
 *
 * Claim flow (claimNumber):
 *   1. Paid plan + Owner + org has no number yet.
 *   2. Owned spare → check usable. Inventory → check local, then buy + link trunk.
 *   3. Reserve on the org (unique index blocks double-claims).
 *   4. Import into Vapi against the shared inbound credential, WITHOUT an
 *      assistantId — inbound calls then hit the assistant-request webhook, which
 *      applies the minutes quota + business-hours routing (webhook.service.ts).
 *   5. Store vapiPhoneNumberId. Any failure after step 3 rolls the org back
 *      (a bought number stays in the account as a spare).
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
import {
  isVobizApiConfigured, listAccountNumbers, listInventoryNumbers, purchaseFromInventory, assignNumberToTrunk,
  type VobizPhoneNumber, type VobizInventoryNumber,
} from './vobiz.client';
import { getPlanInfo, type PlanState } from '../calls/call-capacity';
import { sendEmail } from '../../utils/email';
import { membershipFilter } from '../../utils/requestContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvailableNumber {
  e164: string;
  /** Human-friendly, e.g. "+91 80 7138 7376" */
  display: string;
  region: string | null;
  /** 'owned' = spare number already in our Vobiz account; 'inventory' = bought on claim */
  source: 'owned' | 'inventory';
}

export interface AssignedNumber {
  phoneNumber: string | null;
  display: string | null;
  vapiPhoneNumberId: string | null;
  /** true when the org has a Vapi phone ID but it was linked manually (no E.164 on file) */
  linkedManually: boolean;
  /** 'paid' may choose a number; 'trial' calls out from a shared number; 'none' needs a plan */
  planState?: PlanState;
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

/** Shared trial numbers — never offered to a customer. */
export function trialNumbers(): Set<string> {
  return new Set(env.VOBIZ_TRIAL_NUMBERS.split(',').map((x) => x.trim()).filter(Boolean));
}

/** A Vobiz inventory number we may buy: Indian local, voice, no KYC, ≤ fee cap, no 92-series. */
export function isLocalInventoryNumber(n: VobizInventoryNumber): boolean {
  if (!n.e164 || !INDIA_E164_RE.test(n.e164)) return false;
  const type = String(n.number_type ?? n.type ?? '').toLowerCase();
  if (type && !['local', 'landline', 'geographic'].includes(type)) return false;
  if (/^\+9192/.test(n.e164)) return false;                          // 92-series (₹1,000/month)
  if (n.voice_enabled === false) return false;
  if (n.aadhaar_verification_required) return false;
  if (typeof n.monthly_fee === 'number' && n.monthly_fee > env.NUMBER_MAX_MONTHLY_FEE_INR) return false;
  return true;
}

/** Inventory suggestions shown per request. */
export const INVENTORY_SUGGESTIONS = 12;

function canBuyNumbers(): boolean {
  return !!env.VOBIZ_INBOUND_TRUNK_GROUP_ID;
}

/** Logs and (when OPS_ALERT_EMAIL is set) emails the founder. Never throws. */
async function alertOps(subject: string, details: Record<string, unknown>): Promise<void> {
  logger.error(`[ops-alert] ${subject}`, details);
  if (!env.OPS_ALERT_EMAIL) return;
  const rows = Object.entries(details).map(([k, v]) => `<li><b>${k}</b>: ${String(v).replace(/</g, '&lt;')}</li>`).join('');
  await sendEmail({ to: env.OPS_ALERT_EMAIL, subject: `[AgentOps] ${subject}`, html: `<p>${subject}</p><ul>${rows}</ul>` })
    .catch((e: Error) => logger.error('Ops alert email failed', { error: e.message }));
}

function needsPlan(): AppError {
  return new AppError(
    402,
    'Your own business number comes with a paid plan. During the free trial your agent calls out from a shared number.',
    'NUMBER_NEEDS_PLAN',
  );
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
  const membership = await MembershipModel.findOne(membershipFilter(userId)).populate<{
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
    planState:         getPlanInfo(org).state,
  };
}

/** Spare numbers we already own: usable, not on an org, not a shared trial number. */
async function listOwnedSpares(): Promise<VobizPhoneNumber[]> {
  const pool  = (await listAccountNumbers()).filter(isUsable);
  const trial = trialNumbers();
  const taken = await OrganizationModel.find(
    { phoneNumber: { $in: pool.map((n) => n.e164) } },
    { phoneNumber: 1 },
  ).lean();
  const takenSet = new Set(taken.map((o) => o.phoneNumber));
  return pool
    .filter((n) => !takenSet.has(n.e164) && !trial.has(n.e164))
    .sort((a, b) => a.e164.localeCompare(b.e164));
}

/** Local numbers for sale (search = digits the number should contain). */
async function listInventoryLocal(search?: string): Promise<VobizInventoryNumber[]> {
  const items = await listInventoryNumbers({ search, perPage: 100 });
  return items
    .filter(isLocalInventoryNumber)
    .sort((a, b) => (a.monthly_fee ?? 0) - (b.monthly_fee ?? 0) || a.e164.localeCompare(b.e164))
    .slice(0, INVENTORY_SUGGESTIONS);
}

/**
 * Numbers the org can choose: spare owned numbers first, then local inventory.
 * Paid plans only. `search` (digits) filters both lists.
 */
export async function listAvailableNumbers(userId: string, search?: string): Promise<AvailableNumber[]> {
  const { org } = await getMembership(userId);
  if (getPlanInfo(org).state !== 'paid') throw needsPlan();
  if (!isVobizApiConfigured() || !inboundCredentialId()) throw notConfigured();

  const digits = (search ?? '').replace(/\D/g, '').slice(0, 12) || undefined;

  let owned: VobizPhoneNumber[];
  try {
    owned = await listOwnedSpares();
  } catch (err) {
    logger.error('Vobiz number listing failed', { error: (err as Error).message });
    throw new AppError(502, 'Could not load phone numbers right now. Please try again.', 'VOBIZ_UNAVAILABLE');
  }
  if (digits) owned = owned.filter((n) => n.e164.replace(/\D/g, '').includes(digits));

  let inventory: VobizInventoryNumber[] = [];
  if (canBuyNumbers()) {
    try {
      const ownedSet = new Set(owned.map((n) => n.e164));
      inventory = (await listInventoryLocal(digits)).filter((n) => !ownedSet.has(n.e164));
    } catch (err) {
      // Owned spares still work without the inventory
      logger.error('Vobiz inventory listing failed', { error: (err as Error).message });
    }
  }

  return [
    ...owned.map((n): AvailableNumber => ({ e164: n.e164, display: formatIndianNumber(n.e164), region: n.region ?? null, source: 'owned' })),
    ...inventory.map((n): AvailableNumber => ({ e164: n.e164, display: formatIndianNumber(n.e164), region: n.region ?? null, source: 'inventory' })),
  ];
}

/** "Pick one for me": first spare owned number, else the first local inventory number. */
export async function autoAssignNumber(userId: string): Promise<AssignedNumber> {
  const { org } = await getMembership(userId);
  if (org.phoneNumber && org.vapiPhoneNumberId) return getAssignedNumber(userId);
  const options = await listAvailableNumbers(userId);
  if (options.length === 0) {
    await alertOps('No phone numbers available for a paying customer', { orgId: org._id.toString(), orgName: org.name });
    throw Conflict('No numbers are available right now. We have been notified and will assign one shortly.', 'NO_NUMBERS_AVAILABLE');
  }
  let lastErr: unknown;
  for (const option of options.slice(0, 3)) {
    try {
      return await claimNumber(userId, option.e164);
    } catch (err) {
      lastErr = err;
      if (!(err instanceof AppError) || !['NUMBER_UNAVAILABLE', 'NUMBER_TAKEN'].includes(err.code ?? '')) throw err;
    }
  }
  throw lastErr;
}

/**
 * Unlinks the org's number (plan cancelled): removed from Vapi and the org, kept
 * in the Vobiz account as a spare for the next customer. Never throws.
 */
export async function releaseOrgNumber(orgId: string): Promise<void> {
  const org = await OrganizationModel.findById(orgId);
  if (!org?.phoneNumber && !org?.vapiPhoneNumberId) return;
  try {
    if (org.vapiPhoneNumberId) await vapiDeletePhoneNumber(org.vapiPhoneNumberId);
  } catch (err) {
    logger.error('Vapi phone delete failed while releasing number', { orgId, error: (err as Error).message });
  }
  await OrganizationModel.updateOne(
    { _id: org._id },
    { $unset: { phoneNumber: 1, telephonyProvider: 1, vapiPhoneNumberId: 1, vapiCredentialId: 1 } },
  );
  logger.info('Phone number returned to the spare pool', { orgId, e164: org.phoneNumber });
}

/** Assign a spare or newly bought number to the caller's org and import it into Vapi. Idempotent for the same number. */
export async function claimNumber(userId: string, e164Raw: string): Promise<AssignedNumber> {
  const e164 = (e164Raw ?? '').trim();
  if (!INDIA_E164_RE.test(e164)) throw BadRequest('Please choose a valid Indian phone number.', 'INVALID_NUMBER');

  const { org, role } = await getMembership(userId);
  if (role !== 'Owner') throw Forbidden('Only the workspace owner can choose a phone number.');
  if (getPlanInfo(org).state !== 'paid') throw needsPlan();
  if (trialNumbers().has(e164)) throw Conflict('That number is not available. Please pick another.', 'NUMBER_UNAVAILABLE');

  // Idempotent repeat (e.g. double click / refresh after success)
  if (org.phoneNumber === e164 && org.vapiPhoneNumberId) return getAssignedNumber(userId);
  if (org.phoneNumber || org.vapiPhoneNumberId) {
    throw Conflict('Your workspace already has a phone number.', 'NUMBER_ALREADY_ASSIGNED');
  }

  const credentialId = inboundCredentialId();
  if (!isVobizApiConfigured() || !credentialId) throw notConfigured();

  // ── Spare number we own, or a local number we can buy? ──────────────────
  let owned: VobizPhoneNumber | undefined;
  let forSale: VobizInventoryNumber | undefined;
  try {
    owned = (await listAccountNumbers(e164)).find((n) => n.e164 === e164);
    if (!owned && canBuyNumbers()) {
      forSale = (await listInventoryNumbers({ search: e164.replace(/\D/g, '') })).find((n) => n.e164 === e164);
    }
  } catch (err) {
    logger.error('Vobiz number lookup failed', { error: (err as Error).message, e164 });
    throw new AppError(502, 'Could not verify that number right now. Please try again.', 'VOBIZ_UNAVAILABLE');
  }
  if (owned ? !isUsable(owned) : !(forSale && isLocalInventoryNumber(forSale))) {
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

  // ── Buy it (inventory) and make sure it routes to our trunk ─────────────
  const trunkGroupId = env.VOBIZ_INBOUND_TRUNK_GROUP_ID;
  if (!owned) {
    try {
      await purchaseFromInventory(e164);
      logger.info('Phone number bought from Vobiz inventory', { orgId: org._id.toString(), e164, monthlyFee: forSale?.monthly_fee });
    } catch (err) {
      await rollback();
      await alertOps('Vobiz number purchase failed', { orgId: org._id.toString(), orgName: org.name, e164, error: (err as Error).message });
      throw new AppError(502, 'We could not get that number right now. Please pick another or try again later.', 'NUMBER_PURCHASE_FAILED');
    }
  }
  if (trunkGroupId && (!owned || owned.trunk_group_id !== trunkGroupId)) {
    try {
      await assignNumberToTrunk(e164, trunkGroupId);
    } catch (err) {
      await rollback();
      await alertOps('Number bought but not linked to the Vobiz trunk — link it in Vobiz Console', {
        orgId: org._id.toString(), e164, trunkGroupId, error: (err as Error).message,
      });
      throw new AppError(502, 'We could not connect that number. Please try again in a few minutes.', 'NUMBER_LINK_FAILED');
    }
  }

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
    planState:         'paid',
  };
}
