/**
 * Switch the LLM on existing Vapi assistants WITHOUT touching their prompt or tools.
 *
 * Vapi PATCH replaces the whole `model` object, so this script GETs each
 * assistant, keeps its messages / toolIds / tools / temperature / maxTokens, and
 * swaps only `provider` + `model`. Safe for hand-written prompts such as the
 * live Ritu Electricals assistant (which generateSystemPrompt must not overwrite).
 *
 * Dry run by default — prints the before/after and changes nothing.
 *
 * Usage (from backend/):
 *   npx tsx scripts/set-assistant-model.ts --assistant <vapiAssistantId>              # dry run, model = LLM_MODEL
 *   npx tsx scripts/set-assistant-model.ts --assistant <id> --model gpt-4.1-mini --apply
 *   npx tsx scripts/set-assistant-model.ts --all --apply                             # every org in MongoDB
 *   npx tsx scripts/set-assistant-model.ts --assistant <id> --model gpt-4o --apply   # roll back
 *
 * Run the eval suite on the new model first:
 *   node ../scripts/vapi-evals/local-evals.mjs --provider openai --model gpt-4o-mini --judge-model gpt-4o --repeat 3
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import { LLM_MODELS, DEFAULT_LLM_MODEL, type LlmModelId } from '../src/config/llm';

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith('--') ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const ALL   = args.includes('--all');

const modelId = (opt('model') ?? process.env.LLM_MODEL ?? DEFAULT_LLM_MODEL) as LlmModelId;
const target  = LLM_MODELS[modelId];
if (!target) {
  console.error(`❌  Unknown --model "${modelId}". Choose one of: ${Object.keys(LLM_MODELS).join(', ')}`);
  process.exit(1);
}

const VAPI_KEY = process.env.VAPI_API_KEY;
if (!VAPI_KEY) {
  console.error('❌  VAPI_API_KEY not set in backend/.env');
  process.exit(1);
}

async function vapi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: { Authorization: `Bearer ${VAPI_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error(`Vapi ${resp.status} ${method} ${path}: ${(await resp.text()).slice(0, 300)}`);
  return resp.json() as Promise<T>;
}

async function assistantIds(): Promise<string[]> {
  const one = opt('assistant');
  if (one) return [one];
  if (!ALL) {
    console.error('❌  Pass --assistant <id> or --all');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGODB_URI not set (needed for --all)');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const orgs = await mongoose.connection.db!
    .collection('organizations')
    .find({ vapiAssistantId: { $exists: true, $ne: null } }, { projection: { vapiAssistantId: 1, name: 1 } })
    .toArray();
  await mongoose.disconnect();
  return orgs.map((o) => String(o.vapiAssistantId));
}

async function run() {
  const ids = await assistantIds();
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — target ${target.provider}/${target.model} on ${ids.length} assistant(s)\n`);

  for (const id of ids) {
    const current = await vapi<{ name?: string; model?: Record<string, unknown> }>('GET', `/assistant/${id}`);
    const model = current.model ?? {};
    const before = `${model.provider}/${model.model}`;
    const after  = `${target.provider}/${target.model}`;
    if (before === after) {
      console.log(`= ${id} (${current.name}) already on ${after}`);
      continue;
    }
    console.log(`→ ${id} (${current.name}): ${before} → ${after}`);
    if (APPLY) {
      await vapi('PATCH', `/assistant/${id}`, {
        model: { ...model, provider: target.provider, model: target.model },
      });
      console.log('  ✅ updated');
    }
  }
  if (!APPLY) console.log('\nNothing changed. Re-run with --apply to update.');
}

run().catch((err) => {
  console.error('❌ ', err instanceof Error ? err.message : err);
  process.exit(1);
});
