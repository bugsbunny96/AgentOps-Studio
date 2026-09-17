/**
 * 19.3 Self-Serve Enterprise Onboarding Portal
 *
 * SA generates a magic link that lets a prospect start the onboarding flow
 * with a pre-set plan, custom trial period, and pre-filled contact details.
 *
 * Token is a cryptographically random URL-safe string stored in EnterpriseLinkModel.
 * The public endpoint GET /api/v1/enterprise-link/:token validates status + expiry
 * and returns the pre-fill data so the onboarding UI can hydrate the form.
 */

import crypto from 'crypto';
import { EnterpriseLinkModel, type IEnterpriseLink } from '../enterprise-link/enterprise-link.model';

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export interface CreateEnterpriseLinkInput {
  plan:              'free' | 'starter' | 'growth' | 'enterprise';
  trialDays?:        number;
  prefilledName?:    string;
  prefilledEmail?:   string;
  prefilledCompany?: string;
  prefilledIndustry?:string;
  note?:             string;
  /** How many hours until the link expires. Default: 72h */
  expiryHours?:      number;
}

export async function createEnterpriseLink(
  input:   CreateEnterpriseLinkInput,
  saEmail: string,
): Promise<IEnterpriseLink> {
  const expiryHours = input.expiryHours ?? 72;
  const expiresAt   = new Date(Date.now() + expiryHours * 3600 * 1000);
  const token       = generateToken();

  const link = await EnterpriseLinkModel.create({
    token,
    plan:              input.plan,
    trialDays:         input.trialDays ?? 14,
    prefilledName:     input.prefilledName,
    prefilledEmail:    input.prefilledEmail,
    prefilledCompany:  input.prefilledCompany,
    prefilledIndustry: input.prefilledIndustry,
    note:              input.note ?? '',
    status:            'active',
    expiresAt,
    createdBy:         saEmail,
  });

  return link;
}

export async function listEnterpriseLinks(opts: {
  status?: string;
  limit?:  number;
  offset?: number;
}) {
  const { status, limit = 50, offset = 0 } = opts;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  return EnterpriseLinkModel.find(filter)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
}

export async function getEnterpriseLinkByToken(token: string): Promise<IEnterpriseLink | null> {
  const link = await EnterpriseLinkModel.findOne({ token });
  if (!link) return null;

  // Auto-expire if past expiresAt but MongoDB TTL hasn't fired yet
  if (link.status === 'active' && link.expiresAt < new Date()) {
    link.status = 'expired';
    await link.save();
    return null;
  }

  if (link.status !== 'active') return null;
  return link;
}

export async function markEnterpriseLinkUsed(token: string, orgId: string): Promise<void> {
  await EnterpriseLinkModel.findOneAndUpdate(
    { token, status: 'active' },
    { $set: { status: 'used', usedAt: new Date(), usedByOrgId: orgId } },
  );
}

export async function revokeEnterpriseLink(id: string): Promise<void> {
  await EnterpriseLinkModel.findByIdAndUpdate(id, { $set: { status: 'revoked' } });
}
