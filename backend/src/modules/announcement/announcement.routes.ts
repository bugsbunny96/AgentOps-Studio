/**
 * Public announcement routes — no SA auth required.
 * The authenticate middleware (JWT) provides the org plan for filtering.
 */
import { Router } from 'express';
import { publicAnnouncementsHandler } from '../superadmin/superadmin.controller';
import { authenticate } from '../../middleware/authenticate';

export const announcementRouter = Router();

// GET /api/v1/announcements — active banners for the current user's plan
// authenticate is used to get the org context (plan), but 401 returns empty array instead
announcementRouter.get('/', authenticate, publicAnnouncementsHandler);
