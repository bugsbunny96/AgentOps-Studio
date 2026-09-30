/**
 * vapi-evals.mjs — create and run the Vapi eval suite in ./evals.mjs
 * ────────────────────────────────────────────────────────────────────
 * Usage (from project root; reads VAPI_API_KEY from backend/.env):
 *
 *   node scripts/vapi-evals/vapi-evals.mjs dry                 # print payloads, no network
 *   node scripts/vapi-evals/vapi-evals.mjs assistants          # list assistants (find the right id)
 *   node scripts/vapi-evals/vapi-evals.mjs create              # create/update all evals in Vapi
 *   node scripts/vapi-evals/vapi-evals.mjs run                 # run all evals against the assistant
 *   node scripts/vapi-evals/vapi-evals.mjs check               # re-check the last run's results (no new runs)
 *   node scripts/vapi-evals/vapi-evals.mjs cleanup [--yes]     # list (or delete with --yes) all queued/running runs
 *   node scripts/vapi-evals/vapi-evals.mjs smoke               # blank-assistant vs target one-turn test (diagnoses stuck runs)
 *
 * Options:
 *   --assistant <id>   target assistant (default: VAPI_EVAL_ASSISTANT_ID or the Ritu Electricals id)
 *   --only <text>      only evals whose name or tag contains <text> (e.g. --only price, --only tool-01)
 *   --concurrency <n>  parallel runs (default 3)
 *
 * Results are written to scripts/vapi-evals/results/<timestamp>.json (gitignored).
 * Exit code is 1 if any eval fails — usable as a CI gate before prompt changes ship.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVALS } from './evals.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const API = 'https://api.vapi.ai';
const DEFAULT_ASSISTANT = '100b3bd9-5038-4f11-b487-7ced98d8a3dd'; // Ritu Electricals Receptionist

// ── env ────────────────────────────────────────────────────────────────────────
const envPath = path.join(ROOT, 'backend/.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

// ── args ───────────────────────────────────────────────────────────────────────
const [, , cmd = 'help', ...rest] = process.argv;
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback;
};
const ASSISTANT_ID = opt('assistant', process.env.VAPI_EVAL_ASSISTANT_ID || DEFAULT_ASSISTANT);
const ONLY = opt('only', '').toLowerCase();
const CONCURRENCY = Number(opt('concurrency', 3));

const selected = EVALS.filter(
  (e) => !ONLY || e.name.toLowerCase().includes(ONLY) || (e.tags ?? []).some((t) => t.toLowerCase() === ONLY),
);

const toPayload = (e) => ({
  name: e.name.slice(0, 80),
  ...(e.description ? { description: e.description.slice(0, 500) } : {}),
  type: 'chat.mockConversation',
  messages: e.messages,
});

// ── http ───────────────────────────────────────────────────────────────────────
async function vapi(method, url, body) {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error('VAPI_API_KEY missing (backend/.env)');
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${url} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
const asList = (d) => (Array.isArray(d) ? d : d?.results ?? d?.data ?? []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function existingEvals() {
  const map = new Map();
  for (const e of asList(await vapi('GET', '/eval?limit=1000'))) map.set(e.name, e);
  return map;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// ── commands ───────────────────────────────────────────────────────────────────
async function create() {
  const existing = await existingEvals();
  for (const e of selected) {
    const payload = toPayload(e);
    const found = existing.get(payload.name);
    try {
      if (found) {
        const { type, ...patch } = payload; // type is immutable
        try { await vapi('PATCH', `/eval/${found.id}`, patch); }
        catch (err) {
          if (![404, 405].includes(err.status)) throw err;
          await vapi('DELETE', `/eval/${found.id}`);
          await vapi('POST', '/eval', payload);
        }
        console.log(`↻ updated  ${payload.name}`);
      } else {
        const created = await vapi('POST', '/eval', payload);
        console.log(`✚ created  ${payload.name}  (${created?.id ?? '?'})`);
      }
    } catch (err) {
      console.error(`✖ failed   ${payload.name}\n  ${err.message}`);
      process.exitCode = 1;
    }
  }
}

function summarise(run) {
  const r = run?.results?.[0] ?? {};
  const reasons = (r.messages ?? [])
    .filter((m) => m?.judge && m.judge.status !== 'pass')
    .map((m) => m.judge.failureReason || `judge=${m.judge.status}`)
    .concat(run?.endedMessage ? [run.endedMessage] : []);
  const lastReply = [...(r.messages ?? [])].reverse().find((m) => m.role === 'assistant')?.content;
  return { status: r.status ?? run?.status ?? 'unknown', endedReason: run?.endedReason, reasons, lastReply };
}


/** Start an eval run and return its id, whatever shape the POST response has. */
async function startRun(evalId, assistantId) {
  const started = await vapi('POST', '/eval/run', { type: 'eval', evalId, target: { type: 'assistant', assistantId } });
  let runId = started?.id ?? started?.evalRunId ?? started?.workflowId ?? started?.evalRun?.id ?? started?.run?.id;
  for (let i = 0; !runId && i < 5; i++) {
    await sleep(1000);
    const runs = asList(await vapi('GET', `/eval/run?evalId=${evalId}&limit=20`))
      .filter((r) => r.evalId === evalId && r.target?.assistantId === assistantId)
      .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
    runId = runs[0]?.id;
  }
  if (!runId) throw new Error(`could not find run id; POST /eval/run returned: ${JSON.stringify(started).slice(0, 400)}`);
  return { runId, started };
}

