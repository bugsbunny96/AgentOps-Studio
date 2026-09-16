/**
 * Catalog Service
 *
 * CRUD for electrical product catalog items, scoped to an organization.
 * seedForOrg() is called on new org creation to populate the default 32-item
 * electrical catalog (EL-001 to EL-032). Idempotent — safe to call multiple times.
 */

import mongoose from 'mongoose';
import { CatalogItemModel, type ICatalogItem, type CatalogCategory } from './catalog.model';
import { logger } from '../../utils/logger';

// ── Default seed catalog (32 electrical items from POC) ────────────────────────

interface SeedItem {
  itemId: string;
  name: string;
  category: CatalogCategory;
  brand: string;
  price: number;
  unit: string;
  stock: number;
}

const DEFAULT_CATALOG: SeedItem[] = [
  // Lighting
  { itemId: 'EL-001', name: 'LED Bulb 9W', category: 'Lighting', brand: 'Philips', price: 85, unit: 'piece', stock: 500 },
  { itemId: 'EL-002', name: 'LED Bulb 12W', category: 'Lighting', brand: 'Philips', price: 110, unit: 'piece', stock: 400 },
  { itemId: 'EL-003', name: 'LED Panel Light 18W', category: 'Lighting', brand: 'Havells', price: 450, unit: 'piece', stock: 150 },
  { itemId: 'EL-004', name: 'LED Batten Light 20W', category: 'Lighting', brand: 'Syska', price: 320, unit: 'piece', stock: 200 },
  { itemId: 'EL-005', name: 'LED Downlight 7W', category: 'Lighting', brand: 'Orient', price: 280, unit: 'piece', stock: 180 },
  { itemId: 'EL-006', name: 'Emergency Light', category: 'Lighting', brand: 'Luminous', price: 650, unit: 'piece', stock: 80 },

  // Fans
  { itemId: 'EL-007', name: 'Ceiling Fan 48"', category: 'Fans', brand: 'Crompton', price: 1800, unit: 'piece', stock: 60 },
  { itemId: 'EL-008', name: 'Ceiling Fan 56"', category: 'Fans', brand: 'Bajaj', price: 2200, unit: 'piece', stock: 45 },
  { itemId: 'EL-009', name: 'Table Fan', category: 'Fans', brand: 'Usha', price: 1200, unit: 'piece', stock: 50 },
  { itemId: 'EL-010', name: 'Exhaust Fan 150mm', category: 'Fans', brand: 'Havells', price: 750, unit: 'piece', stock: 70 },

  // Switches & Sockets
  { itemId: 'EL-011', name: 'Modular Switch 6A', category: 'Switches & Sockets', brand: 'Legrand', price: 120, unit: 'piece', stock: 1000 },
  { itemId: 'EL-012', name: 'Modular Switch 16A', category: 'Switches & Sockets', brand: 'Legrand', price: 180, unit: 'piece', stock: 800 },
  { itemId: 'EL-013', name: 'USB Socket 5V 2.1A', category: 'Switches & Sockets', brand: 'Anchor', price: 320, unit: 'piece', stock: 300 },
  { itemId: 'EL-014', name: '5-Pin Socket 16A', category: 'Switches & Sockets', brand: 'GM', price: 140, unit: 'piece', stock: 600 },

  // Wires & Cables
  { itemId: 'EL-015', name: 'Copper Wire 1.5 sq mm (90m)', category: 'Wires & Cables', brand: 'Finolex', price: 1350, unit: 'roll', stock: 100 },
  { itemId: 'EL-016', name: 'Copper Wire 2.5 sq mm (90m)', category: 'Wires & Cables', brand: 'Finolex', price: 2200, unit: 'roll', stock: 90 },
  { itemId: 'EL-017', name: 'Copper Wire 4 sq mm (90m)', category: 'Wires & Cables', brand: 'Polycab', price: 3400, unit: 'roll', stock: 60 },
  { itemId: 'EL-018', name: 'FRLS Cable 1.5 sq mm (100m)', category: 'Wires & Cables', brand: 'RR Kabel', price: 1800, unit: 'roll', stock: 50 },
  { itemId: 'EL-019', name: 'Flexible Copper Wire 6 sq mm (per metre)', category: 'Wires & Cables', brand: 'Polycab', price: 48, unit: 'metre', stock: 500 },

  // Protection Devices
  { itemId: 'EL-020', name: 'MCB 6A Single Pole', category: 'Protection Devices', brand: 'Schneider', price: 180, unit: 'piece', stock: 200 },
  { itemId: 'EL-021', name: 'MCB 16A Single Pole', category: 'Protection Devices', brand: 'Schneider', price: 200, unit: 'piece', stock: 200 },
  { itemId: 'EL-022', name: 'MCB 32A Double Pole', category: 'Protection Devices', brand: 'ABB', price: 650, unit: 'piece', stock: 100 },
  { itemId: 'EL-023', name: 'RCCB 25A 30mA', category: 'Protection Devices', brand: 'Havells', price: 1200, unit: 'piece', stock: 80 },
  { itemId: 'EL-024', name: 'Distribution Board 8-way', category: 'Protection Devices', brand: 'Legrand', price: 1800, unit: 'piece', stock: 40 },

  // Electrical Accessories
  { itemId: 'EL-025', name: 'PVC Conduit Pipe 25mm (3m)', category: 'Electrical Accessories', brand: 'AKG', price: 65, unit: 'piece', stock: 300 },
  { itemId: 'EL-026', name: 'Junction Box', category: 'Electrical Accessories', brand: 'Anchor', price: 45, unit: 'piece', stock: 400 },
  { itemId: 'EL-027', name: 'Cable Clip (per bag of 100)', category: 'Electrical Accessories', brand: 'Generic', price: 80, unit: 'bag', stock: 200 },
  { itemId: 'EL-028', name: 'Cable Tie 200mm (per bag of 100)', category: 'Electrical Accessories', brand: 'Generic', price: 90, unit: 'bag', stock: 250 },

  // Solar Equipment
  { itemId: 'EL-029', name: 'Solar Panel 100W Monocrystalline', category: 'Solar Equipment', brand: 'Waaree', price: 4500, unit: 'piece', stock: 30 },
  { itemId: 'EL-030', name: 'Solar Inverter 1kVA', category: 'Solar Equipment', brand: 'Luminous', price: 8500, unit: 'piece', stock: 20 },

  // Domestic Appliances
  { itemId: 'EL-031', name: 'Water Heater Geyser 10L', category: 'Domestic Appliances', brand: 'Bajaj', price: 5800, unit: 'piece', stock: 15 },

  // Safety Equipment
  { itemId: 'EL-032', name: 'Earthing Rod 1.5m Copper Bonded', category: 'Safety Equipment', brand: 'Eland', price: 1200, unit: 'piece', stock: 25 },
];

