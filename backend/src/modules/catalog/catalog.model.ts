/**
 * Catalog — Mongoose model for electrical/electronics product items.
 *
 * Each item is scoped to an organization so org admins can customize
 * their product list. A default seed of 32 items (EL-001 to EL-032)
 * is loaded when a new org is created via catalog.service.ts → seedForOrg().
 */

import mongoose, { Schema, Document } from 'mongoose';

// ── Categories from the POC seed data ────────────────────────────────────────
export type CatalogCategory =
  | 'Lighting'
  | 'Fans'
  | 'Switches & Sockets'
  | 'Wires & Cables'
  | 'Protection Devices'
  | 'Electrical Accessories'
  | 'Switchgear'
  | 'Conduits & Accessories'
  | 'Solar Equipment'
  | 'Domestic Appliances'
  | 'Industrial Components'
  | 'Safety Equipment';

export interface ICatalogItem extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  /** Catalog ID, e.g. EL-001 */
  itemId: string;
  name: string;
  category: CatalogCategory;
  brand?: string;
  /** Price in INR */
  price: number;
  /** Unit of measure, e.g. 'piece', 'metre', 'roll' */
  unit: string;
  /** Available stock quantity */
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CatalogItemSchema = new Schema<ICatalogItem>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    itemId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Lighting',
        'Fans',
        'Switches & Sockets',
        'Wires & Cables',
        'Protection Devices',
        'Electrical Accessories',
        'Switchgear',
        'Conduits & Accessories',
        'Solar Equipment',
        'Domestic Appliances',
        'Industrial Components',
        'Safety Equipment',
      ],
    },
    brand:  { type: String, trim: true },
    price:  { type: Number, required: true, min: 0 },
    unit:   { type: String, required: true, default: 'piece' },
    stock:  { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Unique per org (org can't have duplicate itemIds)
CatalogItemSchema.index({ organizationId: 1, itemId: 1 }, { unique: true });
// Fast category filter queries (used for prompt injection)
CatalogItemSchema.index({ organizationId: 1, category: 1 });

CatalogItemSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id.toString();
    ret.organizationId = ret.organizationId?.toString();
    delete ret.__v;
    return ret;
  },
});

export const CatalogItemModel = mongoose.model<ICatalogItem>('CatalogItem', CatalogItemSchema);
