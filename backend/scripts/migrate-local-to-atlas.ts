/**
 * One-shot migration: copy all data from local MongoDB → Atlas,
 * and fix vapiAssistantId to the correct Vapi assistant in the process.
 *
 * Run: npx tsx scripts/migrate-local-to-atlas.ts
 *
 * Safe to re-run: uses insertMany with ordered:false so duplicates are skipped.
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const LOCAL_URI  = 'mongodb://localhost:27017/agentops_studio';
const ATLAS_URI  = process.env.MONGODB_URI ?? '';
const CORRECT_VAPI_ASSISTANT_ID = '100b3bd9-5038-4f11-b487-7ced98d8a3dd';

if (!ATLAS_URI || !ATLAS_URI.includes('mongodb+srv')) {
  console.error('❌  MONGODB_URI in .env does not look like an Atlas URI. Aborting.');
  process.exit(1);
}

const COLLECTIONS = [
  'users',
  'organizations',
  'memberships',
  'voiceagents',
  'catalogitems',
  'kbdocuments',
  'orders',
];

async function run() {
  // Connect local
  const localConn  = await mongoose.createConnection(LOCAL_URI).asPromise();
  console.log('✅  Connected to local MongoDB');

  // Connect Atlas
  const atlasConn  = await mongoose.createConnection(ATLAS_URI).asPromise();
  console.log('✅  Connected to Atlas\n');

  const localDb = localConn.db!;
  const atlasDb = atlasConn.db!;

  for (const col of COLLECTIONS) {
    const docs = await localDb.collection(col).find({}).toArray();

    if (docs.length === 0) {
      console.log(`  ${col.padEnd(16)} 0 docs — skipping`);
      continue;
    }

    // Fix vapiAssistantId on org + agent docs
    const patched = docs.map(doc => {
      if ((col === 'organizations' || col === 'voiceagents') && doc.vapiAssistantId) {
        return { ...doc, vapiAssistantId: CORRECT_VAPI_ASSISTANT_ID };
      }
      return doc;
    });

    try {
      const result = await atlasDb.collection(col).insertMany(patched, { ordered: false });
      console.log(`  ${col.padEnd(16)} ${result.insertedCount}/${docs.length} inserted`);
    } catch (err: unknown) {
      // BulkWriteError — some docs already exist (duplicate _id), others inserted
      const bwe = err as { insertedCount?: number; code?: number; message?: string };
      if (bwe.code === 11000) {
        console.log(`  ${col.padEnd(16)} ${bwe.insertedCount ?? '?'}/${docs.length} inserted (some already existed)`);
      } else {
        console.error(`  ${col.padEnd(16)} ❌  ${bwe.message}`);
      }
    }
  }

  // Verify
  console.log('\n📊  Atlas after migration:');
  for (const col of COLLECTIONS) {
    const count = await atlasDb.collection(col).countDocuments();
    console.log(`  ${col.padEnd(16)} ${count} docs`);
  }

  // Confirm vapiAssistantId
  const org   = await atlasDb.collection('organizations').findOne({});
  const agent = await atlasDb.collection('voiceagents').findOne({});
  console.log('\n🔗  vapiAssistantId check:');
  console.log(`  Organization:  ${org?.vapiAssistantId ?? '(not set)'}`);
  console.log(`  VoiceAgent:    ${agent?.vapiAssistantId ?? '(not set)'}`);

  await localConn.close();
  await atlasConn.close();
  console.log('\n✅  Migration complete.');
}

run().catch(err => {
  console.error('❌  Migration failed:', err.message);
  process.exit(1);
});
