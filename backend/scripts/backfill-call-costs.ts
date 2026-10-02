/**
 * Fill in the real Vapi cost for calls stored without one (costSource 'none' / cost 0).
 *
 * For each such call it GETs https://api.vapi.ai/call/:id and saves `cost` +
 * `costBreakdown`, so the super-admin margin page stops estimating them.
 * Dry run by default.
 *
 * Usage (from backend/):
 *   npx tsx scripts/backfill-call-costs.ts                 # dry run, last 90 days
 *   npx tsx scripts/backfill-call-costs.ts --days 30 --apply
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const daysArg = args[args.indexOf('--days') + 1];
const DAYS = args.includes('--days') && daysArg ? Number(daysArg) : 90;

const { MONGODB_URI, VAPI_API_KEY } = process.env;
if (!MONGODB_URI || !VAPI_API_KEY) {
  console.error('❌  MONGODB_URI and VAPI_API_KEY must be set in backend/.env');
  process.exit(1);
}

const BREAKDOWN_KEYS = ['transport', 'stt', 'llm', 'tts', 'vapi', 'total', 'llmPromptTokens', 'llmCompletionTokens', 'ttsCharacters'] as const;

async function getVapiCall(id: string): Promise<{ cost?: number; costBreakdown?: Record<string, unknown> } | null> {
  const resp = await fetch(`https://api.vapi.ai/call/${id}`, {
    headers: { Authorization: `Bearer ${VAPI_API_KEY}` },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Vapi ${resp.status} on GET /call/${id}`);
  return resp.json() as Promise<{ cost?: number; costBreakdown?: Record<string, unknown> }>;
}

async function run() {
  await mongoose.connect(MONGODB_URI!);
  const calls = mongoose.connection.db!.collection('calls');
  const since = new Date(Date.now() - DAYS * 86_400_000);

  const todo = await calls
    .find(
      {
        createdAt: { $gte: since },
        vapiCallId: { $exists: true, $ne: null },
        costSource: { $ne: 'vapi' },
        $or: [{ cost: 0 }, { cost: { $exists: false } }],
      },
      { projection: { vapiCallId: 1, duration: 1 } },
    )
    .toArray();

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${todo.length} call(s) without a reported cost in the last ${DAYS} days\n`);
  let filled = 0, missing = 0, failed = 0, totalUsd = 0, totalMin = 0;

  for (const c of todo) {
    try {
      const v = await getVapiCall(String(c.vapiCallId));
      if (!v || typeof v.cost !== 'number') { missing++; continue; }
      const breakdown: Record<string, number> = {};
      for (const k of BREAKDOWN_KEYS) {
        const val = v.costBreakdown?.[k];
        if (typeof val === 'number' && Number.isFinite(val)) breakdown[k] = val;
      }
      filled++;
      totalUsd += v.cost;
      totalMin += (Number(c.duration) || 0) / 60;
      console.log(`  ${c.vapiCallId}: $${v.cost.toFixed(4)}  (${((Number(c.duration) || 0) / 60).toFixed(1)} min)`);
      if (APPLY) {
        await calls.updateOne(
          { _id: c._id },
          { $set: { cost: v.cost, costSource: 'vapi', ...(Object.keys(breakdown).length ? { costBreakdown: breakdown } : {}) } },
        );
      }
      await new Promise((r) => setTimeout(r, 150)); // stay well under Vapi rate limits
    } catch (err) {
      failed++;
      console.warn(`  ⚠️  ${c.vapiCallId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nFound cost for ${filled}, no cost on Vapi for ${missing}, errors ${failed}.`);
  if (totalMin > 0) console.log(`Real all-in Vapi cost: $${totalUsd.toFixed(2)} over ${totalMin.toFixed(1)} min = $${(totalUsd / totalMin).toFixed(4)}/min`);
  if (!APPLY) console.log('Nothing changed. Re-run with --apply to save.');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('❌ ', err instanceof Error ? err.message : err);
  await mongoose.disconnect();
  process.exit(1);
});
