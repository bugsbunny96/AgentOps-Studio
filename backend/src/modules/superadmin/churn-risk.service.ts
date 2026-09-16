/**
 * 19.6 Automated Churn Risk Scoring
 *
 * Runs daily via BullMQ. Scores every org 0–100 (higher = more at risk).
 *
 * Signals and weights:
 *   +35  No calls in last 7 days (inactive)
 *   +20  No calls ever (never activated)
 *   +15  Onboarding incomplete (not COMPLETED)
 *   +10  Team size = 1 (solo, more likely to abandon)
 *   +10  No KB documents
 *   +10  Free plan (low switching cost → high churn rate)
 *
 * Max: 100
 *
 * Tiers:
 *   < 30  → 'low'
 *   30–59 → 'medium'
 *   ≥ 60  → 'high'
 */

import mongoose from 'mongoose';
import { OrganizationModel, MembershipModel } from '../organization/organization.model';
import { CallModel }                           from '../calls/call.model';
import { ChurnRiskModel, IChurnRiskSignal }    from '../churn-risk/churn-risk.model';
import { computeTrialState }                   from '../billing/trial.service';

// lazy-import KB to avoid circular deps
async function getKBModel() {
  const { KbDocumentModel } = await import('../knowledge-base/kb.model');
  return KbDocumentModel;
}

export type ChurnRiskTier = 'low' | 'medium' | 'high';

function toTier(score: number): ChurnRiskTier {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/** Score a single org and upsert its daily snapshot in ChurnRiskModel. */
export async function scoreOrgChurnRisk(orgId: string): Promise<{
  orgId:   string;
  score:   number;
  tier:    ChurnRiskTier;
  signals: IChurnRiskSignal[];
}> {
  const oid = new mongoose.Types.ObjectId(orgId);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [org, memberCount, KBDocumentModel] = await Promise.all([
    OrganizationModel.findById(oid).select('name plan planOverride onboardingStatus trialUsed trialEndsAt').lean(),
    MembershipModel.countDocuments({ organizationId: oid }),
    getKBModel(),
  ]);

  if (!org) throw new Error(`Org ${orgId} not found`);

  const [kbCount, callsRecent, totalCalls] = await Promise.all([
    KBDocumentModel.countDocuments({ organizationId: oid }),
    CallModel.countDocuments({ organizationId: oid, createdAt: { $gte: sevenDaysAgo } }),
    CallModel.countDocuments({ organizationId: oid }),
  ]);

  const basePlan = ((org.planOverride ?? org.plan) as string) || 'free';

  // Resolve trial state — trial orgs are treated as 'growth' for churn scoring
  // (they have access to growth features and are not low-switching-cost)
  const trialState = computeTrialState(
    basePlan,
    (org as Record<string, unknown>).trialUsed as boolean ?? false,
    (org as Record<string, unknown>).trialEndsAt as Date | undefined,
  );
  const effectivePlan = trialState.isInTrial ? 'growth' : basePlan;

  const signals: IChurnRiskSignal[] = [];
  let score = 0;

  if (totalCalls === 0) {
    score += 20;
    signals.push({ key: 'never_called', label: 'No calls ever placed — agent never tested', severity: 'high' });
  } else if (callsRecent === 0) {
    score += 35;
    signals.push({ key: 'no_calls_7d', label: 'No calls in last 7 days', severity: 'high' });
  }

  if (org.onboardingStatus !== 'COMPLETED') {
    score += 15;
    signals.push({ key: 'onboarding_incomplete', label: 'Onboarding not yet completed', severity: 'medium' });
  }

  if (memberCount <= 1) {
    score += 10;
    signals.push({ key: 'solo_account', label: 'Single-member workspace', severity: 'low' });
  }

  if (kbCount === 0) {
    score += 10;
    signals.push({ key: 'no_kb_docs', label: 'Knowledge base is empty', severity: 'medium' });
  }

  // Free plan (non-trial) = low switching cost → higher churn risk
  if (basePlan === 'free' && !trialState.isInTrial && !trialState.isTrialExpired) {
    score += 10;
    signals.push({ key: 'free_plan', label: 'On free plan (low switching cost)', severity: 'low' });
  }

  // Trial expiring soon (≤ 2 days) → high conversion-to-churn risk
  if (trialState.isInTrial && trialState.trialDaysLeft <= 2) {
    score += 20;
    signals.push({
      key: 'trial_expiring',
      label: `Free trial expires in ${trialState.trialDaysLeft} day${trialState.trialDaysLeft === 1 ? '' : 's'} — conversion risk`,
      severity: 'high',
    });
  }

  // Trial expired without converting → very high churn risk
  if (trialState.isTrialExpired && basePlan === 'free') {
    score += 25;
    signals.push({ key: 'trial_expired_no_upgrade', label: 'Trial expired — did not upgrade', severity: 'high' });
  }

  // Cap at 100
  score = Math.min(score, 100);
  const tier = toTier(score);

  // Upsert today's snapshot (one per org per day)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  await ChurnRiskModel.findOneAndUpdate(
    { orgId: oid, scannedAt: { $gte: todayStart } },
    {
      $set: {
        orgId,
        orgName:   org.name,
        plan:      effectivePlan,
        score,
        signals,
        scannedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  return { orgId, score, tier, signals };
}

/** Score all orgs in batches. Called from the daily BullMQ worker. */
export async function scoreAllOrgsChurnRisk(): Promise<{ scored: number; errors: number }> {
  const orgs = await OrganizationModel.find({}).select('_id').lean();
  let scored = 0;
  let errors = 0;

  const BATCH = 10;
  for (let i = 0; i < orgs.length; i += BATCH) {
    const batch = orgs.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(o => scoreOrgChurnRisk(o._id.toString())),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') scored++;
      else errors++;
    }
  }

  return { scored, errors };
}

/** List latest churn risk snapshots, filtered by tier. */
export async function listChurnRisks(opts: {
  tier?:   ChurnRiskTier;
  limit?:  number;
  offset?: number;
}) {
  const { tier, limit = 50, offset = 0 } = opts;
  const filter: Record<string, unknown> = {};
  if (tier) {
    if (tier === 'high')   filter.score = { $gte: 60 };
    if (tier === 'medium') filter.score = { $gte: 30, $lt: 60 };
    if (tier === 'low')    filter.score = { $lt: 30 };
  }

  // Get the latest snapshot per org by sorting descending and limiting per org
  // Simple approach: pull all latest and de-dupe by orgId in-process
  const all = await ChurnRiskModel.find(filter)
    .sort({ score: -1, scannedAt: -1 })
    .limit(limit + offset + 50) // over-fetch then trim
    .lean();

  // De-duplicate: keep only the most recent snapshot per org
  const seen = new Set<string>();
  const deduped = [];
  for (const r of all) {
    const k = r.orgId.toString();
    if (!seen.has(k)) {
      seen.add(k);
      deduped.push(r);
    }
  }

  return deduped.slice(offset, offset + limit);
}
