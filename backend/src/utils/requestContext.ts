/**
 * Per-request org context (SEC-05)
 *
 * `orgContext` middleware resolves the active org once per request and stores
 * it here. Services look up the caller's membership with `membershipFilter()`,
 * so the role/permission check and the data the service touches always refer
 * to the SAME org — even when a user belongs to several orgs.
 *
 * Outside a request (scripts, workers, tests that call services directly) no
 * context is set and the filter falls back to `{ userId }`.
 */
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  orgId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithOrgContext<T>(orgId: string, fn: () => T): T {
  return storage.run({ orgId }, fn);
}

export function currentOrgId(): string | undefined {
  return storage.getStore()?.orgId;
}

/** Mongo filter for the caller's membership in the active org. */
export function membershipFilter<T extends Record<string, unknown>>(
  userId: string | undefined,
  extra?: T,
): { userId: string | undefined; organizationId?: string } & T {
  const orgId = currentOrgId();
  return {
    userId,
    ...(orgId ? { organizationId: orgId } : {}),
    ...(extra ?? ({} as T)),
  };
}
