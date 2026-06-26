/**
 * 🟣 Test Engineer — cn() utility tests
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/utils/cn';

describe('cn()', () => {
  it('returns a string', () => {
    expect(typeof cn('foo')).toBe('string');
  });

  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes via object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('handles falsy values gracefully', () => {
    expect(cn('foo', false, undefined, null, '', 'bar')).toBe('foo bar');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    // twMerge should keep only the last of conflicting utilities
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });

  it('resolves conflicting text color classes', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('does not deduplicate non-conflicting classes', () => {
    const result = cn('px-2', 'py-4');
    expect(result).toContain('px-2');
    expect(result).toContain('py-4');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });
});
