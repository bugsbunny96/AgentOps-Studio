import { Request, Response, NextFunction } from 'express';
import { CreateOrgSchema, UpdateOrgSchema } from './onboarding.schema';
import { createOrg, updateOrgStep, completeOnboarding } from './onboarding.service';

// POST /api/v1/onboarding/org
export async function createOrgHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dto = CreateOrgSchema.parse(req.body);
    const data = await createOrg(req.userId!, dto);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/onboarding/org
export async function updateOrgHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dto = UpdateOrgSchema.parse(req.body);
    const data = await updateOrgStep(req.userId!, dto);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/onboarding/complete
export async function completeOnboardingHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await completeOnboarding(req.userId!);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
