/**
 * update-vapi-assistant.mjs
 * ─────────────────────────
 * Reads electrical-shop-optimized.md, extracts:
 *   - "# First Message" → sent as Vapi `firstMessage`
 *   - "# System Prompt" → sent as Vapi `model.messages[0].content`
 *
 * Then PATCHes the Vapi assistant directly.
 *
 * Usage (from project root):
 *   node scripts/update-vapi-assistant.mjs
 *
 * Requires: VAPI_API_KEY in backend/.env  (loaded automatically)
 */

import fs   from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Load VAPI_API_KEY from backend/.env ─────────────────────────────────────
function loadEnv(envPath) {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnv(path.join(ROOT, 'backend/.env'));

const VAPI_API_KEY   = process.env.VAPI_API_KEY;
const ASSISTANT_ID   = '46c7cddf-60fe-42cd-9318-8bfa9148d223';
const PROMPT_FILE    = path.join(ROOT, 'main-project-docs/SamplePrompt/electrical-shop-optimized.md');

if (!VAPI_API_KEY) {
  console.error('❌  VAPI_API_KEY not found in backend/.env');
  process.exit(1);
}

// ── Parse the markdown file ──────────────────────────────────────────────────
const content = fs.readFileSync(PROMPT_FILE, 'utf8');
const lines   = content.split('\n');

let firstMessage    = '';
let systemPromptLines = [];
let section         = null;

for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (trimmed === '# First Message') { section = 'first'; continue; }
  if (trimmed === '# System Prompt') { section = 'system'; continue; }

  if (section === 'first' && !firstMessage && trimmed) {
    firstMessage = trimmed;
    section = null; // only take the first non-empty line
    continue;
  }
  if (section === 'system') {
    systemPromptLines.push(lines[i]);
  }
}

const systemPrompt = systemPromptLines.join('\n').trim();

if (!firstMessage) {
  console.error('❌  Could not find "# First Message" section in the file.');
  process.exit(1);
}
if (!systemPrompt) {
  console.error('❌  Could not find "# System Prompt" section in the file.');
  process.exit(1);
}

console.log('✅  First message  :', firstMessage.slice(0, 80) + (firstMessage.length > 80 ? '…' : ''));
console.log('✅  System prompt  :', systemPrompt.length, 'chars');

// ── Helper: make a Vapi HTTPS request ────────────────────────────────────────
function vapiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: 'api.vapi.ai',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type':  'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload, 'utf8') } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload, 'utf8');
    req.end();
  });
}

// ── Step 1: GET current assistant to read model.provider ─────────────────────
console.log('🔍  Fetching current assistant config…');
const getRes = await vapiRequest('GET', `/assistant/${ASSISTANT_ID}`);
if (getRes.status !== 200) {
  console.error('❌  Could not fetch assistant:', getRes.status, getRes.body);
  process.exit(1);
}
const current      = JSON.parse(getRes.body);
const currentModel = current?.model ?? {};
const provider     = currentModel.provider;
const modelName    = currentModel.model;

if (!provider || !modelName) {
  console.error('❌  Could not determine model.provider / model.model from current config.');
  console.error('    Raw model:', JSON.stringify(currentModel, null, 2));
  process.exit(1);
}
console.log('✅  Current model.provider:', provider);
console.log('✅  Current model.model   :', modelName);
console.log('🔄  Patching assistant', ASSISTANT_ID, '…\n');

// ── Step 2: PATCH — carry forward all existing model fields, only replace messages ─
const patchRes = await vapiRequest('PATCH', `/assistant/${ASSISTANT_ID}`, {
  firstMessage,
  model: {
    ...currentModel,                                    // preserve temperature, tools, etc.
    messages: [{ role: 'system', content: systemPrompt }],
  },
});

if (patchRes.status >= 200 && patchRes.status < 300) {
  const data = JSON.parse(patchRes.body);
  console.log('✅  Assistant updated successfully!');
  console.log('    ID   :', data.id);
  console.log('    Name :', data.name);
} else {
  console.error('❌  Vapi returned', patchRes.status);
  try { console.error(JSON.parse(patchRes.body)); } catch { console.error(patchRes.body); }
  process.exit(1);
}
