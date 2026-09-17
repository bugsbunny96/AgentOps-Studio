/**
 * Public blog routes — no authentication required.
 * Mounted at /api/v1/blog in app.ts.
 *
 * Super Admin blog routes are mounted inside superadmin.routes.ts
 * at /api/v1/superadmin/blog.
 */

import { Router } from 'express';
import { publicListBlogHandler, publicGetBlogHandler } from './blog.controller';

export const blogRouter = Router();

blogRouter.get('/',      publicListBlogHandler);
blogRouter.get('/:slug', publicGetBlogHandler);
