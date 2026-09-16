/**
 * Order — Mongoose model for call-captured orders.
 *
 * Orders are created by the Vapi submit_order tool call when a customer
 * confirms a purchase during a voice call. Idempotent by call_id: the same
 * call retrying will return the existing order rather than creating a duplicate.
 *
 * Key constraints (mirrors POC validation):
 *   - total_amount MUST equal quantity × unit_price (prevents ₹0 payment link bug)
 *   - delivery_address with valid 6-digit pincode is required when fulfillment_type = 'delivery'
 *   - orderId format: RE-XXXXXXXX (8 uppercase alphanumeric chars)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliveryAddress {
  line1: string;
  city: string;
  pincode: string;  // 6-digit string
}

export type OrderFulfillmentType = 'pickup' | 'delivery';
export type OrderStatus =
  | 'pending_payment_arrangement'
  | 'payment_received'
  | 'processing'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  /** Short human-readable order ID, e.g. RE-A3F9K2LM */
  orderId: string;
  /** Vapi call ID — reference to the originating voice call */
  callId: string;
  /**
   * Vapi tool call ID (toolCallList[i].id) — used for idempotency.
   * A single voice call (callId) can have multiple submit_order tool calls
   * (one per product). toolCallId is unique per tool invocation and is the
   * correct idempotency key for multi-product orders.
   * Optional for backward compatibility with older orders that pre-date this field.
   */
  toolCallId?: string;
  organizationId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  product: string;
  quantity: number;
  /** Unit price in INR as provided from catalog */
  unitPrice: number;
  /** Must equal quantity × unitPrice */
  totalAmount: number;
  fulfillmentType: OrderFulfillmentType;
  /** Required when fulfillmentType = 'delivery' */
  deliveryAddress?: IDeliveryAddress;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryAddressSchema = new Schema<IDeliveryAddress>(
  {
    line1:   { type: String, required: true, trim: true },
    city:    { type: String, required: true, trim: true },
    pincode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, 'Pincode must be exactly 6 digits'],
    },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    callId: {
      type: String,
      required: true,
      // NOT unique — a single call can submit multiple products via multiple tool calls.
      // Use toolCallId for idempotency instead.
      index: true,
    },
    toolCallId: {
      type: String,
      required: false,
      // sparse: true so that legacy orders without toolCallId don't conflict
      sparse: true,
      unique: true,  // idempotency: one order per tool call invocation
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    customerName:  { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    product:       { type: String, required: true, trim: true },
    quantity:      { type: Number, required: true, min: 1 },
    unitPrice:     { type: Number, required: true, min: 0 },
    totalAmount:   { type: Number, required: true, min: 0 },
    fulfillmentType: {
      type: String,
      enum: ['pickup', 'delivery'],
      required: true,
    },
    deliveryAddress: {
      type: DeliveryAddressSchema,
      required: false,
    },
    status: {
      type: String,
      enum: [
        'pending_payment_arrangement',
        'payment_received',
        'processing',
        'dispatched',
        'delivered',
        'cancelled',
      ],
      default: 'pending_payment_arrangement',
    },
  },
  { timestamps: true },
);

// Compound index for org-scoped listing
OrderSchema.index({ organizationId: 1, createdAt: -1 });

OrderSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    ret.organizationId = ret.organizationId?.toString();
    delete ret.__v;
    return ret;
  },
});

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
