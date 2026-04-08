import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cn, withRetry, detectAndFixOverlaps } from '../../src/utils';
import type { SlideElement } from '../../src/types';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('merges tailwind conflicting classes (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null as any, 'bar')).toBe('foo bar');
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('resolves immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 2, 0);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-network errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Something went wrong'));
    await expect(withRetry(fn, 2, 0)).rejects.toThrow('Something went wrong');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network errors up to retries count', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, 2, 100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exhausts all retries and throws on persistent network error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('xhr error'));

    const promise = withRetry(fn, 2, 100);
    const rejection = expect(promise).rejects.toThrow('xhr error');
    await vi.runAllTimersAsync();
    await rejection;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on Rpc failed errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Rpc failed'))
      .mockResolvedValue('data');

    const promise = withRetry(fn, 1, 100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('data');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('detectAndFixOverlaps (SC-003)', () => {
  const makeEl = (overrides: Partial<SlideElement>): SlideElement => ({
    type: 'text',
    x: 0,
    y: 0,
    w: 50,
    h: 10,
    content: '',
    ...overrides,
  });

  it('returns unchanged array when no overlaps', () => {
    const elements: SlideElement[] = [
      makeEl({ y: 0, h: 10 }),
      makeEl({ y: 15, h: 10 }),
    ];
    const result = detectAndFixOverlaps(elements);
    expect(result[0].y).toBe(0);
    expect(result[1].y).toBe(15);
  });

  it('fixes overlapping elements by pushing lower element down', () => {
    const elements: SlideElement[] = [
      makeEl({ y: 0, h: 20, x: 0, w: 50 }),
      makeEl({ y: 10, h: 10, x: 0, w: 50 }),
    ];
    const result = detectAndFixOverlaps(elements);
    const upper = result.find(e => e.y === 0)!;
    const lower = result.find(e => e.y !== 0)!;
    expect(lower.y).toBeGreaterThanOrEqual(upper.y + upper.h + 2);
  });

  it('does not modify background image element', () => {
    const bgEl: SlideElement = makeEl({ type: 'image', x: 0, y: 0, w: 100, h: 100 });
    const textEl: SlideElement = makeEl({ y: 5, h: 10, x: 0, w: 50 });
    const result = detectAndFixOverlaps([bgEl, textEl]);
    const bg = result.find(e => e.type === 'image' && e.w === 100)!;
    expect(bg.y).toBe(0);
    expect(bg.x).toBe(0);
  });

  it('does not mutate the input array', () => {
    const elements: SlideElement[] = [
      makeEl({ y: 0, h: 20 }),
      makeEl({ y: 10, h: 10 }),
    ];
    const original = elements.map(e => ({ ...e }));
    detectAndFixOverlaps(elements);
    expect(elements[0].y).toBe(original[0].y);
    expect(elements[1].y).toBe(original[1].y);
  });

  it('handles non-horizontally-overlapping elements correctly (no fix needed)', () => {
    const elements: SlideElement[] = [
      makeEl({ y: 0, h: 20, x: 0, w: 40 }),
      makeEl({ y: 5, h: 10, x: 60, w: 40 }),
    ];
    const result = detectAndFixOverlaps(elements);
    expect(result[1].y).toBe(5);
  });

  it('chains fix for three stacked elements', () => {
    const elements: SlideElement[] = [
      makeEl({ y: 0, h: 15, x: 0, w: 50 }),
      makeEl({ y: 5, h: 15, x: 0, w: 50 }),
      makeEl({ y: 10, h: 15, x: 0, w: 50 }),
    ];
    const result = detectAndFixOverlaps(elements);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].y).toBeGreaterThanOrEqual(result[i - 1].y + result[i - 1].h + 2);
    }
  });
});
