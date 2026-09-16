/**
 * Blog Controller
 *
 * Public endpoints (no auth):
 *   GET  /api/v1/blog          — list published posts
 *   GET  /api/v1/blog/:slug    — get one published post by slug
 *
 * Super Admin endpoints (requireSuperAdmin — mounted in superadmin.routes.ts):
 *   GET    /api/v1/superadmin/blog            — list all posts (any status)
 *   POST   /api/v1/superadmin/blog            — create post
 *   GET    /api/v1/superadmin/blog/:id        — get any post by ID
 *   PATCH  /api/v1/superadmin/blog/:id        — update post
 *   PATCH  /api/v1/superadmin/blog/:id/toggle — publish/unpublish
 *   DELETE /api/v1/superadmin/blog/:id        — delete post
 */

import { Request, Response, NextFunction } from 'express';
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  togglePostStatus,
  deletePost,
} from './blog.service';

// ── Public ────────────────────────────────────────────────────────────────────

export async function publicListBlogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 10;
    const tag   = (req.query.tag as string) || undefined;

    const result = await listPosts({ status: 'published', tag, page, limit });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function publicGetBlogHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const post = await getPost(slug);

    // Public endpoint: only return published posts
    if ((post as { status: string }).status !== 'published') {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Blog post not found' });
      return;
    }

    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

// ── Super Admin ───────────────────────────────────────────────────────────────

export async function saBlogListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page   = Number(req.query.page)  || 1;
    const limit  = Number(req.query.limit) || 20;
    const status = (req.query.status as string) || undefined;

    const result = await listPosts({
      status: status as 'draft' | 'published' | undefined,
      page,
      limit,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function saBlogGetHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await getPost(req.params.id as string);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function saBlogCreateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, subtitle, body, coverImage, author, tags, status } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ success: false, code: 'MISSING_TITLE', message: 'Title is required' });
      return;
    }
    if (!body?.trim()) {
      res.status(400).json({ success: false, code: 'MISSING_BODY', message: 'Body is required' });
      return;
    }

    const saEmail = req.superAdminEmail ?? 'superadmin';
    const post = await createPost({ title, subtitle, body, coverImage, author, tags, status }, saEmail);
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function saBlogUpdateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await updatePost(req.params.id as string, req.body);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function saBlogToggleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await togglePostStatus(req.params.id as string);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function saBlogDeleteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deletePost(req.params.id as string);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
