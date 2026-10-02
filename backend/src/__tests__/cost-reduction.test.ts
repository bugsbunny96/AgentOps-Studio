/**
 * Cost reduction (2026-10-02) — steps 1–4
 *
 *   1. Every voice agent uses the model from config/llm.ts (default gpt-4o-mini).
 *   2. Small catalogs/KBs stay inline (compact); large ones move behind lookup
 *      tools; the prompt is deterministic so the provider's prompt cache applies.
 *   3. Premium voices are gated by plan.
 *   4. The real per-call Vapi cost is read from the end-of-call report.
 *
 * Pure unit tests — no database or network needed.
 */

import { describe, it, expect, afterEach } from 'vitest';
import type { IOrganization } from '@/modules/organization/organization.model';
import type { ICatalogItem } from '@/modules/catalog/catalog.model';
import { env } from '@/config/env';
import { LLM_MODELS } from '@/config/llm';
import {
  assembleAgentPrompt,
  buildVapiModel,
  formatCatalogCompact,
  formatCatalogItemLine,
} from '@/modules/agents/assistant-config';
import { formatCatalogForPrompt } from '@/modules/catalog/catalog.service';
import {
  getFeaturePlan,
  getPremiumVoiceAccess,
  getVoiceTier,
  isVoiceAllowedForOrg,
} from '@/modules/agents/voice-pricing';
import { mergeModelTools, type VapiInlineTool } from '@/modules/agents/vapi.service';
import { isAddonSubscription } from '@/modules/billing/billing.service';
import { scoreText, tokenize } from '@/modules/tools/lookup.service';
import { pickCostBreakdown, resolveReportedCost } from '@/modules/calls/webhook.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const org = {
  _id: '650000000000000000000001',
  name: 'Ritu Electricals',
  agentName: 'Ritu',
  plan: 'starter',
  supportedLanguages: ['en-US', 'hi-IN'],
  businessHours: { start: '09:30', end: '19:00' },
  faqs: [{ question: 'Do you deliver?', answer: 'Yes, PAN India.' }],
} as unknown as IOrganization;

function item(i: number, overrides: Partial<ICatalogItem> = {}): ICatalogItem {
  return {
    itemId: `EL-${String(i).padStart(3, '0')}`,
    name: `LED Bulb ${i}W`,
    category: i % 2 ? 'Lighting' : 'Fans',
    brand: 'Philips',
    price: 100 + i,
    unit: 'piece',
    stock: i,
    isActive: true,
    ...overrides,
  } as unknown as ICatalogItem;
}

const catalog = (n: number) => Array.from({ length: n }, (_, i) => item(i + 1));
const BASE = 'https://api.example.com';

const saved = {
  lookup: env.PROMPT_LOOKUP_TOOLS_ENABLED,
  maxItems: env.PROMPT_CATALOG_INLINE_MAX_ITEMS,
  maxKb: env.PROMPT_KB_INLINE_MAX_CHARS,
  model: env.LLM_MODEL,
};
afterEach(() => {
  env.PROMPT_LOOKUP_TOOLS_ENABLED = saved.lookup;
  env.PROMPT_CATALOG_INLINE_MAX_ITEMS = saved.maxItems;
  env.PROMPT_KB_INLINE_MAX_CHARS = saved.maxKb;
  env.LLM_MODEL = saved.model;
});

// ── Step 1: model ─────────────────────────────────────────────────────────────

describe('step 1 — model registry', () => {
  it('defaults to gpt-4o-mini at temperature 0.3', () => {
    env.LLM_MODEL = 'gpt-4o-mini';
    const m = buildVapiModel('prompt');
    expect(m).toMatchObject({ provider: 'openai', model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 300 });
    expect(m.messages).toEqual([{ role: 'system', content: 'prompt' }]);
  });

  it('switches provider for Gemini and keeps tool IDs + inline tools', () => {
    env.LLM_MODEL = 'gemini-2.5-flash';
    const tools = assembleAgentPrompt(org, '', [], catalog(100), BASE).tools;
    const m = buildVapiModel('p', { toolIds: ['t1'], tools });
    expect(m.provider).toBe('google');
    expect(m.model).toBe('gemini-2.5-flash');
    expect(m.toolIds).toEqual(['t1']);
    expect(m.tools?.[0]?.function.name).toBe('search_catalog');
  });

  it('prices every cheaper model below GPT-4o', () => {
    for (const id of ['gpt-4o-mini', 'gpt-4.1-mini', 'gemini-2.5-flash'] as const) {
      expect(LLM_MODELS[id].inputUsdPerM).toBeLessThan(LLM_MODELS['gpt-4o'].inputUsdPerM);
    }
  });
});

// ── Step 2: prompt size ───────────────────────────────────────────────────────

