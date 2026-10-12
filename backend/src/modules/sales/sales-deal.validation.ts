import { z } from 'zod';
import { DEAL_PLANS, DEAL_SOURCES, DEAL_STAGES, LOST_REASONS } from './sales-deal.model';

const money = z.number().int().min(0).max(10_000_000);
const optText = (max: number) => z.string().trim().max(max).optional();

const priceAnswers = z.object({
  tooCheapInr:     money.optional(),
  bargainInr:      money.optional(),
  expensiveInr:    money.optional(),
  tooExpensiveInr: money.optional(),
}).strict();

const base = z.object({
  businessName:     z.string().trim().min(1).max(200),
  city:             optText(100),
  niche:            optText(100),
  contactName:      optText(120),
  source:           z.enum(DEAL_SOURCES).optional(),
  stage:            z.enum(DEAL_STAGES).optional(),
  lostReason:       z.enum(LOST_REASONS).nullable().optional(),
  plan:             z.enum(DEAL_PLANS).nullable().optional(),
  callsPerDay:      z.number().min(0).max(100_000).nullable().optional(),
  avgOrderValueInr: money.nullable().optional(),
  successMeasure:   optText(500),
  nextStep:         optText(300),
  nextStepAt:       z.coerce.date().nullable().optional(),
  notes:            optText(4000),
  priceAnswers:     priceAnswers.optional(),
}).strict();

const lostNeedsReason = (d: { stage?: string; lostReason?: string | null }) =>
  d.stage !== 'lost' || !!d.lostReason;
const reasonMsg = { message: 'lostReason is required when stage is "lost"', path: ['lostReason'] };

export const createDealSchema = base.refine(lostNeedsReason, reasonMsg);
/** Lost-reason rule for updates is checked in the service against the stored deal. */
export const updateDealSchema = base.partial();

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
