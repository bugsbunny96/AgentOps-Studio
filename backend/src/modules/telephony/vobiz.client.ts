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

async function vobizGet<T>(path: string, query: Record<string, string | number>): Promise<T> {
  if (!env.VOBIZ_AUTH_ID || !env.VOBIZ_AUTH_TOKEN) {
    throw new Error('VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN are not configured');
  }
  const qs  = new URLSearchParams(Object.entries(query).map(([k, v]): [string, string] => [k, String(v)])).toString();
  const url = `${VOBIZ_BASE}/account/${encodeURIComponent(env.VOBIZ_AUTH_ID)}${path}${qs ? `?${qs}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-ID':    env.VOBIZ_AUTH_ID,
        'X-Auth-Token': env.VOBIZ_AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Vobiz API ${resp.status} on GET ${path}: ${text.slice(0, 300)}`);
    }
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timer);
  }
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
