/**
 * Analytics Routes
 *
 * All routes are authenticated — the authenticate middleware verifies the JWT
 * and injects req.user.id before the handler runs.
 *
 * GET /api/v1/analytics/overview          → KPI cards
 * GET /api/v1/analytics/calls-per-day     → bar chart data (?days=30)
 * GET /api/v1/analytics/top-callers       → top callers list (?limit=10)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  overviewHandler,
  callsPerDayHandler,
  topCallersHandler,
} from './analytics.controller';
import { orgContext } from '../../middleware/orgContext';

const router = Router();

router.get('/overview',       authenticate, orgContext, overviewHandler);
router.get('/calls-per-day',  authenticate, orgContext, callsPerDayHandler);
router.get('/top-callers',    authenticate, orgContext, topCallersHandler);

export { router as analyticsRouter };
