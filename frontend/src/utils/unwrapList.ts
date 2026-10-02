/**
 * unwrapList (CORE-04)
 *
 * The API wraps every response as `{ success, data: { <key>: T[], ... } }`.
 * Reading `body.agents` / `body.calls` returned the envelope object instead of
 * an array, so the Dashboard called `.slice` on an object and crashed once any
 * call existed. This always returns an array.
 */
export function unwrapList<T>(body: unknown, key: string): T[] {
  const b = body as Record<string, unknown> | null | undefined;
  const data = b?.data as Record<string, unknown> | unknown[] | undefined;

  // { success, data: { [key]: [...] } } — the standard envelope
  if (data && !Array.isArray(data) && Array.isArray(data[key])) return data[key] as T[];
  // { success, data: [...] }
  if (Array.isArray(data)) return data as T[];
  // { [key]: [...] } or a bare array (older endpoints)
  if (b && Array.isArray(b[key])) return b[key] as T[];
  if (Array.isArray(body)) return body as T[];
  return [];
}
