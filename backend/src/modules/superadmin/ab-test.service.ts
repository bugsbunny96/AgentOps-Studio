/**
 * 19.9 A/B Test Manager
 *
 * SA creates tests with N variants (percentages must sum to 100).
 * Orgs are assigned to variants deterministically (by orgId hash) or manually.
 * Conversion events are recorded per variant.
 */

import mongoose from 'mongoose';
import { ABTestModel, type IABTest, type IABVariant } from '../ab-test/ab-test.model';
import { OrganizationModel } from '../organization/organization.model';

// ─── CRUD ────────────────────────────────────────────────────────────────────

export interface CreateABTestInput {
  name:           string;
  description?:   string;
  hypothesis?:    string;
  variants:       Omit<IABVariant, never>[];
  conversionGoal?:string;
  orgIds?:        string[];  // empty = all orgs
}

export async function createABTest(input: CreateABTestInput, saEmail: string): Promise<IABTest> {
  validateVariants(input.variants);
  return ABTestModel.create({
    name:           input.name,
    description:    input.description ?? '',
    hypothesis:     input.hypothesis ?? '',
    variants:       input.variants,
    conversionGoal: input.conversionGoal ?? '',
    orgIds:         input.orgIds ?? [],
    assignments:    {},
    conversions:    {},
    status:         'draft',
    createdBy:      saEmail,
  });
}

export async function listABTests(opts: {
  status?: string;
  limit?:  number;
  offset?: number;
}) {
  const { status, limit = 50, offset = 0 } = opts;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  return ABTestModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
}

export async function getABTest(id: string): Promise<IABTest | null> {
  return ABTestModel.findById(new mongoose.Types.ObjectId(id));
}

export async function updateABTest(id: string, patch: Partial<CreateABTestInput>): Promise<IABTest | null> {
  if (patch.variants) validateVariants(patch.variants);
  return ABTestModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(id),
    { $set: patch },
    { new: true },
  );
}

export async function deleteABTest(id: string): Promise<void> {
  await ABTestModel.findByIdAndDelete(new mongoose.Types.ObjectId(id));
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export async function startABTest(id: string): Promise<IABTest | null> {
  const test = await ABTestModel.findById(new mongoose.Types.ObjectId(id));
  if (!test) return null;
  if (test.status !== 'draft' && test.status !== 'paused') {
    throw new Error(`Cannot start test in status "${test.status}"`);
  }

  // Auto-assign orgs if none already assigned
  if (Object.keys(test.assignments).length === 0) {
    await assignOrgsToTest(test);
  }

  test.status    = 'running';
  test.startedAt = new Date();
  return test.save();
}

export async function pauseABTest(id: string): Promise<IABTest | null> {
  return ABTestModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(id),
    { $set: { status: 'paused' } },
    { new: true },
  );
}

export async function endABTest(id: string): Promise<IABTest | null> {
  return ABTestModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(id),
    { $set: { status: 'completed', endedAt: new Date() } },
    { new: true },
  );
}

// ─── Assignment ──────────────────────────────────────────────────────────────

/**
 * Deterministic assignment: hash the orgId (mod 100) to pick a variant
 * based on cumulative percentage buckets. Produces stable results —
 * the same org always ends up in the same variant.
 */
function assignVariantForOrg(orgId: string, variants: IABVariant[]): string {
  // Simple hash: sum char codes mod 100
  let hash = 0;
  for (const c of orgId) hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const bucket = hash % 100;

  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.percentage;
    if (bucket < cumulative) return v.id;
  }
  return variants[variants.length - 1].id;
}

async function assignOrgsToTest(test: IABTest): Promise<void> {
  const scope = test.orgIds.length > 0
    ? { _id: { $in: test.orgIds.map(id => new mongoose.Types.ObjectId(id)) } }
    : {};

  const orgs = await OrganizationModel.find(scope).select('_id').lean();
  const assignments: Record<string, string> = {};
  for (const org of orgs) {
    assignments[org._id.toString()] = assignVariantForOrg(org._id.toString(), test.variants);
  }
  test.assignments = assignments;
  await test.save();
}

/** Manually override assignment for a specific org */
export async function setOrgAssignment(testId: string, orgId: string, variantId: string): Promise<void> {
  await ABTestModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(testId),
    { $set: { [`assignments.${orgId}`]: variantId } },
  );
}

/** Get which variant an org is assigned to for a running test */
export async function getOrgVariant(testId: string, orgId: string): Promise<string | null> {
  const test = await ABTestModel.findById(new mongoose.Types.ObjectId(testId))
    .select('assignments variants status orgIds')
    .lean();
  if (!test || test.status !== 'running') return null;

  if (test.assignments[orgId]) return test.assignments[orgId] as string;

  // Auto-assign if in scope
  const inScope = test.orgIds.length === 0 || test.orgIds.includes(orgId);
  if (!inScope) return null;

  const variantId = assignVariantForOrg(orgId, test.variants);
  await ABTestModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(testId),
    { $set: { [`assignments.${orgId}`]: variantId } },
  );
  return variantId;
}

// ─── Conversions ─────────────────────────────────────────────────────────────

export async function recordConversion(testId: string, orgId: string): Promise<void> {
  const test = await ABTestModel.findById(new mongoose.Types.ObjectId(testId)).lean();
  if (!test || test.status !== 'running') return;

  const variantId = (test.assignments as Record<string, string>)[orgId];
  if (!variantId) return;

  await ABTestModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(testId),
    { $inc: { [`conversions.${variantId}`]: 1 } },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateVariants(variants: IABVariant[]): void {
  if (!variants || variants.length < 2) {
    throw new Error('An A/B test requires at least 2 variants');
  }
  const total = variants.reduce((sum, v) => sum + v.percentage, 0);
  if (Math.round(total) !== 100) {
    throw new Error(`Variant percentages must sum to 100 (got ${total})`);
  }
  const ids = variants.map(v => v.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Variant IDs must be unique');
  }
}
