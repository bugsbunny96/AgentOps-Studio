/**
 * 19.2 Org Health Score
 *
 * Calculated on-the-fly from existing collections — no separate model needed.
 *
 * Scoring rubric:
 *   +30  Has a live Vapi assistant
 *   +20  KB documents > 0
 *   +20  Calls in last 7 days
 *   +10  Team members > 1 (at least one non-owner)
 *   +20  Plan is paid (starter / growth / enterprise)
 *   ──────────────────────────────────────────────
 *   100  Max
 *
 * Score < 40  → "critical" (high churn risk)
 * Score 40–69 → "warning"
 * Score 70+   → "healthy"
 */
import mongoose from 'mongoose';
import { OrganizationModel } from '../organization/organization.model';
import { MembershipModel }   from '../organization/organization.model';
import { CallModel }         from '../calls/call.model';

// lazy-import KB to avoid circular deps
async function getKBModel() {
  const { KbDocumentModel } = await import('../knowledge-base/kb.model');
  return KbDocumentModel;
}

export interface OrgHealthScore {
  orgId:       string;
  orgName:     string;
  plan:        string;
  score:       number;
  tier:        'healthy' | 'warning' | 'critical';
  breakdown: {
    agentLive:    boolean;  // +30
    hasKBDocs:    boolean;  // +20
    callsThisWeek:boolean;  // +20
    multiMember:  boolean;  // +10
    paidPlan:     boolean;  // +20
  };
}

function toTier(score: number): 'healthy' | 'warning' | 'critical' {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'warning';
  return 'critical';
}

export async function computeOrgHealthScore(orgId: string): Promise<OrgHealthScore> {
  const oid = new mongoose.Types.ObjectId(orgId);

  const [org, memberCount, KBDocumentModel] = await Promise.all([
    OrganizationModel.findById(oid).select('name plan vapiAssistantId planOverride').lean(),
    MembershipModel.countDocuments({ organizationId: oid }),
    getKBModel(),
  ]);

  if (!org) throw new Error(`Org ${orgId} not found`);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [kbCount, callCount] = await Promise.all([
    KBDocumentModel.countDocuments({ organizationId: oid }),
    CallModel.countDocuments({ organizationId: oid, createdAt: { $gte: sevenDaysAgo } }),
  ]);

  const effectivePlan = (org.planOverride ?? org.plan) as string;

  const breakdown = {
    agentLive:     Boolean(org.vapiAssistantId),
    hasKBDocs:     kbCount > 0,
    callsThisWeek: callCount > 0,
    multiMember:   memberCount > 1,
    paidPlan:      ['starter', 'growth', 'enterprise'].includes(effectivePlan),
  };

  const score =
    (breakdown.agentLive     ? 30 : 0) +
    (breakdown.hasKBDocs     ? 20 : 0) +
    (breakdown.callsThisWeek ? 20 : 0) +
    (breakdown.multiMember   ? 10 : 0) +
    (breakdown.paidPlan      ? 20 : 0);

  return {
    orgId:     orgId,
    orgName:   org.name,
    plan:      effectivePlan,
    score,
    tier:      toTier(score),
    breakdown,
  };
}

export async function computeAllOrgHealthScores(limit = 100): Promise<OrgHealthScore[]> {
  const orgs = await OrganizationModel.find({})
    .select('_id name plan vapiAssistantId planOverride')
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();

  // Run in parallel batches of 10
  const results: OrgHealthScore[] = [];
  const BATCH = 10;
  for (let i = 0; i < orgs.length; i += BATCH) {
    const batch = orgs.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(o => computeOrgHealthScore(o._id.toString()))
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }

  return results.sort((a, b) => a.score - b.score); // lowest score first (most at-risk)
}
