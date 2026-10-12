import type { Request, Response, NextFunction } from 'express';
import { writeAuditLog } from '../superadmin/superadmin-audit.service';
import { clearFoundingClient, getFoundingSpots, markFoundingClient } from './founding.service';

/** GET /api/v1/founding-spots — public; the Pricing page shows spots left this quarter. */
export async function publicFoundingSpotsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).json({ success: true, data: await getFoundingSpots() });
  } catch (err) { next(err); }
}

/** POST /api/v1/superadmin/orgs/:id/founding */
export async function saMarkFoundingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const org = await markFoundingClient(String(req.params.id), saEmail);
    await writeAuditLog({
      superAdminId: req.superAdminId!, superAdminEmail: saEmail,
      action: 'SA_FOUNDING_SET', targetType: 'Organization',
      targetId: String(org._id), targetLabel: org.name,
      metadata: { priceLockUntil: org.foundingClient?.priceLockUntil }, req,
    });
    res.status(200).json({ success: true, data: { foundingClient: org.foundingClient } });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/superadmin/orgs/:id/founding */
export async function saClearFoundingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saEmail = req.superAdminEmail ?? 'superadmin';
    const org = await clearFoundingClient(String(req.params.id));
    await writeAuditLog({
      superAdminId: req.superAdminId!, superAdminEmail: saEmail,
      action: 'SA_FOUNDING_CLEAR', targetType: 'Organization',
      targetId: String(org._id), targetLabel: org.name, req,
    });
    res.status(200).json({ success: true, data: { foundingClient: null } });
  } catch (err) { next(err); }
}
