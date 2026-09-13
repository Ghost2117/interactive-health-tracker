import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randomSeed, shuffle } from '../rng.js';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('always returns values in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('does not repeat the same value on consecutive calls (sanity check it is actually advancing)', () => {
    const rng = mulberry32(7);
    const first = rng();
    const second = rng();
    expect(first).not.toBe(second);
  });

  it('handles a zero seed without throwing or getting stuck at 0', () => {
    const rng = mulberry32(0);
    const values = Array.from({ length: 5 }, () => rng());
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});

describe('randomSeed', () => {
  it('returns an integer in the 32-bit unsigned range', () => {
    for (let i = 0; i < 20; i++) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(0xffffffff);
    }
  });

  it('is usable directly as a mulberry32 seed', () => {
    expect(() => mulberry32(randomSeed())()).not.toThrow();
  });
});

describe('shuffle', () => {
  it('returns a permutation: same elements, same length', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(items, mulberry32(1));
    expect(result).toHaveLength(items.length);
    expect([...result].sort()).toEqual([...items].sort());
  });

  it('does not mutate the input array', () => {
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    shuffle(items, mulberry32(1));
    expect(items).toEqual(copy);
  });

  it('is deterministic for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    const r1 = shuffle(items, mulberry32(99));
    const r2 = shuffle(items, mulberry32(99));
    expect(r1).toEqual(r2);
  });

  it('actually reorders a large-enough array (not just returning it unchanged)', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const result = shuffle(items, mulberry32(5));
    expect(result).not.toEqual(items);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
    expect(shuffle([42], mulberry32(1))).toEqual([42]);
  });
});

describe('pick', () => {
  it('always returns an element that was in the input array', () => {
    const items = ['brick', 'lumber', 'ore', 'grain', 'wool'];
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(pick(items, rng));
    }
  });

  it('can return the single element of a one-item array', () => {
    expect(pick([7], mulberry32(1))).toBe(7);
  });
});
