/**
 * Inspect kbdocuments in Atlas — show title, source, and first 400 chars of content.
 * Run: npx tsx scripts/inspect-kb-docs.ts
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();
import { connectDatabase } from '../src/config/database';

async function run() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const docs = await db.collection('kbdocuments').find({}).toArray();
  console.log(`Total KB docs: ${docs.length}\n`);
  docs.forEach((d: any, i: number) => {
    const content = d.content || d.text || d.extractedText || d.rawText || '';
    const source  = d.sourceUrl || d.url || d.filename || d.source || '(no source)';
    console.log(`--- [${i + 1}] "${d.title || d.name || d._id}" ---`);
    console.log(`  Source:  ${source}`);
    console.log(`  Content: ${content.substring(0, 400).replace(/\n/g, ' ')}`);
    console.log();
  });
  await mongoose.disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