// ── Service functions ──────────────────────────────────────────────────────────

/**
 * Seed the default catalog for a new org. Idempotent — existing items are skipped.
 * Call this from onboarding flow when a new organization is created.
 */
export async function seedForOrg(orgId: mongoose.Types.ObjectId): Promise<void> {
  const docs = DEFAULT_CATALOG.map((item) => ({
    ...item,
    organizationId: orgId,
  }));

  try {
    // insertMany with ordered:false and ignoreErrors continues on duplicate key errors
    await CatalogItemModel.insertMany(docs, { ordered: false });
    logger.info('Catalog seeded for org', {
      orgId: orgId.toString(),
      count: docs.length,
    });
  } catch (err: unknown) {
    // BulkWriteError code 11000 = duplicate key — expected on re-seed
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
      logger.info('Catalog seed: some items already existed, skipped duplicates', { orgId: orgId.toString() });
      return;
    }
    throw err;
  }
}

/**
 * Return all active catalog items for an org, ordered by category then itemId.
 */
export async function findAll(orgId: mongoose.Types.ObjectId): Promise<ICatalogItem[]> {
  return CatalogItemModel
    .find({ organizationId: orgId, isActive: true })
    .sort({ category: 1, itemId: 1 });
}

/**
 * Return items in a specific category.
 */
