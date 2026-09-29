import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  claimNumberHandler,
  getAssignedNumberHandler,
  listAvailableNumbersHandler,
} from './telephony.controller';

export const telephonyRouter = Router();

telephonyRouter.use(authenticate);

// GET  /api/v1/telephony/numbers/available — pick list for onboarding Step 5 / Settings
telephonyRouter.get('/numbers/available', listAvailableNumbersHandler);

// GET  /api/v1/telephony/number — current number for this org
telephonyRouter.get('/number', getAssignedNumberHandler);

// POST /api/v1/telephony/number — { e164 } — assign + import into Vapi
telephonyRouter.post('/number', claimNumberHandler);
