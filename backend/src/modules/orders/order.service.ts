/**
 * Order Service
 *
 * submitOrder() is called by the Vapi submit_order tool webhook.
 * It is idempotent by call_id: a retry from the same call returns the existing
 * order rather than creating a duplicate.
 *
 * Critical invariants (see order.validation.ts):
 *   - total_amount MUST equal quantity × unit_price
 *   - delivery orders require delivery_address with 6-digit pincode
 */

import mongoose from 'mongoose';
import { OrderModel, type IOrder } from './order.model';
import { SubmitOrderSchema, type SubmitOrderDto } from './order.validation';
import { OrganizationModel } from '../organization/organization.model';
import { VoiceAgentModel } from '../agents/agent.model';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// ── Order ID Generator ─────────────────────────────────────────────────────────

/** Generates a human-readable order ID in the format RE-XXXXXXXX (8 alphanum chars) */
function generateOrderId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'RE-';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/** Ensure orderId uniqueness (extremely unlikely collision, but handle gracefully) */
async function generateUniqueOrderId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateOrderId();
    const exists = await OrderModel.exists({ orderId: id });
    if (!exists) return id;
  }
  throw new Error('Failed to generate unique orderId after 5 attempts');
}

// ── Main service functions ─────────────────────────────────────────────────────

/**
 * Submit a new order from a Vapi tool call.
 *
 * The `orgId` is resolved from the Vapi assistant's phone number / webhook auth context
 * (callers pass it explicitly; see order.routes.ts for how it is looked up).
 *
 * The `toolCallId` (Vapi's unique ID for this specific tool invocation) is the
 * idempotency key. A single voice call can submit multiple products via multiple
 * submit_order invocations — each has a different toolCallId, so they each get
 * their own order document.
 *
 * Returns the order document. If the toolCallId already has an order, returns the
 * existing order with `alreadyExisted: true`.
 */
export async function submitOrder(
  orgId: mongoose.Types.ObjectId,
  dto: SubmitOrderDto,
  toolCallId?: string,
): Promise<{ order: IOrder; alreadyExisted: boolean }> {

  // Validate (throws ZodError if invalid — caught by the route handler)
  const validated = SubmitOrderSchema.parse(dto);

  // Idempotency check:
  //   - Prefer toolCallId (unique per product line in a multi-product order)
  //   - Fall back to callId for legacy requests that don't have toolCallId
  const idempotencyQuery = toolCallId
    ? { toolCallId }
    : { callId: validated.call_id };

  const existing = await OrderModel.findOne(idempotencyQuery);
  if (existing) {
    logger.info('submitOrder: returning existing order (idempotency)', {
      idempotencyKey: toolCallId ? `toolCallId=${toolCallId}` : `callId=${validated.call_id}`,
      orderId: existing.orderId,
    });
    return { order: existing, alreadyExisted: true };
  }

  const orderId = await generateUniqueOrderId();

  const order = await OrderModel.create({
    orderId,
    callId:          validated.call_id,
    toolCallId:      toolCallId,  // undefined for legacy callers — sparse index ignores it
    organizationId:  orgId,
    customerName:    validated.customer_name,
    customerPhone:   validated.customer_phone,
    product:         validated.product,
    quantity:        validated.quantity,
    unitPrice:       validated.unit_price,
    totalAmount:     validated.total_amount,
    fulfillmentType: validated.fulfillment_type,
    deliveryAddress: validated.delivery_address,
    status:          'pending_payment_arrangement',
  });

  logger.info('Order submitted successfully', {
    orderId,
    callId:    validated.call_id,
    orgId:     orgId.toString(),
    product:   validated.product,
    quantity:  validated.quantity,
    total:     validated.total_amount,
    fulfillment: validated.fulfillment_type,
  });

  return { order, alreadyExisted: false };
}

/**
 * Return a paginated list of orders for an org, newest first.
 */
export async function listOrders(
  orgId: mongoose.Types.ObjectId,
  page: number = 1,
  limit: number = 20,
): Promise<{ orders: IOrder[]; total: number; page: number; pages: number }> {
  const skip  = (page - 1) * limit;
  const total = await OrderModel.countDocuments({ organizationId: orgId });
  const orders = await OrderModel
    .find({ organizationId: orgId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    orders,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Lookup a single order by orderId (RE-XXXXXXXX), scoped to the org.
 */
export async function getOrderById(
  orgId: mongoose.Types.ObjectId,
  orderId: string,
): Promise<IOrder | null> {
  return OrderModel.findOne({ organizationId: orgId, orderId: orderId.toUpperCase() });
}

/**
 * Update order status (e.g. 'pending_payment_arrangement' → 'payment_received').
 */
export async function updateOrderStatus(
  orgId: mongoose.Types.ObjectId,
  orderId: string,
  status: IOrder['status'],
): Promise<IOrder | null> {
  return OrderModel.findOneAndUpdate(
    { organizationId: orgId, orderId: orderId.toUpperCase() },
    { $set: { status } },
    { new: true },
  );
}

/**
 * Resolve the orgId from a Vapi assistant ID.
 * Used by the submit_order webhook to find the org without requiring the user
 * to be logged in (it's a tool call from Vapi, not a user request).
 *
 * Lookup order:
 *   1. OrganizationModel.vapiAssistantId  ← set by provisionAgent()
 *   2. VoiceAgentModel.vapiAssistantId    ← also set by provisionAgent()
 *   3. Single-org POC fallback            ← if only one org exists in the DB,
 *                                            use it (handles manually-created
 *                                            Vapi assistants not provisioned
 *                                            through the app). Logs a warning.
 *                                            REMOVE this fallback in production
 *                                            when multi-tenancy is required.
 */
export async function resolveOrgByAssistantId(
  vapiAssistantId: string,
): Promise<mongoose.Types.ObjectId | null> {
  // 1. Primary: Organization model (saved by provisionAgent)
  const org = await OrganizationModel.findOne({ vapiAssistantId });
  if (org) return org._id as mongoose.Types.ObjectId;

  // 2. Secondary: VoiceAgent model (also saved by provisionAgent as belt+suspenders)
  const agent = await VoiceAgentModel.findOne({ vapiAssistantId }).select('organizationId');
  if (agent) return agent.organizationId as mongoose.Types.ObjectId;

  // 3. POC fallback: if there is exactly one org in the system, use it.
  //    This handles the case where a Vapi assistant was created manually in the
  //    Vapi dashboard and its ID was never stored in MongoDB via provisionAgent.
  //    Safe only in single-tenant deployments — remove when going multi-tenant.
  const orgCount = await OrganizationModel.countDocuments();
  if (orgCount === 1) {
    const singleOrg = await OrganizationModel.findOne();
    if (singleOrg) {
      logger.warn(
        'resolveOrgByAssistantId: vapiAssistantId not found in DB — using single-org POC fallback. ' +
        'Run provisionAgent() or update org.vapiAssistantId in MongoDB to make this permanent.',
        { vapiAssistantId, orgId: singleOrg._id.toString() },
      );
      // Persist the mapping so future lookups hit the fast path (no more fallback)
      await OrganizationModel.findByIdAndUpdate(singleOrg._id, {
        $set: { vapiAssistantId },
      });
      logger.info('resolveOrgByAssistantId: auto-saved vapiAssistantId to org', {
        vapiAssistantId,
        orgId: singleOrg._id.toString(),
      });
      return singleOrg._id as mongoose.Types.ObjectId;
    }
  }

  return null;
}