async function runOne(e) {
  const existing = runOne.cache ??= await existingEvals();
  const ev = existing.get(e.name.slice(0, 80));
  if (!ev) return { name: e.name, status: 'missing', reasons: ['not created — run "create" first'] };
  const started = await vapi('POST', '/eval/run', {
    type: 'eval',
    evalId: ev.id,
    target: { type: 'assistant', assistantId: ASSISTANT_ID },
  });
  let runId = started?.id ?? started?.evalRunId ?? started?.workflowId;
  if (!runId) {
    // POST did not return a run id — find the newest run for this eval instead.
    const runs = asList(await vapi('GET', `/eval/run?evalId=${ev.id}&limit=5`))
      .filter((r) => r.evalId === ev.id)
      .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
    runId = runs[0]?.id;
    if (!runId) console.log(`   ⚠️  ${e.name}: no run id in response: ${JSON.stringify(started).slice(0, 300)}`);
  }
  console.log(`   … started ${e.name}${runId ? ` (run ${runId})` : ''}`);
  let run = started;
  const deadline = Date.now() + 5 * 60_000;
  while (runId && run?.status !== 'ended' && Date.now() < deadline) {
    await sleep(3000);
    run = await vapi('GET', `/eval/run/${runId}`);
  }
  if (run?.status !== 'ended') run = { ...run, endedMessage: `still "${run?.status ?? 'unknown'}" after 5 min — check dashboard.vapi.ai/evals` };
  const s = summarise(run);
  const icon = s.status === 'pass' ? '✅' : '❌';
  console.log(`${icon} ${e.name}${s.status === 'pass' ? '' : `\n   reason: ${s.reasons.join(' | ') || s.endedReason || s.status}\n   reply:  ${String(s.lastReply ?? '').slice(0, 300)}`}`);
  return { name: e.name, tags: e.tags, runId, ...s, raw: run };
}

async function run() {
  console.log(`Running ${selected.length} eval(s) against assistant ${ASSISTANT_ID}\n`);
  const results = await pool(selected, CONCURRENCY, async (e) => {
    try { return await runOne(e); }
    catch (err) { console.log(`⚠️  ${e.name}\n   ${err.message}`); return { name: e.name, status: 'error', reasons: [err.message] }; }
  });
  const passed = results.filter((r) => r.status === 'pass').length;
  console.log(`\n${passed}/${results.length} passed`);
  const byTag = {};
  for (const r of results) for (const t of r.tags ?? []) {
    byTag[t] ??= { pass: 0, total: 0 }; byTag[t].total++; if (r.status === 'pass') byTag[t].pass++;
  }
  console.log(Object.entries(byTag).map(([t, v]) => `  ${t.padEnd(9)} ${v.pass}/${v.total}`).join('\n'));
  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ assistantId: ASSISTANT_ID, passed, total: results.length, results }, null, 2));
  console.log(`\nFull results → ${path.relative(ROOT, file)}`);
  if (passed < results.length) process.exitCode = 1;
}

async function assistants() {
  for (const a of asList(await vapi('GET', '/assistant?limit=100'))) {
    console.log(`${a.id}  ${a.name ?? '(no name)'}${a.id === ASSISTANT_ID ? '   ← current target' : ''}`);
  }
}

function dry() {
  for (const e of selected) console.log(JSON.stringify(toPayload(e), null, 2));
  console.log(`\n${selected.length} eval payload(s); target assistant ${ASSISTANT_ID}`);
}


