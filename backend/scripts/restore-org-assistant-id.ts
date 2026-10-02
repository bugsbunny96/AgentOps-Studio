/**
 * Restore an org's vapiAssistantId after the submit_order single-org fallback
 * overwrote it (2026-10-02 11:10 UTC: set to "asst_does_not_exist").
 *
 * Source of truth: the org's VoiceAgent document (the fallback never touches it),
 * or --assistant <id> to set it explicitly. Dry run by default.
 *
 *   npx tsx scripts/restore-org-assistant-id.ts                 # show what would change
 *   npx tsx scripts/restore-org-assistant-id.ts --apply         # write it
 *   npx tsx scripts/restore-org-assistant-id.ts --org <id> --assistant <id> --apply
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const ORG_ID = flag('org') ?? '6a3e61c486e40de590633892';
const BAD_ID = 'asst_does_not_exist';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const orgId = new mongoose.Types.ObjectId(ORG_ID);

  const org = await db.collection('organizations').findOne({ _id: orgId }, { projection: { name: 1, vapiAssistantId: 1 } });
  if (!org) throw new Error(`Org ${ORG_ID} not found`);

  const agents = await db.collection('voiceagents')
    .find({ organizationId: orgId }, { projection: { name: 1, vapiAssistantId: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray();

  const fromAgent = agents.find((a) => a.vapiAssistantId && a.vapiAssistantId !== BAD_ID)?.vapiAssistantId as string | undefined;
  const target = flag('assistant') ?? fromAgent;

  console.log('Org:          ', org.name, ORG_ID);
  console.log('Current:      ', org.vapiAssistantId ?? '(not set)');
  console.log('VoiceAgents:  ', agents.map((a) => `${a.name ?? '?'} → ${a.vapiAssistantId ?? '(none)'}`).join(' | ') || '(none)');
  console.log('Will set to:  ', target ?? '(nothing found — pass --assistant <id>)');

  if (!target) { await mongoose.disconnect(); process.exit(1); }
  if (org.vapiAssistantId === target) { console.log('\n✅ Already correct — nothing to do.'); await mongoose.disconnect(); return; }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.');
  } else {
    await db.collection('organizations').updateOne({ _id: orgId }, { $set: { vapiAssistantId: target } });
    const after = await db.collection('organizations').findOne({ _id: orgId }, { projection: { vapiAssistantId: 1 } });
    console.log('\n✅ Updated. vapiAssistantId is now', after?.vapiAssistantId);
  }
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
