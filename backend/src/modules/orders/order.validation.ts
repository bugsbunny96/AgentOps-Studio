/**
 * Order Validation — Zod schemas for the submit_order Vapi tool webhook.
 *
 * Key invariants enforced here (mirrors POC SubmitOrderDto):
 *   1. total_amount must equal quantity × unit_price (within ₹0.01 floating-point tolerance)
 *   2. delivery_address with 6-digit pincode is required when fulfillment_type = 'delivery'
 *   3. customer_phone must be a non-empty string (E.164 preferred but not enforced by Vapi)
 */

import { z } from 'zod';

const DeliveryAddressSchema = z.object({
  line1:   z.string().min(3, 'Address line 1 is required'),
  city:    z.string().min(2, 'City is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
});

export const SubmitOrderSchema = z
  .object({
    call_id:          z.string().min(1, 'call_id is required'),
    customer_name:    z.string().min(1, 'customer_name is required'),
    customer_phone:   z.string().min(1, 'customer_phone is required'),
    product:          z.string().min(1, 'product is required'),
    quantity:         z.number().int().min(1, 'quantity must be at least 1'),
    unit_price:       z.number().positive('unit_price must be a positive number'),
    total_amount:     z.number().positive('total_amount must be a positive number'),
    fulfillment_type: z.enum(['pickup', 'delivery']),
    delivery_address: DeliveryAddressSchema.optional(),
  })
  .refine(
    (data) => {
      // total_amount must equal quantity × unit_price within ₹0.01 tolerance
      const expected = Math.round(data.quantity * data.unit_price * 100) / 100;
      const given    = Math.round(data.total_amount * 100) / 100;
      return Math.abs(expected - given) < 0.01;
    },
    {
      message: 'total_amount must equal quantity × unit_price',
      path: ['total_amount'],
    },
  )
  .refine(
    (data) => {
      // delivery orders must include a delivery address
      if (data.fulfillment_type === 'delivery') {
        return (
          data.delivery_address != null &&
          data.delivery_address.line1.trim().length > 0 &&
          data.delivery_address.city.trim().length > 0 &&
          /^\d{6}$/.test(data.delivery_address.pincode)
        );
      }
      return true;
    },
    {
      message: 'delivery_address with valid 6-digit pincode is required for delivery orders',
      path: ['delivery_address'],
    },
  );

export type SubmitOrderDto = z.infer<typeof SubmitOrderSchema>;
