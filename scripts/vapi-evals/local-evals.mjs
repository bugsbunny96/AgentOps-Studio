/**
 * local-evals.mjs — run the Vapi eval suite (./evals.mjs) locally against OpenAI
 * ─────────────────────────────────────────────────────────────────────────────
 * Vapi evals are text-only chats. This runner reproduces them without Vapi's queue:
 *   1. Pulls the assistant's LIVE config from Vapi (system prompt, model, temperature, tools).
 *   2. Replays each eval's mock conversation through OpenAI Chat Completions.
 *   3. Judges every evaluated assistant turn the way Vapi does:
 *        regex  → pattern tested against the reply text
 *        tool   → reply must call the named tool
 *        ai     → judge prompt with {{messages}} / {{messages[-1]}} filled in, answers pass|fail
 *
 * Results are close to Vapi's but not identical (Vapi adds its own runtime settings).
 * Nothing is sent to your backend: tool calls are never executed; tool results come from the eval.
 *
 * Providers (--provider; default gemini when GEMINI_API_KEY is set, else openai):
 *   gemini → Google Gemini via its OpenAI-compatible endpoint (free tier). Add GEMINI_API_KEY to backend/.env
 *            (free key: https://aistudio.google.com/apikey). Picks the newest gemini-*-flash model; paced to ~8 req/min.
 *   openai → OpenAI, using the assistant's own model (gpt-4o). Needs API credit.
 *   custom → any OpenAI-compatible API via EVAL_LLM_BASE_URL + EVAL_LLM_API_KEY (+ --model / --judge-model).
 * With Gemini the evals test Gemini's behaviour on Ritu's prompt, not GPT-4o's: use it to catch prompt/flow
 * problems, and confirm important failures on GPT-4o or with a real call.
 *
 * Usage (from project root; reads keys + VAPI_API_KEY from backend/.env):
 *   node scripts/vapi-evals/local-evals.mjs                      # all 23 evals
 *   node scripts/vapi-evals/local-evals.mjs --only price         # by tag or name fragment
 *   node scripts/vapi-evals/local-evals.mjs --repeat 3           # run each eval 3× (flakiness check)
 *   node scripts/vapi-evals/local-evals.mjs --verbose            # print every transcript
 * Options: --provider gemini|openai|custom  --model <m>  --judge-model <m>  --rpm <n>  --assistant <id>  --concurrency <n>
 *          --offline  (reuse results/assistant-snapshot.json instead of fetching from Vapi)
 * Other OpenAI-compatible providers: set EVAL_LLM_BASE_URL + EVAL_LLM_API_KEY (and pass --model / --judge-model).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { EVALS } from './evals.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RESULTS = path.join(__dirname, 'results');
const SNAPSHOT = path.join(RESULTS, 'assistant-snapshot.json');

// ── env + args ────────────────────────────────────────────────────────────────
const envPath = path.join(ROOT, 'backend/.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const flag = (n) => args.includes(`--${n}`);
const ASSISTANT_ID = opt('assistant', process.env.VAPI_EVAL_ASSISTANT_ID || '100b3bd9-5038-4f11-b487-7ced98d8a3dd');
const ONLY = opt('only', '').toLowerCase();
const REPEAT = Math.max(1, Number(opt('repeat', 1)));
const VERBOSE = flag('verbose');
const PROVIDER = opt('provider', process.env.EVAL_PROVIDER
  || (process.env.EVAL_LLM_BASE_URL ? 'custom' : process.env.GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();
const PROVIDERS = {
  openai: { base: 'https://api.openai.com/v1', key: process.env.OPENAI_API_KEY, keyName: 'OPENAI_API_KEY', rpm: 60, conc: 4 },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta/openai', key: process.env.GEMINI_API_KEY, keyName: 'GEMINI_API_KEY', rpm: 8, conc: 1 },
  custom: { base: process.env.EVAL_LLM_BASE_URL, key: process.env.EVAL_LLM_API_KEY, keyName: 'EVAL_LLM_API_KEY', rpm: 30, conc: 2 },
};
const P = PROVIDERS[PROVIDER];
if (!P) { console.error(`❌ Unknown --provider ${PROVIDER} (use gemini, openai or custom)`); process.exit(1); }
if (!P.base) { console.error('❌ --provider custom needs EVAL_LLM_BASE_URL in backend/.env'); process.exit(1); }
if (!P.key) {
  console.error(`❌ ${P.keyName} is missing in backend/.env.` +
    (PROVIDER === 'gemini' ? '\n   Get a free key at https://aistudio.google.com/apikey, then add this line to backend/.env:\n   GEMINI_API_KEY=your-key' : ''));
  process.exit(1);
}
const CONCURRENCY = Math.max(1, Number(opt('concurrency', P.conc)));
const RPM = Math.max(1, Number(opt('rpm', P.rpm)));


// ── http helpers ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function http(url, { method = 'GET', headers = {}, body } = {}, tries = 6) {
  for (let a = 1; ; a++) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : null;
    if (/insufficient_quota|credit_balance_exhausted|invalid_api_key|API_KEY_INVALID|PERMISSION_DENIED|PerDay|per day/i.test(text)) {
      const err = new Error(text.match(/"message":\s*"([^"]+)"/)?.[1] ?? text.slice(0, 300));
      err.hard = true; err.daily = /PerDay|per day/i.test(text); err.status = res.status; err.host = url;
      throw err;
    }
    if (/insufficient_quota|credit_balance_exhausted/.test(text)) {
      console.error(`\n❌ The OpenAI account behind OPENAI_API_KEY has no credits left.\n   Add credits at https://platform.openai.com/settings/organization/billing and run again.`);
      process.exit(2);
    }
    if ((res.status === 429 || res.status >= 500) && a < (res.status === 503 ? Math.min(tries, 3) : tries)) {
      const hinted = Number(text.match(/retry(?:Delay| in)[^0-9]{0,6}([0-9.]+)\s*s/i)?.[1]);
      const wait = Number.isFinite(hinted) && hinted > 0 ? hinted * 1000 + 500 : 4000 * a;
      if (VERBOSE) console.log(`   … ${res.status}, retrying in ${Math.round(wait / 1000)}s`);
      await sleep(wait); continue;
    }
    const err = new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
}
const vapi = (p) => http(`https://api.vapi.ai${p}`, { headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` } });
const LLM_BASE = P.base.replace(/\/$/, '');
let nextSlot = 0; // client-side pacing to stay under the provider's requests/minute
function fatal(err, model) {
  const who = err.host?.includes('openai.com') ? 'OpenAI' : err.host?.includes('googleapis') ? 'Gemini' : 'API';
  console.error(`\n❌ ${who} refused the request${model ? ` for ${model}` : ''}: ${err.message.split('\\n')[0]}`);
  if (err.daily && who === 'Gemini') {
    console.error('   This is the free tier\'s DAILY request limit for this model. It resets at midnight Pacific time (12:30 pm IST).');
    console.error('   Options: run without --model to spread across other Gemini models, enable billing on the Google AI Studio project, or use --provider openai.');
  } else console.error('   Nothing more was evaluated. Fix the key/billing and re-run.');
  process.exit(2);
}
const FALLBACKS = []; // other models to try when the current one is overloaded (Gemini only)
const swapped = new Map(); // failed model → replacement
async function openai(body) {
  for (;;) {
    while (swapped.has(body.model)) body = { ...body, model: swapped.get(body.model) };
    const gap = 60_000 / RPM, now = Date.now(), at = Math.max(now, nextSlot);
    nextSlot = at + gap;
    if (at > now) await sleep(at - now);
    try {
      return await http(`${LLM_BASE}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${P.key}` }, body });
    } catch (err) {
      if (err.hard && !(err.daily && FALLBACKS.length)) fatal(err, body.model);
      if (!err.hard && (![503, 500, 404].includes(err.status) || !FALLBACKS.length)) throw err;
      if (!swapped.has(body.model)) {
        const next = FALLBACKS.shift();
        swapped.set(body.model, next);
        console.log(`   ↪ ${body.model} is ${err.daily ? 'out of free daily quota' : `unavailable (${err.status})`}; switching to ${next}`);
      }
    }
  }
}

/** Gemini accepts only a subset of JSON Schema in tool parameters — drop keywords it rejects. */
const SCHEMA_KEYS = new Set(['type', 'properties', 'required', 'description', 'enum', 'items', 'nullable', 'minimum', 'maximum', 'minItems', 'maxItems']);
function cleanSchema(x) {
  if (Array.isArray(x)) return x.map(cleanSchema);
  if (!x || typeof x !== 'object') return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === 'properties') o[k] = Object.fromEntries(Object.entries(v ?? {}).map(([pk, pv]) => [pk, cleanSchema(pv)]));
    else if (SCHEMA_KEYS.has(k)) o[k] = cleanSchema(v);
  }
  return o;
}
const prepTools = (tools) => (PROVIDER === 'gemini'
  ? tools.map((t) => ({ ...t, function: { ...t.function, parameters: cleanSchema(t.function.parameters) } }))
  : tools);

