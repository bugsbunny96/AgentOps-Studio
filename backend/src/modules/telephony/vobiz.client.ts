/**
 * Vobiz REST API client (account-level API, not SIP).
 *
 * Base URL: https://api.vobiz.ai/api/v1/account/{auth_id}
 * Auth:     X-Auth-ID + X-Auth-Token headers (Vobiz Console dashboard).
 * Docs:     https://vobiz.ai/docs/account-phone-number
 *
 * Server-side only — the Auth Token must never reach the browser.
 */

import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const VOBIZ_BASE = 'https://api.vobiz.ai/api/v1';
const FETCH_TIMEOUT_MS = 15_000;
const PER_PAGE = 100;
const MAX_PAGES = 5; // 500 numbers is far more than an early-stage shared pool needs

/** Subset of the Vobiz PhoneNumber object that we rely on. */
export interface VobizPhoneNumber {
  id: string;
  e164: string;
  country?: string;
  region?: string | null;
  status?: 'active' | 'pending_purchase' | 'pending_release' | 'released' | 'blocked' | string;
  voice_enabled?: boolean;
  is_blocked?: boolean;
  monthly_fee?: number;
  currency?: string;
  trunk_group_id?: string | null;
  aadhaar_verification_required?: boolean;
  aadhaar_verified?: boolean;
}

interface VobizListResponse {
  items: VobizPhoneNumber[];
  page: number;
  per_page: number;
  total: number;
}

export function isVobizApiConfigured(): boolean {
  return !!(env.VOBIZ_AUTH_ID && env.VOBIZ_AUTH_TOKEN);
}

/** Error from the Vobiz API, with the HTTP status and response body kept for callers. */
export class VobizApiError extends Error {
  constructor(public status: number, public body: string, message: string) {
    super(message);
    this.name = 'VobizApiError';
  }
}

async function vobizRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  opts: { query?: Record<string, string | number>; body?: unknown } = {},
): Promise<T> {
  if (!env.VOBIZ_AUTH_ID || !env.VOBIZ_AUTH_TOKEN) {
    throw new Error('VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN are not configured');
  }
  const query = opts.query ?? {};
  const qs  = new URLSearchParams(Object.entries(query).map(([k, v]): [string, string] => [k, String(v)])).toString();
  const url = `${VOBIZ_BASE}/account/${encodeURIComponent(env.VOBIZ_AUTH_ID)}${path}${qs ? `?${qs}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'X-Auth-ID':    env.VOBIZ_AUTH_ID,
        'X-Auth-Token': env.VOBIZ_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new VobizApiError(resp.status, text.slice(0, 500), `Vobiz API ${resp.status} on ${method} ${path}: ${text.slice(0, 300)}`);
    }
    if (resp.status === 204) return undefined as T;
    const text = await resp.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } finally {
    clearTimeout(timer);
  }
}

function vobizGet<T>(path: string, query: Record<string, string | number>): Promise<T> {
  return vobizRequest<T>('GET', path, { query });
}

/**
 * All numbers owned by the shared Vobiz account (paginated internally).
 * Pass `search` (E.164) to look up a single number.
 */
export async function listAccountNumbers(search?: string): Promise<VobizPhoneNumber[]> {
  const all: VobizPhoneNumber[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await vobizGet<VobizListResponse>('/numbers', {
      page,
      per_page: PER_PAGE,
      ...(search ? { search } : {}),
    });
    all.push(...(res.items ?? []));
    if (all.length >= (res.total ?? 0) || (res.items ?? []).length < PER_PAGE) break;
    if (page === MAX_PAGES) {
      logger.warn('Vobiz listAccountNumbers: page cap reached', { total: res.total, fetched: all.length });
    }
  }
  return all;
}

// ─── Inventory + purchase (number automation, 2026-10-08) ─────────────────────
//
// Vobiz docs (Account → Phone Numbers):
//   GET    /account/{auth_id}/inventory/numbers?country=IN&search=&page=&per_page=   unassigned numbers for sale
//   POST   /account/{auth_id}/numbers/purchase-from-inventory  { e164, currency }  debits setup + first month
//   POST   /account/{auth_id}/numbers/{e164}/assign            { trunk_group_id }  route to our SIP trunk
// Field names of inventory items are read defensively — verify against a live response.

/** A number Vobiz has for sale. Fee fields are ₹ when currency is INR. */
export interface VobizInventoryNumber {
  e164:            string;
  country?:        string;
  region?:         string | null;
  /** e.g. "local" | "mobile" | "national" | "tollfree" — when Vobiz returns it */
  number_type?:    string;
  type?:           string;
  series?:         string | null;
  monthly_fee?:    number;
  setup_fee?:      number;
  currency?:       string;
  voice_enabled?:  boolean;
  aadhaar_verification_required?: boolean;
}

/** One page of the Vobiz inventory (search = digits contained in the number). */
export async function listInventoryNumbers(
  opts: { search?: string; page?: number; perPage?: number } = {},
): Promise<VobizInventoryNumber[]> {
  const res = await vobizGet<{ items?: VobizInventoryNumber[] }>('/inventory/numbers', {
    country:  'IN',
    page:     opts.page ?? 1,
    per_page: Math.min(opts.perPage ?? PER_PAGE, PER_PAGE),
    ...(opts.search ? { search: opts.search } : {}),
  });
  return res?.items ?? [];
}

/** Buys a number from inventory. Debits the Vobiz balance (setup + monthly fee). */
export async function purchaseFromInventory(e164: string): Promise<VobizPhoneNumber | undefined> {
  return vobizRequest<VobizPhoneNumber | undefined>('POST', '/numbers/purchase-from-inventory', {
    body: { e164, currency: 'INR' },
  });
}

/** Routes an owned number to a SIP trunk group (our "Vobiz Inbound" trunk → Vapi). */
export async function assignNumberToTrunk(e164: string, trunkGroupId: string): Promise<void> {
  await vobizRequest<unknown>('POST', `/numbers/${encodeURIComponent(e164)}/assign`, {
    body: { trunk_group_id: trunkGroupId },
  });
}
