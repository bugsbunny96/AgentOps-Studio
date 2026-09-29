import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { claimNumber, getAssignedNumber, listAvailableNumbers } from './number.service';

const ClaimSchema = z.object({ e164: z.string().min(1, 'e164 is required') });

/** GET /api/v1/telephony/numbers/available — unassigned numbers the owner can pick */
export async function listAvailableNumbersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const numbers = await listAvailableNumbers(req.userId!);
    res.status(200).json({ success: true, data: { numbers } });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/telephony/number — the org's current number (if any) */
export async function getAssignedNumberHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ success: true, data: await getAssignedNumber(req.userId!) });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/telephony/number — body { e164 } — claim a pool number for this org */
export async function claimNumberHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { e164 } = ClaimSchema.parse(req.body);
    res.status(200).json({ success: true, data: await claimNumber(req.userId!, e164) });
  } catch (err) {
    next(err);
  }
}
