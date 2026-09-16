/**
 * Seed the catalog for the existing org in Atlas.
 * Uses the same 32-item default seed from catalog.service.ts.
 *
 * Run: npx tsx scripts/seed-catalog.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import { connectDatabase } from '../src/config/database';
import { OrganizationModel } from '../src/modules/organization/organization.model';
import { seedForOrg } from '../src/modules/catalog/catalog.service';
import { CatalogItemModel } from '../src/modules/catalog/catalog.model';

async function run() {
  await connectDatabase();
  console.log('✅  Connected to Atlas\n');

  const org = await OrganizationModel.findOne({});
  if (!org) {
    console.error('❌  No organization found in Atlas. Run migrate-local-to-atlas.ts first.');
    process.exit(1);
  }
  console.log('🏢  Organization:', org.name ?? org._id.toString());

  await seedForOrg(org._id as mongoose.Types.ObjectId);

  const count = await CatalogItemModel.countDocuments({ organizationId: org._id });
  console.log(`✅  Catalog seeded: ${count} items in Atlas`);

  const items = await CatalogItemModel.find({ organizationId: org._id }).select('itemId name price').limit(5);
  console.log('\n📦  Sample items:');
  items.forEach(i => console.log(`  ${i.itemId}  ${i.name.padEnd(35)} ₹${i.price}`));
  console.log('  ... (and more)\n');

  await mongoose.disconnect();
  console.log('✅  Done. Now go to Agent Details → Edit identity → Save to push updated prices to Vapi.');
}

run().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
