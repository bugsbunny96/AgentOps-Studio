/**
 * Check what's in Atlas across all key collections.
 * Run: npx tsx scripts/check-atlas-state.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI ?? '';
if (!MONGO_URI) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const collections = ['users', 'organizations', 'memberships', 'voiceagents', 'orders', 'catalogitems', 'kbdocuments'];

  console.log('\n📊  Atlas DB state:\n');
  for (const col of collections) {
    const count = await db.collection(col).countDocuments();
    const sample = count > 0 ? await db.collection(col).findOne({}, { projection: { _id: 1, email: 1, name: 1, vapiAssistantId: 1, orderId: 1 } }) : null;
    console.log(`  ${col.padEnd(16)} ${count} docs ${sample ? `→ sample _id: ${sample._id}` : ''}`);
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