/** Re-fetch the runs from the latest results file (no new runs, no extra cost). */
async function check() {
  const dir = path.join(__dirname, 'results');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  if (!files.length) return console.log('No results yet — run "run" first.');
  const file = path.join(dir, files.at(-1));
  const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Checking ${prev.results.length} run(s) from ${files.at(-1)}\n`);
  const counts = {};
  const results = await pool(prev.results, CONCURRENCY, async (r) => {
    if (!r.runId) return r;
    const run = await vapi('GET', `/eval/run/${r.runId}`);
    const s = summarise(run);
    const label = run.status === 'ended' ? s.status : run.status;
    counts[label] = (counts[label] ?? 0) + 1;
    const icon = label === 'pass' ? '✅' : run.status === 'ended' ? '❌' : '⏳';
    console.log(`${icon} ${r.name}  [${label}]${label === 'fail' || run.endedReason === 'error' ? `\n   reason: ${s.reasons.join(' | ') || s.endedReason}\n   reply:  ${String(s.lastReply ?? '').slice(0, 300)}` : ''}`);
    return { ...r, ...s, raw: run };
  });
  console.log('\n' + Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('  '));
  fs.writeFileSync(file, JSON.stringify({ ...prev, results }, null, 2));
}

/** Delete every eval run that has not ended (queued / running). Dry-run unless --yes. */
async function cleanup() {
  const yes = rest.includes('--yes');
  const stuck = asList(await vapi('GET', '/eval/run?limit=1000')).filter((r) => r.status !== 'ended');
  if (!stuck.length) return console.log('No queued/running eval runs.');
  for (const r of stuck) console.log(`${yes ? '🗑  deleting' : '•'} ${r.id}  [${r.status}]  created ${r.createdAt}`);
  if (!yes) return console.log(`\n${stuck.length} unfinished run(s). Re-run with --yes to delete them.`);
  let ok = 0;
  await pool(stuck, CONCURRENCY, async (r) => {
    try { await vapi('DELETE', `/eval/run/${r.id}`); ok++; }
    catch (err) { console.error(`✖ ${r.id}: ${err.message}`); process.exitCode = 1; }
  });
  console.log(`\nDeleted ${ok}/${stuck.length} run(s).`);
}

/**
 * Smoke test: blank assistant (no tools, no server URL, gpt-4o) + one-turn eval ("Hello" → regex .+).
 * Runs it against the blank assistant, then against the target assistant, so one command shows
 * whether stuck runs are account-wide or specific to the target assistant.
 */
async function smoke() {
  const BLANK_NAME = 'Eval Smoke Test (blank)';
  const EVAL_NAME = 'smoke-00 Hello gets any reply';
  const TIMEOUT = 3 * 60_000;

  let blank = asList(await vapi('GET', '/assistant?limit=100')).find((a) => a.name === BLANK_NAME);
  if (!blank) {
    blank = await vapi('POST', '/assistant', {
      name: BLANK_NAME,
      firstMessage: 'Hello!',
      model: { provider: 'openai', model: 'gpt-4o', messages: [{ role: 'system', content: 'You are a friendly assistant. Reply briefly.' }] },
    });
    console.log(`✚ created blank assistant ${blank.id}`);
  } else console.log(`• using blank assistant ${blank.id}`);

  let ev = (await existingEvals()).get(EVAL_NAME);
  if (!ev) {
    ev = await vapi('POST', '/eval', {
      name: EVAL_NAME,
      description: 'Smoke test: any non-empty assistant reply passes.',
      type: 'chat.mockConversation',
      messages: [{ role: 'user', content: 'Hello' }, { role: 'assistant', judgePlan: { type: 'regex', content: '.+' } }],
    });
    console.log(`✚ created eval ${ev.id}`);
  } else console.log(`• using eval ${ev.id}`);

  for (const [label, assistantId] of [['blank assistant', blank.id], ['target assistant', ASSISTANT_ID]]) {
    const t0 = Date.now();
    let runId, started;
    try { ({ runId, started } = await startRun(ev.id, assistantId)); }
    catch (err) { console.log(`\n▶ ${label} (${assistantId})\n   ⚠️  ${err.message}`); continue; }
    console.log(`\n▶ ${label} (${assistantId}) — run ${runId}`);
    let run = started?.status ? started : {}, last = '';
    while (run?.status !== 'ended' && Date.now() - t0 < TIMEOUT) {
      await sleep(3000);
      run = await vapi('GET', `/eval/run/${runId}`);
      if (run.status !== last) { console.log(`   ${Math.round((Date.now() - t0) / 1000)}s  status=${run.status}`); last = run.status; }
    }
    const secs = Math.round((Date.now() - t0) / 1000);
    if (run?.status !== 'ended') { console.log(`   ⏳ still "${run?.status}" after ${secs}s — STUCK`); continue; }
    const s = summarise(run);
    console.log(`   ${s.status === 'pass' ? '✅' : '❌'} ${s.status} in ${secs}s  (endedReason: ${run.endedReason ?? '-'})`);
    if (s.lastReply) console.log(`   reply: ${String(s.lastReply).slice(0, 200)}`);
    if (s.status !== 'pass') console.log(`   reason: ${s.reasons.join(' | ') || run.endedMessage || '-'}`);
  }
  console.log('\nBlank passes + target stuck → problem is in the target assistant config.');
  console.log('Both stuck → account-level (credits / Vapi support).');
}

const commands = { create, run, assistants, dry, check, cleanup, smoke };
if (!commands[cmd]) {
  console.log('Commands: dry | assistants | create | run | check | cleanup | smoke   (see header of this file)');
} else {
  await commands[cmd]();
}
