/** Super-admin handlers for the sales deal log (MKT-11). Mounted under /superadmin/sales. */
import type { Request, Response, NextFunction } from 'express';
import { writeAuditLog } from '../superadmin/superadmin-audit.service';
import { DEAL_STAGES, type DealStage } from './sales-deal.model';
import { createDealSchema, updateDealSchema } from './sales-deal.validation';
import { createDeal, deleteDeal, getDealSummary, listDeals, updateDeal } from './sales-deal.service';

export async function saListDealsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stageQ = String(req.query.stage ?? '');
    const stage  = (DEAL_STAGES as readonly string[]).includes(stageQ) ? (stageQ as DealStage) : undefined;
    const limit  = Number(req.query.limit) || undefined;
    res.status(200).json({ success: true, data: await listDeals({ stage, limit }) });
  } catch (err) { next(err); }
}

export async function saDealSummaryHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ success: true, data: await getDealSummary() });
  } catch (err) { next(err); }
}

export async function saCreateDealHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input   = createDealSchema.parse(req.body);
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const deal    = await createDeal(input, saEmail);
    await writeAuditLog({
      superAdminId: req.superAdminId!, superAdminEmail: saEmail,
      action: 'SA_DEAL_CREATE', targetType: 'SalesDeal',
      targetId: String(deal._id), targetLabel: deal.businessName,
      metadata: { stage: deal.stage, source: deal.source }, req,
    });
    res.status(201).json({ success: true, data: deal });
  } catch (err) { next(err); }
}

export async function saUpdateDealHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input   = updateDealSchema.parse(req.body);
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const deal    = await updateDeal(String(req.params.id), input);
    await writeAuditLog({
      superAdminId: req.superAdminId!, superAdminEmail: saEmail,
      action: 'SA_DEAL_UPDATE', targetType: 'SalesDeal',
      targetId: String(deal._id), targetLabel: deal.businessName,
      metadata: { fields: Object.keys(input), stage: deal.stage }, req,
    });
    res.status(200).json({ success: true, data: deal });
  } catch (err) { next(err); }
}

export async function saDeleteDealHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const deal    = await deleteDeal(String(req.params.id));
    await writeAuditLog({
      superAdminId: req.superAdminId!, superAdminEmail: saEmail,
      action: 'SA_DEAL_DELETE', targetType: 'SalesDeal',
      targetId: String(deal._id), targetLabel: deal.businessName, req,
    });
    res.status(200).json({ success: true, data: { id: String(deal._id) } });
  } catch (err) { next(err); }
}
