/**
 * Promo Code Controller — all SA-protected.
 * Mounted at /api/v1/superadmin/promo in superadmin.routes.ts.
 *
 * Public validate endpoint:
 *   POST /api/v1/promo/validate — called from checkout before Stripe redirect
 */

import { Request, Response, NextFunction } from 'express';
import {
  createPromo,
  updatePromo,
  togglePromo,
  deletePromo,
  listPromos,
  getPromo,
  validatePromoCode,
  applyPromoManually,
} from './promo.service';
import { writeAuditLog } from '../superadmin/superadmin-audit.service';

// ─── List ─────────────────────────────────────────────────────────────────────

export async function saPromoListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page   = Number(req.query.page)  || 1;
    const limit  = Number(req.query.limit) || 20;
    const result = await listPromos(page, limit);
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function saPromoGetHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const promo = await getPromo(req.params.id as string);
    res.status(200).json({ success: true, data: promo });
  } catch (err) { next(err); }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function saPromoCreateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const promo = await createPromo(req.body, saEmail);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_PROMO_CREATE',
      targetType:      'PromoCode',
      targetId:        promo._id.toString(),
      targetLabel:     promo.code,
      req,
    });

    res.status(201).json({ success: true, data: promo });
  } catch (err) { next(err); }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function saPromoUpdateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const promo = await updatePromo(req.params.id as string, req.body);
    res.status(200).json({ success: true, data: promo });
  } catch (err) { next(err); }
}

// ─── Toggle Active ────────────────────────────────────────────────────────────

export async function saPromoToggleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const promo = await togglePromo(req.params.id as string);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: req.superAdminEmail ?? '',
      action:          'SA_PROMO_TOGGLE',
      targetType:      'PromoCode',
      targetId:        promo._id.toString(),
      targetLabel:     promo.code,
      metadata:        { active: promo.active },
      req,
    });

    res.status(200).json({ success: true, data: promo });
  } catch (err) { next(err); }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function saPromoDeleteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deletePromo(req.params.id as string);
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ─── Manual Apply ─────────────────────────────────────────────────────────────

export async function saPromoApplyHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orgId, userId, plan } = req.body;
    if (!orgId || !userId || !plan) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'orgId, userId, and plan are required' });
      return;
    }

    const saEmail = req.superAdminEmail ?? 'superadmin';
    const result  = await applyPromoManually(req.params.id as string, orgId, userId, plan, saEmail);

    await writeAuditLog({
      superAdminId:    req.superAdminId!,
      superAdminEmail: saEmail,
      action:          'SA_PROMO_APPLY',
      targetType:      'PromoCode',
      targetId:        req.params.id as string,
      targetLabel:     result.promo.code,
      metadata:        { orgId, userId, plan },
      req,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

// ─── Public Validate (called at checkout) ────────────────────────────────────

export async function publicValidatePromoHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, plan, billingCycle } = req.body;
    if (!code || !plan) {
      res.status(400).json({ success: false, code: 'MISSING_FIELDS', message: 'code and plan are required' });
      return;
    }
    const result = await validatePromoCode(code, plan, billingCycle ?? 'monthly');
    res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
}
