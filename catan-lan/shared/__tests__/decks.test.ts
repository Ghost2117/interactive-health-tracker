import { describe, expect, it } from 'vitest';
import { buildDevDeck } from '../decks.js';
import type { PlayerCount } from '../types.js';

describe('buildDevDeck', () => {
  it('builds the official 25-card base-game deck for 4 players', () => {
    const deck = buildDevDeck(4);
    expect(deck).toHaveLength(25);
    const counts = tally(deck);
    expect(counts).toEqual({ knight: 14, victoryPoint: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 });
  });

  it.each([5, 6] as PlayerCount[])('builds a 34-card deck for %i players (base + extension cards)', (count) => {
    const deck = buildDevDeck(count);
    expect(deck).toHaveLength(34);
    const counts = tally(deck);
    expect(counts).toEqual({ knight: 20, victoryPoint: 5, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3 });
  });

  it('returns a fresh array each call (callers can safely mutate/shuffle it)', () => {
    const a = buildDevDeck(4);
    const b = buildDevDeck(4);
    expect(a).not.toBe(b);
    a.pop();
    expect(b).toHaveLength(25);
  });
});

function tally(deck: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const card of deck) counts[card] = (counts[card] ?? 0) + 1;
  return counts;
}
