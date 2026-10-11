import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  claimNumberHandler,
  getAssignedNumberHandler,
  listAvailableNumbersHandler,
  autoAssignNumberHandler,
} from './telephony.controller';
import { orgContext, requireOwner } from '../../middleware/orgContext';

export const telephonyRouter = Router();

telephonyRouter.use(authenticate, orgContext);   // SEC-05

// GET  /api/v1/telephony/numbers/available — pick list for onboarding Step 5 / Settings
telephonyRouter.get('/numbers/available', listAvailableNumbersHandler);

// GET  /api/v1/telephony/number — current number for this org
telephonyRouter.get('/number', getAssignedNumberHandler);

// POST /api/v1/telephony/number — { e164 } — assign (buy if needed) + import into Vapi
telephonyRouter.post('/number', requireOwner, claimNumberHandler);

// POST /api/v1/telephony/number/auto — "pick one for me"
telephonyRouter.post('/number/auto', requireOwner, autoAssignNumberHandler);
