/**
 * 19.10 Vapi Bill Reconciliation
 *
 * For each org, compare:
 *   • Actual Vapi cost pulled from call records (`cost` field, USD)
 *   • Expected monthly plan revenue (what we charge the org)
 *
 * This surfaces orgs whose Vapi costs are eating into margins or exceeding revenue.
 *
 * Plan pricing (monthly, USD — approximate, converted from the real INR
 * subscription prices at ~₹83/$1 for this internal margin-alert tool only;
 * source of truth is the INR pricing doc, not this USD estimate):
 *   free       → $0    / mo  (trial — costs are pure loss)
 *   starter    → $120  / mo  (Basic, ₹9,999/mo)
 *   growth     → $217  / mo  (Standard, ₹17,999/mo)
 *   enterprise → $313  / mo  (Pro, ₹25,999/mo)
 *
 * Vapi minute rates (approximate, USD per minute — update when Vapi reprices):
 *   STT: ~$0.002 / min  (Deepgram)
 *   LLM: ~$0.004 / min  (GPT-4o ~8k output tpm avg)
 *   TTS: ~$0.002 / min  (ElevenLabs)
 *   Telephony: ~$0.004 / min (Vobiz SIP inbound)
 *   ──────────────────────────────────────────────────────
 *   Total: ~$0.012 / min  (stored as VAPI_COST_PER_MIN_USD)
 *
 * We compare recorded `cost` vs plan revenue to compute:
 *   marginUsd = planRevenue - vapiCost
 *   marginPct = marginUsd / planRevenue × 100  (Infinity if free plan)
 *
 * Orgs with marginPct < MARGIN_ALERT_PCT are flagged as 'at-risk'.
 */

import mongoose from 'mongoose';
import { CallModel } from '../calls/call.model';
import { OrganizationModel } from '../organization/organization.model';

/** Approximate Vapi all-in cost per call-minute in USD. Update quarterly. */
const VAPI_COST_PER_MIN_USD = 0.012;

/** Monthly plan revenue in USD (per plan tier) — approximate, see header comment. */
const PLAN_MONTHLY_REVENUE_USD: Record<string, number> = {
  free:       0,
  starter:    120,
  growth:     217,
  enterprise: 313,
};

/** Warn when estimated margin drops below this % */
const MARGIN_ALERT_PCT = 40;

export interface OrgReconciliation {
  orgId:            string;
  orgName:          string;
  plan:             string;
  planRevenueUsd:   number;   // monthly plan fee charged
  totalCallSecs:    number;
  totalCallMinutes: number;
  vapiCostUsd:      number;   // recorded cost from call records OR estimated from minutes
  marginUsd:        number;
  marginPct:        number | null;  // null for free plan (no revenue)
  atRisk:           boolean;
  callCount:        number;
}

export interface ReconciliationReport {
  periodDays:       number;
  generatedAt:      Date;
  summary: {
    totalOrgs:      number;
    atRiskOrgs:     number;
    totalVapiCostUsd: number;
    totalPlanRevenueUsd: number;
    totalMarginUsd: number;
  };
  orgs: OrgReconciliation[];
}

export async function buildReconciliationReport(
  periodDays = 30,
  limit = 100,
): Promise<ReconciliationReport> {
  const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000);

  // Aggregate call stats per org in the period
  const callStats = await CallModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalCost:    number;
    totalSecs:    number;
    callCount:    number;
  }>([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id:       '$organizationId',
        totalCost: { $sum: '$cost' },
        totalSecs: { $sum: '$duration' },
        callCount: { $sum: 1 },
      },
    },
    { $sort: { totalCost: -1 } },
    { $limit: limit },
  ]);

  if (callStats.length === 0) {
    return {
      periodDays,
      generatedAt: new Date(),
      summary: { totalOrgs: 0, atRiskOrgs: 0, totalVapiCostUsd: 0, totalPlanRevenueUsd: 0, totalMarginUsd: 0 },
      orgs: [],
    };
  }

  // Fetch org details for all orgs in the result set
  const orgIds = callStats.map(s => s._id);
  const orgs = await OrganizationModel.find({ _id: { $in: orgIds } })
    .select('_id name plan planOverride')
    .lean();
  const orgMap = new Map(orgs.map(o => [o._id.toString(), o]));

  const results: OrgReconciliation[] = [];
  let totalVapiCostUsd     = 0;
  let totalPlanRevenueUsd  = 0;
  let atRiskCount          = 0;

  for (const stat of callStats) {
    const orgDoc = orgMap.get(stat._id.toString());
    if (!orgDoc) continue;

    const effectivePlan = ((orgDoc.planOverride ?? orgDoc.plan) as string) || 'free';
    const planRevenueUsd = PLAN_MONTHLY_REVENUE_USD[effectivePlan] ?? 0;

    const totalCallMinutes = stat.totalSecs / 60;

    // Prefer recorded cost; fall back to estimate from minutes if cost is 0
    const vapiCostUsd =
      stat.totalCost > 0
        ? stat.totalCost
        : totalCallMinutes * VAPI_COST_PER_MIN_USD;

    const marginUsd = planRevenueUsd - vapiCostUsd;
    const marginPct =
      planRevenueUsd > 0 ? (marginUsd / planRevenueUsd) * 100 : null;

    const atRisk = marginPct !== null && marginPct < MARGIN_ALERT_PCT;

    totalVapiCostUsd    += vapiCostUsd;
    totalPlanRevenueUsd += planRevenueUsd;
    if (atRisk) atRiskCount++;

    results.push({
      orgId:            stat._id.toString(),
      orgName:          orgDoc.name,
      plan:             effectivePlan,
      planRevenueUsd,
      totalCallSecs:    stat.totalSecs,
      totalCallMinutes: Math.round(totalCallMinutes * 100) / 100,
      vapiCostUsd:      Math.round(vapiCostUsd * 10000) / 10000,
      marginUsd:        Math.round(marginUsd * 100) / 100,
      marginPct:        marginPct !== null ? Math.round(marginPct * 10) / 10 : null,
      atRisk,
      callCount:        stat.callCount,
    });
  }

  // Sort: at-risk first, then by vapiCostUsd desc
  results.sort((a, b) => {
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    return b.vapiCostUsd - a.vapiCostUsd;
  });

  return {
    periodDays,
    generatedAt: new Date(),
    summary: {
      totalOrgs:           results.length,
      atRiskOrgs:          atRiskCount,
      totalVapiCostUsd:    Math.round(totalVapiCostUsd * 100) / 100,
      totalPlanRevenueUsd: Math.round(totalPlanRevenueUsd * 100) / 100,
      totalMarginUsd:      Math.round((totalPlanRevenueUsd - totalVapiCostUsd) * 100) / 100,
    },
    orgs: results,
  };
}
