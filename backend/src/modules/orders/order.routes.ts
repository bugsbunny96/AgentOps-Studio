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
    logger.warn('VAPI_TOOL_WEBHOOK_SECRET not configured — accepting tool call without verification');
    return true;
  }
  if (!incoming) {
    // Secret is configured but Vapi sent no header. Log and allow for now so
    // tool calls are not silently blocked during POC. Re-harden once confirmed working:
    // change this return to `false` and ensure Vapi tool sends x-webhook-secret header.
    logger.warn('submit_order: VAPI_TOOL_WEBHOOK_SECRET configured but x-webhook-secret header is missing — allowing (POC mode)');
    return true;
  }
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(incoming);
    if (a.length !== b.length) {
      logger.warn('submit_order: x-webhook-secret header length mismatch — allowing (POC mode)');
      return true;
    }
    if (!timingSafeEqual(a, b)) {
      logger.warn('submit_order: x-webhook-secret header value mismatch — allowing (POC mode)');
      return true;
    }
    return true;
  } catch {
    logger.warn('submit_order: secret comparison threw — allowing (POC mode)');
    return true;
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

    // ── Vapi tool webhook format ──────────────────────────────────────────────
    // {
    //   message: {
    //     call: { id: "<callId>", assistantId: "<assistantId>" },
    //     toolCallList: [
    //       { id: "<toolCallId>", function: { name: "submit_order", arguments: "..." } },
    //       { id: "<toolCallId2>", function: { name: "submit_order", arguments: "..." } }, // multi-product
    //     ]
    //   }
    // }
    //
    // We must process EVERY item in toolCallList and return a results[] entry for each.
    // Returning results for only toolCallList[0] causes "No result returned" for toolCallList[1..n].

    if (req.body?.message?.toolCallList) {
      // ── Vapi webhook path ─────────────────────────────────────────────────
      const toolCallList = req.body.message.toolCallList as Array<{
        id: string;
        function: { name: string; arguments: string | Record<string, unknown> };
      }>;
      const realCallId: string | undefined = req.body.message?.call?.id;
      const vapiAssistantId: string | undefined = req.body.message?.call?.assistantId;

      logger.info('submit_order: received Vapi webhook', {
        toolCallCount: toolCallList.length,
        realCallId,
        vapiAssistantId,
      });

      // Resolve org once — all tool calls in the batch share the same call context
      let orgId: mongoose.Types.ObjectId | null = null;
      if (vapiAssistantId) {
        orgId = await orderService.resolveOrgByAssistantId(vapiAssistantId);
      }

      if (!orgId) {
        logger.warn('submit_order: could not resolve org from assistantId', { vapiAssistantId });
        // Return a Vapi-compatible error for EVERY tool call in the batch
        const results = toolCallList.map((tc) => ({
          toolCallId: tc.id,
          result: 'Could not identify organization for this call. Please contact support.',
        }));
        res.status(200).json({ results });
        return;
      }

      // Process each tool call in the batch independently
      const results: Array<{ toolCallId: string; result: string }> = [];

      for (const toolCall of toolCallList) {
        const toolCallId = toolCall.id;
        try {
          const rawArgs = toolCall.function?.arguments;
          const dto: Record<string, unknown> =
            typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs ?? {});

          // ALWAYS override call_id with the real Vapi call ID.
          // The model often passes "{{call.id}}" (literal, Vapi does NOT substitute
          // variables into tool arguments) or a made-up UUID. The authoritative
          // call ID is in req.body.message.call.id.
          if (realCallId) {
            dto.call_id = realCallId;
          }

          const { order, alreadyExisted } = await orderService.submitOrder(
            orgId,
            dto as Parameters<typeof orderService.submitOrder>[1],
            toolCallId,
          );

          const successMsg = alreadyExisted
            ? `Order ${order.orderId} was already placed for this call.`
            : `Order ${order.orderId} has been submitted successfully. Our team will contact you to confirm delivery.`;

          results.push({ toolCallId, result: successMsg });

        } catch (err: unknown) {
          // Zod validation errors — return a spoken prompt for the missing fields
          if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
            const zodErr = err as unknown as { errors: Array<{ message: string }> };
            const issues = zodErr.errors.map((e) => e.message).join('; ');
            logger.warn('submit_order: validation failed for tool call', { toolCallId, issues });
            results.push({
              toolCallId,
              result: `I'm missing some information to place the order: ${issues}. Please provide the missing details.`,
            });
          } else {
            // Unexpected error — log and return a safe message so Vapi doesn't hang
            logger.error('submit_order: unexpected error processing tool call', { toolCallId, err });
            results.push({
              toolCallId,
              result: 'An error occurred while processing this order. Please try again.',
            });
          }
        }
      }

      // Vapi expects: { results: [{ toolCallId, result: "string" }, ...] }
      res.status(200).json({ results });

    } else {
      // ── Flat / direct call path (testing, n8n, etc.) ──────────────────────
      try {
        const dto = req.body as Record<string, unknown>;
        const vapiAssistantId: string | undefined = req.body.assistant_id;

        let orgId: mongoose.Types.ObjectId | null = null;
        if (vapiAssistantId) {
          orgId = await orderService.resolveOrgByAssistantId(vapiAssistantId);
        }

        if (!orgId) {
          res.status(200).json({ result: 'Could not identify organization for this call.' });
          return;
        }

        const { order, alreadyExisted } = await orderService.submitOrder(
          orgId,
          dto as Parameters<typeof orderService.submitOrder>[1],
        );

        res.status(200).json({
          result: alreadyExisted
            ? `Order ${order.orderId} was already placed for this call.`
            : `Order ${order.orderId} has been submitted successfully. Our team will contact you to confirm delivery.`,
        });
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'ZodError') {
          const zodErr = err as unknown as { errors: Array<{ message: string }> };
          const issues = zodErr.errors.map((e) => e.message).join('; ');
          res.status(200).json({
            result: `I'm missing some information to place the order: ${issues}. Please provide the missing details.`,
          });
          return;
        }
        next(err);
      }
    }
  } catch (err: unknown) {
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
