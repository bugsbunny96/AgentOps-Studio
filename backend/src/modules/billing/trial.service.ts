/**
 * Trial Service
 *
 * Scans all free-plan orgs daily and:
 *   1. Enqueues a Day-5 reminder email when trialEndsAt is ≤ 2 days away
 *      and hasn't been sent yet (trialEmailSentDay5 = false).
 *   2. Enqueues a Day-7 expiry email when trialEndsAt is ≤ today (trial ends today or already ended)
 *      and hasn't been sent yet (trialEmailSentDay7 = false).
 *
 * Each email type is sent at most once per org (idempotency via boolean flags).
 *
 * Called by the `trial-email-scan` BullMQ scheduler at 06:00 UTC daily.
 */

import { OrganizationModel, MembershipModel } from '../organization/organization.model';
import { UserModel } from '../auth/auth.model';
import { trialEmailQueue } from '../../jobs/trialEmail.queue';
import { logger } from '../../utils/logger';

/** 2 days in ms — threshold for sending the Day-5 (2-days-left) reminder */
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export interface TrialScanResult {
  day5Sent:  number;
  day7Sent:  number;
  skipped:   number;
  errors:    number;
}

/**
 * Scan all free-plan orgs that have an active trial and enqueue reminder emails.
 * Returns a summary of what was dispatched.
 */
export async function scanAndEnqueueTrialEmails(): Promise<TrialScanResult> {
  const now = new Date();
  const result: TrialScanResult = { day5Sent: 0, day7Sent: 0, skipped: 0, errors: 0 };

  // Only orgs that:
  //   - are on the free plan (paid orgs don't need trial emails)
  //   - had a trial started (trialUsed = true)
  //   - have a trialEndsAt date
  //   - still have at least one email to send
  const orgs = await OrganizationModel.find({
    plan:       'free',
    trialUsed:  true,
    trialEndsAt: { $exists: true },
    $or: [
      { trialEmailSentDay5: false },
      { trialEmailSentDay7: false },
    ],
  }).lean();

  logger.info('Trial email scan: found orgs to check', { count: orgs.length });

  for (const org of orgs) {
    try {
      if (!org.trialEndsAt) { result.skipped++; continue; }

      const msUntilExpiry = org.trialEndsAt.getTime() - now.getTime();

      // ── Day-7 email: trial expires today or already expired ─────────
      if (!org.trialEmailSentDay7 && msUntilExpiry <= 24 * 60 * 60 * 1000) {
        const owner = await resolveOrgOwner(org._id.toString());
        if (!owner) { result.skipped++; continue; }

        await trialEmailQueue.add(
          'send-trial-day7',
          {
            orgId:      org._id.toString(),
            orgName:    org.name,
            ownerName:  owner.name,
            ownerEmail: owner.email,
          },
          { jobId: `trial-day7-${org._id.toString()}` }, // deduplicate by jobId
        );

        await OrganizationModel.updateOne(
          { _id: org._id },
          { $set: { trialEmailSentDay7: true } },
        );

        result.day7Sent++;
        logger.info('Trial Day-7 email enqueued', { orgId: org._id.toString() });
        continue; // skip Day-5 check for this org — Day-7 takes priority
      }

      // ── Day-5 email: 2 days or fewer remain ─────────────────────────
      if (!org.trialEmailSentDay5 && msUntilExpiry <= TWO_DAYS_MS && msUntilExpiry > 0) {
        const owner = await resolveOrgOwner(org._id.toString());
        if (!owner) { result.skipped++; continue; }

        await trialEmailQueue.add(
          'send-trial-day5',
          {
            orgId:      org._id.toString(),
            orgName:    org.name,
            ownerName:  owner.name,
            ownerEmail: owner.email,
          },
          { jobId: `trial-day5-${org._id.toString()}` }, // deduplicate by jobId
        );

        await OrganizationModel.updateOne(
          { _id: org._id },
          { $set: { trialEmailSentDay5: true } },
        );

        result.day5Sent++;
        logger.info('Trial Day-5 email enqueued', { orgId: org._id.toString() });
        continue;
      }

      result.skipped++;
    } catch (err) {
      result.errors++;
      logger.error('Trial scan: error processing org', {
        orgId: org._id?.toString(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Trial email scan complete', result);
  return result;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function resolveOrgOwner(orgId: string): Promise<{ name: string; email: string } | null> {
  const membership = await MembershipModel.findOne({ organizationId: orgId, role: 'Owner' }).lean();
  if (!membership) return null;
  const user = await UserModel.findById(membership.userId).lean();
  if (!user) return null;
  return { name: user.name, email: user.email };
}

// ─── Trial state helpers (used by billing.service + middleware) ──────────────

export interface TrialState {
  /** True when org is on free plan and within the trial window */
  isInTrial: boolean;
  /** True when the trial was granted but has now expired */
  isTrialExpired: boolean;
  /** Calendar days remaining (0 on expiry day, negative after) */
  trialDaysLeft: number;
  trialEndsAt: Date | null;
}

export function computeTrialState(
  plan: string,
  trialUsed: boolean,
  trialEndsAt?: Date,
): TrialState {
  // Non-free plans are unaffected by trial state
  if (plan !== 'free') {
    return { isInTrial: false, isTrialExpired: false, trialDaysLeft: 0, trialEndsAt: null };
  }

  if (!trialUsed || !trialEndsAt) {
    return { isInTrial: false, isTrialExpired: false, trialDaysLeft: 0, trialEndsAt: null };
  }

  const now = Date.now();
  const expiryMs = trialEndsAt.getTime();
  const msLeft = expiryMs - now;
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  const isInTrial    = msLeft > 0;
  const isTrialExpired = msLeft <= 0;

  return {
    isInTrial,
    isTrialExpired,
    trialDaysLeft: Math.max(0, daysLeft),
    trialEndsAt,
  };
}
