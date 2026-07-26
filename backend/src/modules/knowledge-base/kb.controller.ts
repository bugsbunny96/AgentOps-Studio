/**
 * Knowledge Base Controller
 *
 * Handlers for all /api/v1/knowledge-base routes.
 * userId is injected by the JWT middleware as req.userId.
 *
 * Routes:
 *   GET    /knowledge-base              → listDocsHandler
 *   POST   /knowledge-base              → createDocHandler
 *   GET    /knowledge-base/status       → statusHandler
 *   POST   /knowledge-base/re-sync      → resyncHandler
 *   GET    /knowledge-base/categories   → categoriesHandler
 *   GET    /knowledge-base/:id          → getDocHandler
 *   PATCH  /knowledge-base/:id          → updateDocHandler
 *   DELETE /knowledge-base/:id          → deleteDocHandler
 */

import type { Request, Response, NextFunction } from 'express';
import {
  listDocs,
  createDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getKbStatus,
  triggerResync,
  listCategories,
} from './kb.service';

// GET /api/v1/knowledge-base
export async function listDocsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listDocs(req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/knowledge-base
export async function createDocHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { title, content } = req.body as { title?: string; content?: string };
    const doc = await createDoc(req.userId!, {
      title:      title ?? '',
      content:    content ?? '',
      sourceType: 'manual_text',
    });
    res.status(201).json({ success: true, data: doc.toJSON() });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/knowledge-base/status  (must be declared before /:id)
export async function statusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getKbStatus(req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/knowledge-base/re-sync
export async function resyncHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await triggerResync(req.userId!);
    res.json({ success: true, data: result, message: 'Re-sync queued' });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/knowledge-base/:id
export async function getDocHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const doc = await getDoc(req.userId!, String(req.params['id'] ?? ''));
    res.json({ success: true, data: doc.toJSON() });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/knowledge-base/:id
export async function updateDocHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { title, content } = req.body as { title?: string; content?: string };
    const doc = await updateDoc(req.userId!, String(req.params['id'] ?? ''), { title, content });
    res.json({ success: true, data: doc.toJSON() });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/knowledge-base/categories
export async function categoriesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listCategories(req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/knowledge-base/:id
export async function deleteDocHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteDoc(req.userId!, String(req.params['id'] ?? ''));
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    next(err);
  }
}
