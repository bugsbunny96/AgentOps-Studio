/**
 * Public changelog routes — no auth required.
 * Used by the public /changelog page and the dashboard "What's new" dot.
 */
import { Router } from 'express';
import { publicChangelogHandler, publicChangelogLatestHandler } from '../superadmin/superadmin.controller';

export const changelogRouter = Router();

// GET /api/v1/changelog          — paginated published entries
// GET /api/v1/changelog/latest   — latest published entry date (for dot indicator)
changelogRouter.get('/latest', publicChangelogLatestHandler);
changelogRouter.get('/',       publicChangelogHandler);