async function pickGeminiModel() {
  const r = await http(`${LLM_BASE}/models`, { headers: { Authorization: `Bearer ${P.key}` } });
  const ids = (r?.data ?? []).map((m) => String(m.id).replace(/^models\//, ''));
  const ver = (id) => Number(id.match(/gemini-([\d.]+)/)?.[1] ?? 0);
  const byVer = (a, b) => ver(b) - ver(a);
  const flash = ids.filter((id) => /^gemini-[\d.]+-flash$/.test(id)).sort(byVer);
  const lite = ids.filter((id) => /^gemini-[\d.]+-flash-lite$/.test(id)).sort(byVer);
  const order = [...flash, ...lite];
  if (!order[0]) throw new Error(`no gemini-*-flash model available to this key; models seen: ${ids.slice(0, 15).join(', ')}`);
  FALLBACKS.push(...order.slice(1));
  return order[0];
}

// ── assistant config from Vapi ────────────────────────────────────────────────
function toOpenAITool(t) {
  if (t?.function?.name) {
    return { type: 'function', function: { name: t.function.name, description: t.function.description ?? '', parameters: t.function.parameters ?? { type: 'object', properties: {} } } };
  }
  const builtin = { endCall: 'end_call', transferCall: 'transfer_call' }[t?.type];
  if (builtin) return { type: 'function', function: { name: builtin, description: `Vapi built-in ${t.type}`, parameters: { type: 'object', properties: {} } } };
  return null;
}

async function loadAssistant() {
  if (flag('offline')) {
    if (!fs.existsSync(SNAPSHOT)) throw new Error('No snapshot yet — run once without --offline.');
    return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  }
  if (!process.env.VAPI_API_KEY) throw new Error('VAPI_API_KEY missing (or use --offline)');
  const a = await vapi(`/assistant/${ASSISTANT_ID}`);
  const m = a.model ?? {};
  const system = (m.messages ?? []).filter((x) => x.role === 'system').map((x) => x.content).join('\n\n');
  const raw = [...(m.tools ?? [])];
  for (const id of m.toolIds ?? []) {
    try { raw.push(await vapi(`/tool/${id}`)); } catch (e) { console.warn(`⚠️  could not load tool ${id}: ${e.message}`); }
  }
  const tools = raw.map(toOpenAITool).filter(Boolean);
  const snap = {
    id: a.id, name: a.name, fetchedAt: new Date().toISOString(),
    provider: m.provider, model: m.model, temperature: m.temperature ?? 0.7, maxTokens: m.maxTokens,
    firstMessage: a.firstMessage ?? '', system, tools,
    promptHash: crypto.createHash('sha256').update(system).digest('hex').slice(0, 12),
  };
  fs.mkdirSync(RESULTS, { recursive: true });
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2));
  return snap;
}

