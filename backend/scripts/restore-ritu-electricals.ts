/**
 * Restore the Vapi assistant to the v12 working state:
 *   - Name: "Ritu Electricals Receptionist"
 *   - Voice: vapi/Naina/v2/auto  (~400ms latency)
 *   - System prompt: v12's proven prompt (no KB injection — KB is contaminated with Godrej Packers data)
 *   - Tools: restored from v12 toolIds
 *   - Temperature: 0.3
 *
 * Run: npx tsx scripts/restore-ritu-electricals.ts
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { connectDatabase } from '../src/config/database';
import { OrganizationModel } from '../src/modules/organization/organization.model';
import { VoiceAgentModel } from '../src/modules/agents/agent.model';
import { vapiUpdateAssistant } from '../src/modules/agents/vapi.service';

const VAPI_ASSISTANT_ID = '100b3bd9-5038-4f11-b487-7ced98d8a3dd';

// Tool IDs from v12 — submit_order + end_receptionist_call
const V12_TOOL_IDS = [
  'da4b97b9-eb2f-49f1-8e94-e7fc323ce384',
  'a30de8d9-8511-4c17-a854-4dcb6a7c1591',
];

// Load the v12 system prompt directly from the saved JSON
// (KB is contaminated with Godrej Packers scrapes — do NOT use generateSystemPrompt until KB is cleaned)
function loadV12SystemPrompt(): string {
  const v12Path = path.resolve(__dirname, '../../main-project-docs/Vapi-Call-Logs/assistant-v12-2026-09-16.json');
  const raw = JSON.parse(fs.readFileSync(v12Path, 'utf8'));
  const msgs: Array<{ role: string; content: string }> = raw.assistant.model.messages;
  const sys = msgs.find(m => m.role === 'system');
  if (!sys) throw new Error('No system message in v12 JSON');
  return sys.content;
}

async function run() {
  await connectDatabase();
  console.log('✅  Connected to Atlas\n');

  // ── 1. Update org ──────────────────────────────────────────────────────────
  const org = await OrganizationModel.findOne({});
  if (!org) throw new Error('No org found');

  const prevName = org.name;
  await OrganizationModel.findByIdAndUpdate(org._id, {
    $set: {
      name:      'Ritu Electricals',
      agentName: 'Ritu',
    },
  });
  console.log(`✅  Org: "${prevName}" → "Ritu Electricals", agentName → "Ritu"`);

  // ── 2. Update VoiceAgent ───────────────────────────────────────────────────
  const agent = await VoiceAgentModel.findOne({ organizationId: org._id });
  if (!agent) throw new Error('No VoiceAgent found');

  await VoiceAgentModel.findByIdAndUpdate(agent._id, {
    $set: {
      name:          'Ritu',
      voiceProvider: 'vapi',
      voiceId:       'Naina',
      voiceVersion:  '2',
      language:      'auto',
    },
  });
  console.log('✅  VoiceAgent: voice → vapi/Naina/v2/auto');

  // ── 3. Load v12 system prompt ──────────────────────────────────────────────
  const systemPrompt = loadV12SystemPrompt();
  console.log(`✅  System prompt loaded from v12 (${systemPrompt.length} chars)`);
  console.log('   ⚠️  Using v12 prompt directly — KB is contaminated with Godrej Packers data');
  console.log('      Clean kbdocuments in Atlas before re-enabling auto-generation');

  // ── 4. Push to Vapi ────────────────────────────────────────────────────────
  console.log('\n🔄  Pushing to Vapi...');
  await vapiUpdateAssistant(VAPI_ASSISTANT_ID, {
    name: 'Ritu Electricals Receptionist',
    model: {
      provider:    'openai',
      model:       'gpt-4o',
      temperature: 0.3,
      toolIds:     V12_TOOL_IDS,
      messages:    [{ role: 'system', content: systemPrompt }],
    },
    voice: {
      provider: 'vapi',
      voiceId:  'Naina',
      version:  '2',
      language: 'auto',
    },
    firstMessage:  'नमस्ते, ऋतु इलेक्ट्रिकल्स में आपका स्वागत है। मैं आपकी कैसे मदद कर सकती हूँ?',
    endCallMessage: 'Dhanyavaad, Ritu Electricals se baat karne ke liye. Aapka din shubh ho!',
  });

  console.log('\n✅  Vapi assistant restored:');
  console.log('   Name:        Ritu Electricals Receptionist');
  console.log('   Voice:       vapi/Naina/v2/auto');
  console.log('   Temperature: 0.3');
  console.log('   Tools:       submit_order + end_receptionist_call (v12 toolIds)');
  console.log('   Prompt:      v12 (16k chars, catalog + full order flow)');

  // ── 5. Save system prompt to VoiceAgent ───────────────────────────────────
  await VoiceAgentModel.findByIdAndUpdate(agent._id, { $set: { systemPrompt } });
  console.log('✅  VoiceAgent.systemPrompt updated in Atlas');

  await mongoose.disconnect();
  console.log('\n✅  Done. Make a test call — should sound like the previous good call.');
  console.log('\n⏭️  NEXT: clean kbdocuments in Atlas to fix KB contamination (Issue #2)');
}

run().catch(err => {
  console.error('❌  Failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
