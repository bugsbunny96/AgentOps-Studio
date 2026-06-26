import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  createOrgHandler,
  updateOrgHandler,
  completeOnboardingHandler,
} from './onboarding.controller';

export const onboardingRouter = Router();

// POST /api/v1/onboarding/org — Step 1: create the organization
onboardingRouter.post('/org', authenticate, createOrgHandler);

// PATCH /api/v1/onboarding/org — Steps 2-4: learn / configure / customize
onboardingRouter.patch('/org', authenticate, updateOrgHandler);

// POST /api/v1/onboarding/complete — Step 5: mark onboarding as COMPLETED
onboardingRouter.post('/complete', authenticate, completeOnboardingHandler);
