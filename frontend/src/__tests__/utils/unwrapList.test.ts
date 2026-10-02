/** CORE-04 — Dashboard list unwrapping */
import { describe, it, expect } from 'vitest';
import { unwrapList } from '@/utils/unwrapList';

describe('unwrapList', () => {
  it('reads the list from the standard { success, data: { key } } envelope', () => {
    const body = { success: true, data: { calls: [{ id: 'c1' }, { id: 'c2' }], total: 2 } };
    const calls = unwrapList<{ id: string }>(body, 'calls');
    expect(calls).toEqual([{ id: 'c1' }, { id: 'c2' }]);
    expect(calls.slice(0, 6)).toHaveLength(2); // the call that crashed the Dashboard
  });

  it('reads agents from the /agents envelope (not the envelope object itself)', () => {
    const body = { success: true, data: { agents: [{ id: 'a1' }], vapiPublicKey: null, vapiAssistantId: null } };
    expect(unwrapList(body, 'agents')).toHaveLength(1);
  });

  it('accepts { data: [...] }, { key: [...] } and bare arrays', () => {
    expect(unwrapList({ data: [1, 2] }, 'calls')).toEqual([1, 2]);
    expect(unwrapList({ calls: [3] }, 'calls')).toEqual([3]);
    expect(unwrapList([4], 'calls')).toEqual([4]);
  });

  it('returns [] for anything else', () => {
    expect(unwrapList(undefined, 'calls')).toEqual([]);
    expect(unwrapList(null, 'calls')).toEqual([]);
    expect(unwrapList({ success: true, data: { total: 0 } }, 'calls')).toEqual([]);
    expect(unwrapList({ success: false, message: 'err' }, 'agents')).toEqual([]);
  });
});
