import { useAppSelector } from '@/store';
import type { MemberPermissions } from '@/types';

/**
 * Returns true if the current user has full (write) access to the given section.
 *
 * - Owner  → always true (no restrictions)
 * - Member + permission true  → full access (create / edit / delete)
 * - Member + permission false → read-only  (can view, actions hidden)
 */
export function useCanWrite(key: keyof MemberPermissions): boolean {
  const { currentRole, currentPermissions } = useAppSelector((s) => s.org);
  if (currentRole === 'Owner') return true;
  return currentPermissions?.[key] ?? false;
}
