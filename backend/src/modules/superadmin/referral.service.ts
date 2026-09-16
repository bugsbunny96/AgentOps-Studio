/**
 * 19.8 Referral Tracking
 *
 * Each org has a unique `referralCode` (auto-generated at org creation if missing).
 * When a new org signs up via a referral link (?ref=CODE), we store that code in
 * the new org's `referredByCode` field.
 *
 * This service provides:
 *   - generateReferralCode()  — idempotent, safe to call on existing orgs
 *   - getReferralTree(orgId)  — shows all orgs referred by this org (one level)
 *   - getTopReferrers(limit)  — leaderboard sorted by referral count
 *   - applyReferralCode()     — records referredByCode on a new org
 */

import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { OrganizationModel } from '../organization/organization.model';

/** Generate and persist a referral code for an org if it doesn't have one. */
export async function generateReferralCode(orgId: string): Promise<string> {
  const oid = new mongoose.Types.ObjectId(orgId);
  const org = await OrganizationModel.findById(oid).select('referralCode').lean();
  if (!org) throw new Error(`Org ${orgId} not found`);
  if (org.referralCode) return org.referralCode;

  // Generate a 10-char URL-safe code, retry on collision (rare)
  let code: string;
  let attempts = 0;
  do {
    code = nanoid(10).toUpperCase();
    const existing = await OrganizationModel.findOne({ referralCode: code }).lean();
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  await OrganizationModel.findByIdAndUpdate(oid, { $set: { referralCode: code } });
  return code!;
}

/** Record which referral code was used when this org signed up. */
export async function applyReferralCode(orgId: string, referralCode: string): Promise<boolean> {
  const referrer = await OrganizationModel.findOne({ referralCode }).select('_id').lean();
  if (!referrer) return false;

  await OrganizationModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(orgId),
    { $set: { referredByCode: referralCode } },
  );
  return true;
}

export interface ReferralNode {
  orgId:   string;
  orgName: string;
  plan:    string;
  joinedAt: Date;
}

/** Direct referrals made by an org (one level deep). */
export async function getReferralTree(orgId: string): Promise<{
  referralCode: string;
  referrals:    ReferralNode[];
}> {
  const org = await OrganizationModel.findById(new mongoose.Types.ObjectId(orgId))
    .select('referralCode')
    .lean();
  if (!org) throw new Error(`Org ${orgId} not found`);

  const code = org.referralCode;
  if (!code) return { referralCode: '', referrals: [] };

  const referred = await OrganizationModel.find({ referredByCode: code })
    .select('_id name plan createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return {
    referralCode: code,
    referrals: referred.map(r => ({
      orgId:    r._id.toString(),
      orgName:  r.name,
      plan:     r.plan,
      joinedAt: r.createdAt,
    })),
  };
}

export interface TopReferrer {
  orgId:         string;
  orgName:       string;
  referralCode:  string;
  referralCount: number;
}

/** Leaderboard: orgs ranked by how many other orgs they referred. */
export async function getTopReferrers(limit = 20): Promise<TopReferrer[]> {
  // Group referred orgs by referredByCode, count, then join with org to get name
  const agg = await OrganizationModel.aggregate<{
    _id: string;         // referredByCode
    count: number;
  }>([
    { $match: { referredByCode: { $exists: true, $ne: null } } },
    { $group: { _id: '$referredByCode', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  if (agg.length === 0) return [];

  const codes = agg.map(a => a._id);
  const referrers = await OrganizationModel.find({ referralCode: { $in: codes } })
    .select('_id name referralCode')
    .lean();
  const referrerMap = new Map(referrers.map(r => [r.referralCode!, r]));

  return agg
    .filter(a => referrerMap.has(a._id))
    .map(a => {
      const r = referrerMap.get(a._id)!;
      return {
        orgId:         r._id.toString(),
        orgName:       r.name,
        referralCode:  r.referralCode!,
        referralCount: a.count,
      };
    });
}