describe('step 2 — prompt size', () => {
  it('compact catalog is much shorter than the old 7-column table', () => {
    const items = catalog(32);
    const compact = formatCatalogCompact(items).length;
    const table   = formatCatalogForPrompt(items).length;
    expect(compact).toBeLessThan(table * 0.85);
  });

  it('keeps price, unit and stock in each compact line', () => {
    expect(formatCatalogItemLine(item(9))).toBe('- LED Bulb 9W (Philips) — ₹109 per piece · stock 9');
    expect(formatCatalogItemLine(item(1, { stock: 0 }))).toContain('OUT OF STOCK');
  });

  it('inlines a small catalog and attaches no tools', () => {
    const r = assembleAgentPrompt(org, '', [], catalog(32), BASE);
    expect(r.catalogMode).toBe('inline');
    expect(r.tools).toHaveLength(0);
    expect(r.systemPrompt).toContain('₹101 per piece');
  });

  it('moves a large catalog behind search_catalog', () => {
    env.PROMPT_CATALOG_INLINE_MAX_ITEMS = 60;
    const big = catalog(200);
    const r = assembleAgentPrompt(org, '', [], big, BASE);
    expect(r.catalogMode).toBe('lookup');
    expect(r.tools.map((t) => t.function.name)).toEqual(['search_catalog']);
    expect(r.tools[0]!.server.url).toBe(`${BASE}/api/v1/tools/lookup`);
    expect(r.systemPrompt).not.toContain('₹150 per piece');
    expect(r.systemPrompt).toContain('search_catalog');
    // the lookup prompt is far smaller than inlining 200 items
    const inline = assembleAgentPrompt(org, '', [], big, null);
    expect(r.systemPrompt.length).toBeLessThan(inline.systemPrompt.length / 3);
  });

  it('moves a long KB behind search_knowledge_base', () => {
    env.PROMPT_KB_INLINE_MAX_CHARS = 3000;
    const kb = `## Knowledge Base\n\n### Delivery\n${'x'.repeat(5000)}`;
    const r = assembleAgentPrompt(org, kb, ['Delivery'], [], BASE);
    expect(r.kbMode).toBe('lookup');
    expect(r.systemPrompt).toContain('"Delivery"');
    expect(r.systemPrompt).not.toContain('x'.repeat(100));
    expect(r.tools.map((t) => t.function.name)).toEqual(['search_knowledge_base']);
  });

  it('falls back to inline when no public API URL is configured', () => {
    const r = assembleAgentPrompt(org, 'k'.repeat(5000), ['Doc'], catalog(200), null);
    expect(r.catalogMode).toBe('inline');
    expect(r.kbMode).toBe('inline');
    expect(r.tools).toHaveLength(0);
  });

  it('respects PROMPT_LOOKUP_TOOLS_ENABLED=false', () => {
    env.PROMPT_LOOKUP_TOOLS_ENABLED = false;
    expect(assembleAgentPrompt(org, '', [], catalog(200), BASE).catalogMode).toBe('inline');
  });

  it('is deterministic (byte-identical prompt → provider prompt cache applies)', () => {
    const a = assembleAgentPrompt(org, '## Knowledge Base\n\n### A\nabc', ['A'], catalog(10), BASE).systemPrompt;
    const b = assembleAgentPrompt(org, '## Knowledge Base\n\n### A\nabc', ['A'], catalog(10), BASE).systemPrompt;
    expect(a).toBe(b);
    expect(a).not.toMatch(/\b20\d\d-\d\d-\d\d\b/); // no dates
  });
});

describe('step 2 — lookup keyword matching', () => {
  it('tokenizes and drops stop words', () => {
    expect(tokenize('Do you have the Havells MCB 32A?')).toEqual(['havells', 'mcb', '32a']);
  });

  it('scores exact tokens above substrings and zero for unrelated text', () => {
    const q = tokenize('ceiling fan');
    expect(scoreText(q, 'Ceiling Fan 1200mm Crompton')).toBe(4);
    expect(scoreText(q, 'Exhaust fans')).toBe(1);
    expect(scoreText(q, 'LED bulb')).toBe(0);
  });
});

// ── Step 3: voice tiers ───────────────────────────────────────────────────────