// ── judging ───────────────────────────────────────────────────────────────────
const asTranscript = (msgs) => msgs.filter((m) => m.role !== 'system').map((m) => {
  const o = { role: m.role, content: m.content ?? '' };
  if (m.tool_calls?.length) o.toolCalls = m.tool_calls.map((c) => ({ name: c.function.name, arguments: safeJSON(c.function.arguments) }));
  return o;
});
function safeJSON(s) { try { return JSON.parse(s); } catch { return s; } }

async function judge(plan, reply, history) {
  const names = (reply.tool_calls ?? []).map((c) => c.function.name);
  if (plan.toolCalls?.length) {
    const missing = plan.toolCalls.map((t) => t.name).filter((n) => !names.includes(n));
    return missing.length
      ? { pass: false, reason: `expected tool call ${missing.join(', ')}; got ${names.length ? names.join(', ') : 'no tool call'}` }
      : { pass: true };
  }
  if (plan.type === 'regex' || plan.type === 'exact') {
    const text = reply.content ?? '';
    const ok = plan.type === 'exact' ? text.trim() === plan.content.trim() : new RegExp(plan.content).test(text);
    return ok ? { pass: true } : { pass: false, reason: `${plan.type} ${JSON.stringify(plan.content)} did not match` };
  }
  if (plan.type === 'ai') {
    const all = asTranscript([...history, reply]);
    const prompt = plan.model.messages[0].content
      .replaceAll('{{messages[-1]}}', JSON.stringify(all.at(-1), null, 1))
      .replaceAll('{{messages}}', JSON.stringify(all, null, 1));
    const ask = [{ role: 'system', content: prompt }, { role: 'user', content: 'Verdict (pass or fail):' }];
    const r = await openai({ model: JUDGE_MODEL, temperature: 0, messages: ask });
    const verdict = (r.choices?.[0]?.message?.content ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (verdict.startsWith('pass')) return { pass: true };
    const why = await openai({
      model: JUDGE_MODEL, temperature: 0,
      messages: [...ask, { role: 'assistant', content: 'fail' },
        { role: 'user', content: 'In one short sentence, which criterion failed and why?' }],
    });
    return { pass: false, reason: (why.choices?.[0]?.message?.content ?? 'judge said fail').trim() };
  }
  return { pass: false, reason: `unsupported judge type ${plan.type}` };
}

// ── run one eval ──────────────────────────────────────────────────────────────
async function runEval(e, A, model) {
  const history = [{ role: 'system', content: A.system }];
  if (A.firstMessage) history.push({ role: 'assistant', content: A.firstMessage });
  const checks = [];
  let pending = []; // tool_call ids awaiting a tool response
  const closePending = (content) => {
    for (const id of pending) history.push({ role: 'tool', tool_call_id: id, content });
    pending = [];
  };

  for (const m of e.messages) {
    if (m.role === 'tool') { closePending(m.content); continue; }
    if (pending.length) closePending('Tool not executed in this test.');
    if (m.role === 'user') { history.push({ role: 'user', content: m.content }); continue; }
    if (m.role === 'assistant' && !m.judgePlan) { history.push({ role: 'assistant', content: m.content ?? '' }); continue; }

    // evaluated assistant turn → generate with the assistant's own model + tools
    const r = await openai({
      model, temperature: A.temperature, ...(A.maxTokens && PROVIDER === 'openai' ? { max_tokens: A.maxTokens } : {}),
      messages: history, ...(A.tools.length ? { tools: prepTools(A.tools) } : {}),
    });
    const msg = r.choices?.[0]?.message ?? { content: '' };
    (msg.tool_calls ?? []).forEach((c, i) => { if (!c.id) c.id = `call_${Date.now()}_${i}`; c.type ??= 'function'; });
    const reply = { role: 'assistant', content: msg.content ?? '', ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) };
    const verdict = await judge(m.judgePlan, reply, history);
    checks.push({ ...verdict, reply: asTranscript([reply])[0] });
    history.push(reply);
    pending = (msg.tool_calls ?? []).map((c) => c.id);
    if (!verdict.pass && m.continuePlan?.exitOnFailureEnabled) break;
  }
  return { pass: checks.length > 0 && checks.every((c) => c.pass), checks, transcript: asTranscript(history) };
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// ── main ──────────────────────────────────────────────────────────────────────
const A = await loadAssistant();
const model = opt('model', '') || (PROVIDER === 'gemini' ? await pickGeminiModel()
  : PROVIDER === 'openai' ? (A.provider === 'openai' && A.model ? A.model : 'gpt-4o')
  : (A.model || 'gpt-4o'));
const JUDGE_MODEL = opt('judge-model', PROVIDER === 'openai' ? 'gpt-4o' : model);
const selected = EVALS.filter((e) => !ONLY || e.name.toLowerCase().includes(ONLY) || (e.tags ?? []).includes(ONLY));
console.log(`Assistant: ${A.name} (${A.id})  prompt ${A.promptHash}, ${A.system.length} chars, ${A.tools.length} tool(s): ${A.tools.map((t) => t.function.name).join(', ') || '—'}`);
console.log(`Provider: ${PROVIDER}   Model: ${model} @ temp ${A.temperature}   Judge: ${JUDGE_MODEL}   Evals: ${selected.length}${REPEAT > 1 ? ` × ${REPEAT}` : ''}   Pace: ≤${RPM} req/min`);
if (PROVIDER !== 'openai' && A.model && !model.includes(A.model)) console.log(`Note: production runs ${A.model}; these results show ${model} on the same prompt and tools.`);
console.log('');
if (!A.system) console.warn('⚠️  Assistant has no system prompt in model.messages — results will not reflect production.\n');

const jobs = selected.flatMap((e) => Array.from({ length: REPEAT }, (_, r) => ({ e, r })));
const t0 = Date.now();
const results = await pool(jobs, CONCURRENCY, async ({ e, r }) => {
  const tag = REPEAT > 1 ? ` [${r + 1}/${REPEAT}]` : '';
  try {
    const res = await runEval(e, A, model);
    const failed = res.checks.find((c) => !c.pass);
    console.log(`${res.pass ? '✅' : '❌'} ${e.name}${tag}` +
      (failed ? `\n   reason: ${failed.reason}\n   reply:  ${(failed.reply.content || JSON.stringify(failed.reply.toolCalls ?? '')).replace(/\s+/g, ' ').slice(0, 300)}` : ''));
    if (VERBOSE) console.log(res.transcript.map((m) => `     ${m.role.padEnd(9)} ${(m.content || JSON.stringify(m.toolCalls)).replace(/\s+/g, ' ').slice(0, 220)}`).join('\n'));
    return { name: e.name, tags: e.tags, repeat: r + 1, ...res };
  } catch (err) {
    console.log(`⚠️  ${e.name}${tag}\n   ${err.message}`);
    return { name: e.name, tags: e.tags, repeat: r + 1, pass: false, error: err.message };
  }
});

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed in ${Math.round((Date.now() - t0) / 1000)}s`);
const byTag = {};
for (const r of results) for (const t of r.tags ?? []) { byTag[t] ??= [0, 0]; byTag[t][1]++; if (r.pass) byTag[t][0]++; }
console.log(Object.entries(byTag).map(([t, [p, n]]) => `  ${t.padEnd(9)} ${p}/${n}`).join('\n'));
if (REPEAT > 1) {
  const flaky = selected.filter((e) => { const rs = results.filter((r) => r.name === e.name); return rs.some((r) => r.pass) && rs.some((r) => !r.pass); });
  if (flaky.length) console.log(`\nFlaky (mixed results): ${flaky.map((e) => e.name.split(' ')[0]).join(', ')}`);
}
fs.mkdirSync(RESULTS, { recursive: true });
const file = path.join(RESULTS, `local-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify({ assistant: { id: A.id, name: A.name, promptHash: A.promptHash }, provider: PROVIDER, model, judge: JUDGE_MODEL, passed, total: results.length, results }, null, 2));
console.log(`\nFull transcripts → ${path.relative(ROOT, file)}`);
if (passed < results.length) process.exitCode = 1;
