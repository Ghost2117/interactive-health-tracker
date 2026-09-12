import { describe, expect, it } from 'vitest';
import { createGame } from '../game.js';
import { mulberry32 } from '../rng.js';
import { RESOURCES, type PlayerCount } from '../types.js';

function samplePlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, color: 'red' }));
}

describe('createGame', () => {
  it.each([4, 5, 6] as PlayerCount[])('builds a valid initial state for %i players', (count) => {
    const state = createGame({
      roomCode: 'ABCD',
      playerCount: count,
      players: samplePlayers(count),
      rng: mulberry32(1),
    });

    expect(state.phase).toBe('setup');
    expect(state.players).toHaveLength(count);
    expect(state.board.tiles).toHaveLength(count === 4 ? 19 : 30);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.turnNumber).toBe(0);
    expect(state.dice).toBeNull();
    expect(state.winnerId).toBeNull();
    expect(state.buildings).toEqual({});
    expect(state.roads).toEqual({});
    expect(state.longestRoad).toBeNull();
    expect(state.largestArmy).toBeNull();
    expect(state.activeTrade).toBeNull();
    expect(state.specialBuildQueue).toBeNull();
    expect(state.vpTarget).toBe(10);
    expect(state.robberTileId).toBe(state.board.tiles.find((t) => t.resource === 'desert')!.id);
  });

  it('gives every player empty starting resources and full piece counts', () => {
    const state = createGame({ roomCode: 'ABCD', playerCount: 4, players: samplePlayers(4), rng: mulberry32(2) });
    for (const player of state.players) {
      for (const r of RESOURCES) expect(player.resources[r]).toBe(0);
      expect(player.devCards).toEqual([]);
      expect(player.roadsLeft).toBe(15);
      expect(player.settlementsLeft).toBe(5);
      expect(player.citiesLeft).toBe(4);
      expect(player.connected).toBe(true);
    }
  });

  it('sets up the bank with the right supply per player count', () => {
    const state4 = createGame({ roomCode: 'A', playerCount: 4, players: samplePlayers(4), rng: mulberry32(1) });
    for (const r of RESOURCES) expect(state4.bank[r]).toBe(19);

    const state6 = createGame({ roomCode: 'B', playerCount: 6, players: samplePlayers(6), rng: mulberry32(1) });
    for (const r of RESOURCES) expect(state6.bank[r]).toBe(24);
  });

  it('builds a snake-draft setup queue covering every player twice', () => {
    const state = createGame({ roomCode: 'A', playerCount: 4, players: samplePlayers(4), rng: mulberry32(1) });
    expect(state.setupQueue).toHaveLength(8);
    for (const player of state.players) {
      expect(state.setupQueue.filter((id) => id === player.id)).toHaveLength(2);
    }
  });

  it('builds a full, unshuffled-composition dev card deck matching the player count', () => {
    const state4 = createGame({ roomCode: 'A', playerCount: 4, players: samplePlayers(4), rng: mulberry32(1) });
    expect(state4.devDeck).toHaveLength(25);
    const state6 = createGame({ roomCode: 'B', playerCount: 6, players: samplePlayers(6), rng: mulberry32(1) });
    expect(state6.devDeck).toHaveLength(34);
  });

  it('seats players in a random order (not necessarily input order), using the given rng', () => {
    const players = samplePlayers(6);
    const state = createGame({ roomCode: 'A', playerCount: 6, players, rng: mulberry32(123) });
    // All the same ids, just possibly reordered by seat.
    expect(new Set(state.players.map((p) => p.id))).toEqual(new Set(players.map((p) => p.id)));
    expect(state.players.map((p, i) => p.seat === i).every(Boolean)).toBe(true);
  });

  it('is fully deterministic for the same rng seed', () => {
    const a = createGame({ roomCode: 'A', playerCount: 4, players: samplePlayers(4), rng: mulberry32(555) });
    const b = createGame({ roomCode: 'A', playerCount: 4, players: samplePlayers(4), rng: mulberry32(555) });
    expect(a.players.map((p) => p.id)).toEqual(b.players.map((p) => p.id));
    expect(a.board.tiles.map((t) => `${t.resource}${t.number}`)).toEqual(b.board.tiles.map((t) => `${t.resource}${t.number}`));
    expect(a.devDeck).toEqual(b.devDeck);
  });

  it('throws a clear error when the player list does not match playerCount', () => {
    expect(() =>
      createGame({ roomCode: 'A', playerCount: 4, players: samplePlayers(3), rng: mulberry32(1) })
    ).toThrow(/Expected 4 players, got 3/);
    expect(() =>
      createGame({ roomCode: 'A', playerCount: 4, players: samplePlayers(5), rng: mulberry32(1) })
    ).toThrow(/Expected 4 players, got 5/);
  });

  it('respects a custom vpTarget', () => {
    const state = createGame({ roomCode: 'A', playerCount: 4, players: samplePlayers(4), rng: mulberry32(1), vpTarget: 6 });
    expect(state.vpTarget).toBe(6);
  });
});
