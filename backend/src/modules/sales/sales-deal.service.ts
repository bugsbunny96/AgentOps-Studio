/** Sales deal log service (MKT-11) — super-admin only. */
import mongoose from 'mongoose';
import { BadRequest, NotFound } from '../../middleware/errorHandler';
import { SalesDealModel, type DealStage, type ISalesDeal } from './sales-deal.model';
import type { CreateDealInput, UpdateDealInput } from './sales-deal.validation';
import { summarizeDeals, type DealSummary } from './sales-deal.summary';

const isClosed = (s?: DealStage) => s === 'won' || s === 'lost';

export async function listDeals(opts: { stage?: DealStage; limit?: number } = {}): Promise<ISalesDeal[]> {
  const filter = opts.stage ? { stage: opts.stage } : {};
  const limit  = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  return SalesDealModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean<ISalesDeal[]>();
}

export async function getDealSummary(): Promise<DealSummary> {
  const deals = await SalesDealModel.find({}, { stage: 1, source: 1, lostReason: 1, priceAnswers: 1 }).lean();
  return summarizeDeals(deals);
}

export async function createDeal(input: CreateDealInput, createdBy: string): Promise<ISalesDeal> {
  const stage = input.stage ?? 'open';
  const doc = await SalesDealModel.create({
    ...input,
    stage,
    lostReason: stage === 'lost' ? input.lostReason : undefined,
    closedAt:   isClosed(stage) ? new Date() : null,
    createdBy,
  });
  return doc.toObject();
}

export async function updateDeal(id: string, input: UpdateDealInput): Promise<ISalesDeal> {
  if (!mongoose.isValidObjectId(id)) throw NotFound('Deal');
  const existing = await SalesDealModel.findById(id);
  if (!existing) throw NotFound('Deal');

  const nextStage  = input.stage ?? existing.stage;
  const nextReason = input.lostReason === undefined ? existing.lostReason : input.lostReason;
  if (nextStage === 'lost' && !nextReason) {
    throw BadRequest('lostReason is required when stage is "lost"', 'LOST_REASON_REQUIRED');
  }

  const stageChanged = input.stage !== undefined && input.stage !== existing.stage;
  existing.set({
    ...input,
    lostReason: nextStage === 'lost' ? nextReason : undefined,
    ...(stageChanged ? { closedAt: isClosed(nextStage) ? new Date() : null } : {}),
  });
  await existing.save();
  return existing.toObject();
}

export async function deleteDeal(id: string): Promise<ISalesDeal> {
  if (!mongoose.isValidObjectId(id)) throw NotFound('Deal');
  const deleted = await SalesDealModel.findByIdAndDelete(id).lean<ISalesDeal | null>();
  if (!deleted) throw NotFound('Deal');
  return deleted;
}
