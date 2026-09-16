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
 * Returns the order document. If the call_id already has an order, returns the
 * existing order with `alreadyExisted: true`.
 */
export async function submitOrder(
  orgId: mongoose.Types.ObjectId,
  dto: SubmitOrderDto,
): Promise<{ order: IOrder; alreadyExisted: boolean }> {

  // Validate (throws ZodError if invalid — caught by the route handler)
  const validated = SubmitOrderSchema.parse(dto);

  // Idempotency check — return existing order if the same call already submitted one
  const existing = await OrderModel.findOne({ callId: validated.call_id });
  if (existing) {
    logger.info('submitOrder: returning existing order for call_id', {
      callId: validated.call_id,
      orderId: existing.orderId,
    });
    return { order: existing, alreadyExisted: true };
  }

  const orderId = await generateUniqueOrderId();

  const order = await OrderModel.create({
    orderId,
    callId:          validated.call_id,
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
 */
export async function resolveOrgByAssistantId(
  vapiAssistantId: string,
): Promise<mongoose.Types.ObjectId | null> {
  // vapiAssistantId is stored on the Agent model, not Organization.
  // Look up the agent first, then return its organizationId.
  const agent = await VoiceAgentModel.findOne({ vapiAssistantId }).select('organizationId');
  if (agent) return agent.organizationId as mongoose.Types.ObjectId;

  // Fallback: check Organization model in case some orgs have it there too
  const org = await OrganizationModel.findOne({ vapiAssistantId });
  return org ? org._id as mongoose.Types.ObjectId : null;
}
