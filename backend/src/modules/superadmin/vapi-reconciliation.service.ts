/**
 * 19.10 Vapi Bill Reconciliation — real cost vs plan revenue per org.
 *
 * Cost per call (USD):
 *   • Vapi cost — the `cost` Vapi reports in end-of-call-report (platform fee +
 *     STT + LLM + TTS). Calls with no reported cost (costSource 'none', e.g. calls
 *     stored before 2026-10-02) are estimated at VAPI_FALLBACK_COST_PER_MIN_USD
 *     until scripts/backfill-call-costs.ts fills them from GET /call/:id.
 *   • Telephony — Vobiz SIP is billed outside Vapi, so it is added separately at
 *     TELEPHONY_COST_PER_MIN_USD (set it from the Vobiz invoice).
 *
 * The old constant assumed $0.012/min all-in. Vapi's platform fee alone is
 * $0.05/min, so that understated cost ~8–10× and hid at-risk orgs.
 *
 * Plan revenue (monthly, USD — converted from the INR list prices in
 * billing/plan-catalog.ts at USD_INR_RATE, default ₹96.77/$1 (7 Oct 2026); for this
 * internal tool only): free $0 · lite (Starter ₹4,999) ≈ $52 · starter (Basic
 * ₹9,999) ≈ $103 · growth (Standard ₹17,999) ≈ $186 · enterprise (Pro ₹29,999)
 * ≈ $310. Revenue is prorated to the selected period
 * (periodDays / 30) so a 7-day view is not compared against a full month.
 *
 * Orgs with marginPct < MARGIN_ALERT_PCT are flagged as 'at-risk'.
 */

import mongoose from 'mongoose';
import { CallModel } from '../calls/call.model';
import { OrganizationModel } from '../organization/organization.model';
import { env } from '../../config/env';
import { PLAN_CATALOG } from '../billing/plan-catalog';

/** Monthly plan revenue in USD (per plan tier) — approximate, see header comment. */
const PLAN_MONTHLY_REVENUE_USD: Record<string, number> = {
  free:       0,
  lite:       Math.round(PLAN_CATALOG.lite.monthlyInr       / env.USD_INR_RATE),
  starter:    Math.round(PLAN_CATALOG.starter.monthlyInr    / env.USD_INR_RATE),
  growth:     Math.round(PLAN_CATALOG.growth.monthlyInr     / env.USD_INR_RATE),
  enterprise: Math.round(PLAN_CATALOG.enterprise.monthlyInr / env.USD_INR_RATE),
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
  vapiCostUsd:      number;   // reported Vapi cost + estimate for calls without one
  telephonyCostUsd: number;   // Vobiz minutes × TELEPHONY_COST_PER_MIN_USD
  totalCostUsd:     number;   // vapiCostUsd + telephonyCostUsd
  costPerMinUsd:    number;   // totalCostUsd / minutes (0 when no minutes)
  reportedCalls:    number;   // calls whose cost came from Vapi
  estimatedCalls:   number;   // calls costed with the fallback rate
  /** Sums of Vapi's per-component cost for reported calls */
  breakdownUsd:     { stt: number; llm: number; tts: number; vapi: number; transport: number };
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
    totalTelephonyCostUsd: number;
    totalCostUsd:     number;
    totalPlanRevenueUsd: number;
    totalMarginUsd: number;
    totalMinutes:     number;
    avgCostPerMinUsd: number;
    reportedCalls:    number;
    estimatedCalls:   number;
  };
  /** Rates used for estimates, so the page can show its assumptions */
  assumptions: {
    vapiFallbackPerMinUsd: number;
    telephonyPerMinUsd:    number;
  };
  orgs: OrgReconciliation[];
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

