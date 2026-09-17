/**
 * One-shot migration: point the org + VoiceAgent records to the correct
 * Vapi assistant that is actually receiving calls.
 *
 * Run from the backend directory:
 *   npx tsx scripts/fix-vapi-assistant-id.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const CORRECT_VAPI_ASSISTANT_ID = '100b3bd9-5038-4f11-b487-7ced98d8a3dd';
const MONGO_URI = process.env.MONGODB_URI ?? '';

if (!MONGO_URI) {
  console.error('❌  MONGODB_URI not set in .env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  const db = mongoose.connection.db!;

  // ── Update Organization ───────────────────────────────────────────────────
  const orgBefore = await db.collection('organizations').findOne({});
  console.log('📋  Org before:', {
    id: orgBefore?._id?.toString(),
    vapiAssistantId: orgBefore?.vapiAssistantId ?? '(not set)',
  });

  await db.collection('organizations').updateOne(
    { _id: orgBefore!._id },
    { $set: { vapiAssistantId: CORRECT_VAPI_ASSISTANT_ID } },
  );

  const orgAfter = await db.collection('organizations').findOne({ _id: orgBefore!._id });
  console.log('✅  Org after:', {
    id: orgAfter?._id?.toString(),
    vapiAssistantId: orgAfter?.vapiAssistantId,
  });

  // ── Update VoiceAgent ─────────────────────────────────────────────────────
  const agentBefore = await db.collection('voiceagents').findOne({});
  console.log('📋  VoiceAgent before:', {
    id: agentBefore?._id?.toString(),
    vapiAssistantId: agentBefore?.vapiAssistantId ?? '(not set)',
  });

  if (agentBefore) {
    await db.collection('voiceagents').updateOne(
      { _id: agentBefore._id },
      { $set: { vapiAssistantId: CORRECT_VAPI_ASSISTANT_ID } },
    );

    const agentAfter = await db.collection('voiceagents').findOne({ _id: agentBefore._id });
    console.log('✅  VoiceAgent after:', {
      id: agentAfter?._id?.toString(),
      vapiAssistantId: agentAfter?.vapiAssistantId,
    });
  } else {
    console.warn('⚠️   No VoiceAgent document found — skipping');
  }

  await mongoose.disconnect();
  console.log('\n✅  Done. Both records now point to:', CORRECT_VAPI_ASSISTANT_ID);
}

run().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
