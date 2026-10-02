import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  createOrgHandler,
  getOrgHandler,
  updateOrgHandler,
  completeOnboardingHandler,
  getCrawlStatusHandler,
} from './onboarding.controller';
import { orgContext, requireOwner } from '../../middleware/orgContext';

export const onboardingRouter = Router();

// GET  /api/v1/onboarding/org — fetch full org for form pre-population on page refresh
onboardingRouter.get('/org', authenticate, getOrgHandler);

// GET  /api/v1/onboarding/crawl-status — poll crawl progress (called every 2s by CrawlLoadingPage)
onboardingRouter.get('/crawl-status', authenticate, getCrawlStatusHandler);

// POST /api/v1/onboarding/org — Step 1: create the organization
onboardingRouter.post('/org', authenticate, createOrgHandler);

// PATCH /api/v1/onboarding/org — Steps 2-4: learn / configure / customize
onboardingRouter.patch('/org', authenticate, orgContext, requireOwner, updateOrgHandler);   // SEC-05

// POST /api/v1/onboarding/complete — Step 5: mark onboarding as COMPLETED
onboardingRouter.post('/complete', authenticate, orgContext, requireOwner, completeOnboardingHandler);