export async function buildReconciliationReport(
  periodDays = 30,
  limit = 100,
): Promise<ReconciliationReport> {
  const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000);
  const fallbackPerMin  = env.VAPI_FALLBACK_COST_PER_MIN_USD;
  const telephonyPerMin = env.TELEPHONY_COST_PER_MIN_USD;
  const assumptions = { vapiFallbackPerMinUsd: fallbackPerMin, telephonyPerMinUsd: telephonyPerMin };

  // Per-org totals, costing each call individually: reported cost when Vapi sent
  // one, otherwise minutes × fallback rate. (The old version summed per org and
  // used the fallback only when the whole org's total was 0.)
  const hasReported = { $or: [{ $eq: ['$costSource', 'vapi'] }, { $gt: ['$cost', 0] }] };
  const callStats = await CallModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    reportedCost:   number;
    estimatedSecs:  number;
    totalSecs:      number;
    callCount:      number;
    reportedCalls:  number;
    stt: number; llm: number; tts: number; vapi: number; transport: number;
  }>([
    { $match: { createdAt: { $gte: since }, status: { $ne: 'active' } } },
    {
      $group: {
        _id:           '$organizationId',
        reportedCost:  { $sum: { $cond: [hasReported, '$cost', 0] } },
        estimatedSecs: { $sum: { $cond: [hasReported, 0, '$duration'] } },
        totalSecs:     { $sum: '$duration' },
        callCount:     { $sum: 1 },
        reportedCalls: { $sum: { $cond: [hasReported, 1, 0] } },
        stt:       { $sum: { $ifNull: ['$costBreakdown.stt', 0] } },
        llm:       { $sum: { $ifNull: ['$costBreakdown.llm', 0] } },
        tts:       { $sum: { $ifNull: ['$costBreakdown.tts', 0] } },
        vapi:      { $sum: { $ifNull: ['$costBreakdown.vapi', 0] } },
        transport: { $sum: { $ifNull: ['$costBreakdown.transport', 0] } },
      },
    },
    { $limit: limit },
  ]);

  if (callStats.length === 0) {
    return {
      periodDays,
      generatedAt: new Date(),
      summary: {
        totalOrgs: 0, atRiskOrgs: 0, totalVapiCostUsd: 0, totalTelephonyCostUsd: 0, totalCostUsd: 0,
        totalPlanRevenueUsd: 0, totalMarginUsd: 0, totalMinutes: 0, avgCostPerMinUsd: 0,
        reportedCalls: 0, estimatedCalls: 0,
      },
      assumptions,
      orgs: [],
    };
  }

  const orgIds = callStats.map((s) => s._id);
  const orgs = await OrganizationModel.find({ _id: { $in: orgIds } })
    .select('_id name plan planOverride')
    .lean();
  const orgMap = new Map(orgs.map((o) => [o._id.toString(), o]));

  const results: OrgReconciliation[] = [];
  const t = { vapi: 0, tel: 0, revenue: 0, minutes: 0, reported: 0, estimated: 0, atRisk: 0 };

  for (const stat of callStats) {
    const orgDoc = orgMap.get(stat._id.toString());
    if (!orgDoc) continue;

    const effectivePlan  = ((orgDoc.planOverride ?? orgDoc.plan) as string) || 'free';
    const planRevenueUsd = (PLAN_MONTHLY_REVENUE_USD[effectivePlan] ?? 0) * (periodDays / 30);

    const totalCallMinutes = stat.totalSecs / 60;
    const vapiCostUsd      = stat.reportedCost + (stat.estimatedSecs / 60) * fallbackPerMin;
    const telephonyCostUsd = totalCallMinutes * telephonyPerMin;
    const totalCostUsd     = vapiCostUsd + telephonyCostUsd;

    const marginUsd = planRevenueUsd - totalCostUsd;
    const marginPct = planRevenueUsd > 0 ? (marginUsd / planRevenueUsd) * 100 : null;
    const atRisk    = marginPct !== null && marginPct < MARGIN_ALERT_PCT;
    const estimatedCalls = stat.callCount - stat.reportedCalls;

    t.vapi += vapiCostUsd; t.tel += telephonyCostUsd; t.revenue += planRevenueUsd;
    t.minutes += totalCallMinutes; t.reported += stat.reportedCalls; t.estimated += estimatedCalls;
    if (atRisk) t.atRisk++;

    results.push({
      orgId:            stat._id.toString(),
      orgName:          orgDoc.name,
      plan:             effectivePlan,
      planRevenueUsd:   round(planRevenueUsd, 2),
      totalCallSecs:    stat.totalSecs,
      totalCallMinutes: round(totalCallMinutes, 2),
      vapiCostUsd:      round(vapiCostUsd, 4),
      telephonyCostUsd: round(telephonyCostUsd, 4),
      totalCostUsd:     round(totalCostUsd, 4),
      costPerMinUsd:    totalCallMinutes > 0 ? round(totalCostUsd / totalCallMinutes, 4) : 0,
      reportedCalls:    stat.reportedCalls,
      estimatedCalls,
      breakdownUsd: {
        stt:       round(stat.stt, 4),
        llm:       round(stat.llm, 4),
        tts:       round(stat.tts, 4),
        vapi:      round(stat.vapi, 4),
        transport: round(stat.transport, 4),
      },
      marginUsd:        round(marginUsd, 2),
      marginPct:        marginPct !== null ? round(marginPct, 1) : null,
      atRisk,
      callCount:        stat.callCount,
    });
  }

  // At-risk first, then highest cost
  results.sort((a, b) => (a.atRisk !== b.atRisk ? (a.atRisk ? -1 : 1) : b.totalCostUsd - a.totalCostUsd));

  const totalCost = t.vapi + t.tel;
  return {
    periodDays,
    generatedAt: new Date(),
    summary: {
      totalOrgs:             results.length,
      atRiskOrgs:            t.atRisk,
      totalVapiCostUsd:      round(t.vapi, 2),
      totalTelephonyCostUsd: round(t.tel, 2),
      totalCostUsd:          round(totalCost, 2),
      totalPlanRevenueUsd:   round(t.revenue, 2),
      totalMarginUsd:        round(t.revenue - totalCost, 2),
      totalMinutes:          round(t.minutes, 1),
      avgCostPerMinUsd:      t.minutes > 0 ? round(totalCost / t.minutes, 4) : 0,
      reportedCalls:         t.reported,
      estimatedCalls:        t.estimated,
    },
    assumptions,
    orgs: results,
  };
}
