/** NoSQL-injection guard — "$" keys removed at any depth (pure). */
import { describe, it, expect } from 'vitest';
import { stripOperatorKeys } from '../middleware/stripMongoOperators';

describe('stripOperatorKeys', () => {
  it('removes operator objects used for login bypass', () => {
    const body = { email: { $ne: '' }, password: { $gt: '' } } as Record<string, unknown>;
    expect(stripOperatorKeys(body)).toBe(2);
    expect(body).toEqual({ email: {}, password: {} });
  });

  it('removes nested and array operators but keeps normal data', () => {
    const body = { name: 'Ritu', items: [{ qty: 2, $where: 'x' }], meta: { a: { $regex: '.*' }, b: 'ok' } };
    expect(stripOperatorKeys(body)).toBe(2);
    expect(body).toEqual({ name: 'Ritu', items: [{ qty: 2 }], meta: { a: {}, b: 'ok' } });
  });

  it('leaves primitives, null and Buffers alone', () => {
    expect(stripOperatorKeys('text')).toBe(0);
    expect(stripOperatorKeys(null)).toBe(0);
    const buf = Buffer.from('{"$x":1}');
    expect(stripOperatorKeys(buf)).toBe(0);
    expect(buf.toString()).toBe('{"$x":1}');
  });

  it('keeps keys that only contain $ later or dots', () => {
    const q = { 'price$': 1, 'a.b': 2 };
    expect(stripOperatorKeys(q)).toBe(0);
    expect(q).toEqual({ 'price$': 1, 'a.b': 2 });
  });
});