export async function findByCategory(
  orgId: mongoose.Types.ObjectId,
  category: string,
): Promise<ICatalogItem[]> {
  return CatalogItemModel
    .find({ organizationId: orgId, category, isActive: true })
    .sort({ itemId: 1 });
}

/**
 * Look up a single item by catalog ID (e.g. 'EL-001').
 */
export async function findByItemId(
  orgId: mongoose.Types.ObjectId,
  itemId: string,
): Promise<ICatalogItem | null> {
  return CatalogItemModel.findOne({ organizationId: orgId, itemId: itemId.toUpperCase() });
}

/**
 * Create a new catalog item.
 */
export async function createItem(
  orgId: mongoose.Types.ObjectId,
  data: Omit<SeedItem, 'itemId'> & { itemId?: string },
): Promise<ICatalogItem> {
  // Auto-generate next itemId if not provided
  let itemId = data.itemId?.toUpperCase();
  if (!itemId) {
    const count = await CatalogItemModel.countDocuments({ organizationId: orgId });
    itemId = `EL-${String(count + 1).padStart(3, '0')}`;
  }
  const item = new CatalogItemModel({ ...data, itemId, organizationId: orgId });
  return item.save();
}

/**
 * Update an existing catalog item by itemId. Returns the updated document.
 */
export async function updateItem(
  orgId: mongoose.Types.ObjectId,
  itemId: string,
  updates: Partial<Pick<ICatalogItem, 'name' | 'category' | 'brand' | 'price' | 'unit' | 'stock' | 'isActive'>>,
): Promise<ICatalogItem | null> {
  return CatalogItemModel.findOneAndUpdate(
    { organizationId: orgId, itemId: itemId.toUpperCase() },
    { $set: updates },
    { new: true },
  );
}

/**
 * Soft-delete an item by setting isActive: false.
 */
export async function deactivateItem(
  orgId: mongoose.Types.ObjectId,
  itemId: string,
): Promise<ICatalogItem | null> {
  return updateItem(orgId, itemId, { isActive: false });
}

/**
 * Format catalog as a compact markdown table for injection into system prompts.
 * Keeps lines short enough to stay within the 75-word response budget.
 */
export function formatCatalogForPrompt(items: ICatalogItem[]): string {
  if (items.length === 0) return '';

  const header = '| ID | Product | Category | Brand | Price (₹) | Unit | Stock |';
  const divider = '|---|---|---|---|---|---|---|';

  const rows = items.map((item) =>
    `| ${item.itemId} | ${item.name} | ${item.category} | ${item.brand ?? '—'} | ${item.price} | ${item.unit} | ${item.stock > 0 ? item.stock : 'Out of stock'} |`,
  );

  return `## Product Catalog\n\n${header}\n${divider}\n${rows.join('\n')}`;
}

/**
 * Returns the critical order safety rules string that must be appended to
 * every electrical-shop agent's system prompt to prevent price hallucination,
 * quantity assumption, and address autocomplete bugs.
 */
export function getOrderSafetyRules(): string {
  return `
## Order Safety Rules (MANDATORY — NEVER violate these)

1. **Never confirm an order without tool success**: Only say "your order is confirmed" AFTER the submit_order tool returns { success: true }. Never confirm verbally first.
2. **Confirm product and quantity before address**: Read back "You want [X] units of [product name]?" and wait for a "yes" before asking for delivery address.
3. **Price from catalog only**: Copy the unit price from the catalog above. Never calculate, estimate, or invent a price. If the item is not in the catalog, say you'll need to check and offer a callback.
4. **Verify total aloud before submitting**: Say "Total comes to ₹[quantity × unit price]. Is that correct?" and wait for confirmation before calling submit_order.
5. **Never suggest a pincode or address**: Ask the caller for their full delivery address. If the caller gives an incomplete address, ask specifically for the missing part (e.g., "Could you also share your 6-digit pincode?").
6. **Read pincode back digit by digit**: After the caller gives the pincode, read it back digit by digit ("The pincode is 4-0-0-0-5-1 — is that correct?") and wait for confirmation before submitting.
`;
}
