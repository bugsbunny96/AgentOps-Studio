/**
 * Order Routes
 *
 * POST /api/v1/orders/submit   — Vapi tool-call webhook (x-webhook-secret auth, NOT the user JWT)
 * GET  /api/v1/orders          — List orders (JWT auth, org-scoped)
 * GET  /api/v1/orders/:orderId — Get single order detail (JWT auth, org-scoped)
 * PATCH /api/v1/orders/:orderId/status — Update order status (JWT auth, org-scoped)
 *
 * The submit endpoint is deliberately NOT behind requireAuth because Vapi calls it
 * from its tool server infrastructure — there's no user session. Instead it uses
 * the x-webhook-secret header to authenticate (same pattern as the POC guard).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import mongoose from 'mongoose';
import { authenticate } from '../../middleware/authenticate';
import { MembershipModel } from '../organization/organization.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import * as orderService from './order.service';

const router = Router();

// ── Webhook secret verification ───────────────────────────────────────────────

function verifyToolWebhookSecret(incoming: string | undefined): boolean {
  const expected = env.VAPI_TOOL_WEBHOOK_SECRET;
  if (!expected) {
    if (env.NODE_ENV === 'production') {
      logger.warn('VAPI_TOOL_WEBHOOK_SECRET not set — rejecting tool call in production');
      return false;
    }
    logger.warn('VAPI_TOOL_WEBHOOK_SECRET not set — skipping verification in dev mode');
    return true;
  }
  if (!incoming) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(incoming);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── POST /api/v1/orders/submit (Vapi tool call) ───────────────────────────────

router.post('/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = req.headers['x-webhook-secret'] as string | undefined;
    if (!verifyToolWebhookSecret(secret)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Vapi tool call body format:
    // { message: { call: { assistantId }, toolCallList: [{ function: { arguments } }] } }
    // We support both the nested Vapi format and a flat direct call (for testing).
    let dto: Record<string, unknown>;
    let vapiAssistantId: string | undefined;

    if (req.body?.message?.toolCallList) {
      // Vapi tool webhook format
      const args = req.body.message.toolCallList[0]?.function?.arguments;
      dto = typeof args === 'string' ? JSON.parse(args) : args;
      vapiAssistantId = req.body.message?.call?.assistantId;

      // Inject call_id from the Vapi call object if not in args
      if (!dto.call_id && req.body.message?.call?.id) {
        dto.call_id = req.body.message.call.id;
      }
    } else {
      // Direct flat call (testing / n8n automation)
      dto = req.body;
      vapiAssistantId = req.body.assistant_id;
    }

    // Resolve org from assistantId
    let orgId: mongoose.Types.ObjectId | null = null;
    if (vapiAssistantId) {
      orgId = await orderService.resolveOrgByAssistantId(vapiAssistantId);
    }

    if (!orgId) {
      logger.warn('submit_order: could not resolve org from assistantId', { vapiAssistantId });
      // Return a Vapi-compatible error response (tool calls expect a result object)
      res.status(200).json({
        result: { success: false, error: 'Could not identify organization for this call.' },
      });
      return;
    }

    const { order, alreadyExisted } = await orderService.submitOrder(orgId, dto as Parameters<typeof orderService.submitOrder>[1]);

    // Vapi tool calls expect a 200 with a `result` object that the assistant reads aloud
    res.status(200).json({
      result: {
        success: true,
        orderId: order.orderId,
        status:  order.status,
        message: alreadyExisted
          ? `Order ${order.orderId} was already placed for this call.`
          : `Order ${order.orderId} has been submitted successfully.`,
      },
    });
  } catch (err: unknown) {
    // Zod validation errors — return as a Vapi-friendly tool failure
    if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
      const zodErr = err as unknown as { errors: Array<{ message: string }> };
      const issues = zodErr.errors.map((e) => e.message).join('; ');
      logger.warn('submit_order: validation failed', { issues });
      res.status(200).json({
        result: { success: false, error: `Validation error: ${issues}` },
      });
      return;
    }
    next(err);
  }
});

// ── Helper: resolve authenticated user's orgId ────────────────────────────────

async function resolveOrgId(userId: string): Promise<mongoose.Types.ObjectId> {
  const membership = await MembershipModel.findOne({ userId });
  if (!membership) throw new Error('Organization not found');
  return membership.organizationId as mongoose.Types.ObjectId;
}

// All list/detail/status routes require authentication
// (submit is intentionally unauthenticated — it uses webhook secret instead)

// ── GET /api/v1/orders ────────────────────────────────────────────────────────

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = await resolveOrgId(req.userId!);
    const page  = parseInt(typeof req.query.page === 'string' ? req.query.page : '1', 10) || 1;
    const limit = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20', 10) || 20;

    const result = await orderService.listOrders(orgId, page, Math.min(limit, 100));

    res.json({
      ...result,
      orders: result.orders.map((o) => o.toJSON()),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/orders/:orderId ───────────────────────────────────────────────

router.get('/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = await resolveOrgId(req.userId!);
    const order = await orderService.getOrderById(orgId, req.params.orderId as string);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json({ order: order.toJSON() });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/orders/:orderId/status ──────────────────────────────────────

router.patch('/:orderId/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = await resolveOrgId(req.userId!);
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    const order = await orderService.updateOrderStatus(orgId, req.params.orderId as string, status);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json({ order: order.toJSON() });
  } catch (err) {
    next(err);
  }
});

export { router as ordersRouter };
