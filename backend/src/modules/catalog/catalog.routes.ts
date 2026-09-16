/**
 * Catalog Routes — GET/POST/PATCH/DELETE for the org's electrical product catalog.
 *
 * All routes are org-scoped and require authentication.
 * GET /api/v1/catalog        — list all active items
 * GET /api/v1/catalog/:id    — get item by itemId (e.g. EL-001)
 * POST /api/v1/catalog       — create a new item (admin only)
 * PATCH /api/v1/catalog/:id  — update an item (admin only)
 * DELETE /api/v1/catalog/:id — soft-delete an item (admin only)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../../middleware/authenticate';
import { MembershipModel } from '../organization/organization.model';
import * as catalogService from './catalog.service';

const router = Router();

/** Resolve the authenticated user's orgId — shared across handlers */
async function resolveOrgId(userId: string): Promise<mongoose.Types.ObjectId> {
  const membership = await MembershipModel.findOne({ userId });
  if (!membership) throw new Error('Organization not found');
  return membership.organizationId as mongoose.Types.ObjectId;
}

// All routes require authentication
router.use(authenticate);

// ── GET /api/v1/catalog ───────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = await resolveOrgId(req.userId!);
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    const items = category
      ? await catalogService.findByCategory(orgId, category)
      : await catalogService.findAll(orgId);

    res.json({ items: items.map((i) => i.toJSON()) });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/catalog/:id ───────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = await resolveOrgId(req.userId!);
    const item = await catalogService.findByItemId(orgId, req.params.id as string);

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ item: item.toJSON() });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/catalog ─────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = await resolveOrgId(req.userId!);
    const item = await catalogService.createItem(orgId, req.body);
    res.status(201).json({ item: item.toJSON() });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/catalog/:id ─────────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = await resolveOrgId(req.userId!);
    const item = await catalogService.updateItem(orgId, req.params.id as string, req.body);

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ item: item.toJSON() });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/v1/catalog/:id ────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = await resolveOrgId(req.userId!);
    const item = await catalogService.deactivateItem(orgId, req.params.id as string);

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ message: 'Item deactivated', item: item.toJSON() });
  } catch (err) {
    next(err);
  }
});

export { router as catalogRouter };