describe('step 3 — voice tiers', () => {
  it('classifies providers', () => {
    expect(getVoiceTier('openai')).toBe('standard');
    expect(getVoiceTier('deepgram')).toBe('standard');
    expect(getVoiceTier('vapi')).toBe('standard');
    expect(getVoiceTier('elevenlabs')).toBe('premium');
    expect(getVoiceTier('azure')).toBe('premium');
    expect(getVoiceTier('something-new')).toBe('premium'); // unknown → treat as costly
  });

  it('includes premium voices on Pro at no charge', () => {
    const pro = getPremiumVoiceAccess({ plan: 'enterprise' } as never);
    expect(pro).toMatchObject({ allowed: true, includedInPlan: true, addonEligible: false, addonPriceInr: null });
  });

  it('sells the add-on on Basic (₹2,999) and Standard (₹4,999)', () => {
    expect(getPremiumVoiceAccess({ plan: 'starter' } as never))
      .toMatchObject({ allowed: false, addonEligible: true, addonPriceInr: 2999 });
    expect(getPremiumVoiceAccess({ plan: 'growth' } as never))
      .toMatchObject({ allowed: false, addonEligible: true, addonPriceInr: 4999 });
  });

  it('unlocks premium voices on Basic/Standard once the add-on is active', () => {
    expect(isVoiceAllowedForOrg('elevenlabs', { plan: 'starter' } as never)).toBe(false);
    expect(isVoiceAllowedForOrg('elevenlabs', { plan: 'starter', premiumVoiceAddon: true } as never)).toBe(true);
    expect(getPremiumVoiceAccess({ plan: 'growth', premiumVoiceAddon: true } as never).addonEligible).toBe(false);
  });

  it('does not sell or honour the add-on on free / trial', () => {
    const trial = { plan: 'free', trialUsed: true, trialEndsAt: new Date(Date.now() + 3 * 86_400_000) };
    expect(getPremiumVoiceAccess(trial as never)).toMatchObject({ allowed: false, addonEligible: false });
    // downgraded to free with a stale add-on flag → not allowed
    expect(isVoiceAllowedForOrg('elevenlabs', { plan: 'free', premiumVoiceAddon: true } as never)).toBe(false);
    expect(isVoiceAllowedForOrg('openai', { plan: 'free' } as never)).toBe(true);
  });

  it('uses planOverride and treats an active trial as Basic', () => {
    expect(getFeaturePlan({ plan: 'starter', planOverride: 'enterprise' } as never)).toBe('enterprise');
    const trial = { plan: 'free', trialUsed: true, trialEndsAt: new Date(Date.now() + 3 * 86_400_000) };
    expect(getFeaturePlan(trial as never)).toBe('starter');
  });
});

describe('step 3 — add-on subscription never changes the plan', () => {
  it('recognises the add-on by metadata or stored subscription ID', () => {
    expect(isAddonSubscription({ id: 'sub_1', metadata: { addon: 'premium_voices' } } as never)).toBe(true);
    expect(isAddonSubscription({ id: 'sub_2', metadata: {} } as never, 'sub_2')).toBe(true);
    expect(isAddonSubscription({ id: 'sub_plan', metadata: {}, items: { data: [{ price: { id: 'price_plan' } }] } } as never, 'sub_2')).toBe(false);
  });
});

// ── Tool safety net ───────────────────────────────────────────────────────────

describe('tool safety net — model updates never drop submit_order / end call', () => {
  const inline = (name: string): VapiInlineTool => ({
    type: 'function',
    function: { name, description: name, parameters: { type: 'object', properties: {} } },
    server: { url: `https://x/${name}` },
  });
  const next = { provider: 'openai' as const, model: 'gpt-4o-mini', messages: [{ role: 'system' as const, content: 'p' }] };

  it('keeps the live assistant\'s tool IDs when the update has none', () => {
    const merged = mergeModelTools({ toolIds: ['submit-order-id', 'end-call-id'] }, next);
    expect(merged.toolIds).toEqual(['submit-order-id', 'end-call-id']);
  });

  it('unions tool IDs without duplicates', () => {
    const merged = mergeModelTools({ toolIds: ['a', 'b'] }, { ...next, toolIds: ['b', 'c'] });
    expect(merged.toolIds).toEqual(['a', 'b', 'c']);
  });

  it('keeps inline submit_order / end_receptionist_call defined on the live assistant', () => {
    const merged = mergeModelTools(
      { tools: [inline('submit_order'), inline('end_receptionist_call')] },
      { ...next, tools: [inline('search_catalog')] },
    );
    expect(merged.tools?.map((t) => t.function.name)).toEqual(['submit_order', 'end_receptionist_call', 'search_catalog']);
  });

  it('removes our lookup tools when the new prompt no longer needs them', () => {
    const merged = mergeModelTools({ tools: [inline('submit_order'), inline('search_catalog')] }, next);
    expect(merged.tools?.map((t) => t.function.name)).toEqual(['submit_order']);
  });
});

// ── Step 4: cost recording ────────────────────────────────────────────────────

describe('step 4 — reported call cost', () => {
  const call = { id: 'c1', assistantId: 'a1', type: 'inboundPhoneCall' as const };

  it('reads message.cost first, then call.cost, then costBreakdown.total', () => {
    expect(resolveReportedCost({ cost: 0.21, call })).toBe(0.21);
    expect(resolveReportedCost({ call: { ...call, cost: 0.3 } })).toBe(0.3);
    expect(resolveReportedCost({ call, costBreakdown: { total: 0.4 } })).toBe(0.4);
  });

  it('returns undefined when Vapi sent no cost (so the call is marked for backfill)', () => {
    expect(resolveReportedCost({ call })).toBeUndefined();
    expect(resolveReportedCost({ cost: Number.NaN, call })).toBeUndefined();
  });

  it('keeps only numeric breakdown fields', () => {
    const raw = { stt: 0.01, llm: 0.004, vapi: 0.05, total: 0.07, analysisCostBreakdown: { x: 1 } } as never;
    expect(pickCostBreakdown(raw)).toEqual({ stt: 0.01, llm: 0.004, vapi: 0.05, total: 0.07 });
  });
});
