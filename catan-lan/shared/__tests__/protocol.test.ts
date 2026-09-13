import { describe, expect, it } from 'vitest';
import { applyAction } from '../engine.js';
import { toClientGameState } from '../protocol.js';
import { RESOURCES } from '../types.js';
import { makeGame, playThroughSetup } from './testHelpers.js';

describe('toClientGameState', () => {
  it("shows a player their own full resource hand and dev cards, keyed by isSelf", () => {
    const state = playThroughSetup(makeGame(4, 1), applyAction);
    const selfId = state.players[0].id;
    const view = toClientGameState(state, selfId);

    const selfView = view.players.find((p) => p.id === selfId)!;
    expect(selfView.isSelf).toBe(true);
    expect(selfView.resources).not.toBeNull();
    expect(selfView.resources).toEqual(state.players[0].resources);
    expect(selfView.devCards).not.toBeNull();
    expect(selfView.resourceCount).toBe(RESOURCES.reduce((sum, r) => sum + state.players[0].resources[r], 0));
  });

  it('never reveals another player\'s exact resources or dev cards, only counts', () => {
    const state = playThroughSetup(makeGame(4, 2), applyAction);
    const selfId = state.players[0].id;
    const view = toClientGameState(state, selfId);

    for (const p of view.players) {
      if (p.id === selfId) continue;
      expect(p.isSelf).toBe(false);
      expect(p.resources).toBeNull();
      expect(p.devCards).toBeNull();
      const realPlayer = state.players.find((sp) => sp.id === p.id)!;
      expect(p.resourceCount).toBe(RESOURCES.reduce((sum, r) => sum + realPlayer.resources[r], 0));
      expect(p.devCardCount).toBe(realPlayer.devCards.length);
    }
  });

  it('replaces the dev deck array with just a count, never the card order', () => {
    const state = makeGame(4, 3);
    const view = toClientGameState(state, state.players[0].id) as unknown as Record<string, unknown>;
    expect(view.devDeck).toBeUndefined();
    expect((view as { devDeckCount: number }).devDeckCount).toBe(state.devDeck.length);
  });

  it('produces a different view for a different viewer (self flag and hand follow the viewer)', () => {
    const state = playThroughSetup(makeGame(4, 4), applyAction);
    const [p0, p1] = state.players;
    const viewForP0 = toClientGameState(state, p0.id);
    const viewForP1 = toClientGameState(state, p1.id);

    expect(viewForP0.players.find((p) => p.id === p0.id)!.isSelf).toBe(true);
    expect(viewForP0.players.find((p) => p.id === p1.id)!.isSelf).toBe(false);
    expect(viewForP1.players.find((p) => p.id === p1.id)!.isSelf).toBe(true);
    expect(viewForP1.players.find((p) => p.id === p0.id)!.isSelf).toBe(false);
  });

  it('leaves shared/public state (board, buildings, roads, log) identical regardless of viewer', () => {
    const state = playThroughSetup(makeGame(4, 5), applyAction);
    const viewForP0 = toClientGameState(state, state.players[0].id);
    const viewForP1 = toClientGameState(state, state.players[1].id);

    expect(viewForP0.board).toEqual(viewForP1.board);
    expect(viewForP0.buildings).toEqual(viewForP1.buildings);
    expect(viewForP0.roads).toEqual(viewForP1.roads);
    expect(viewForP0.log).toEqual(viewForP1.log);
  });

  it('is safe to JSON round-trip, as it is over the wire (no functions, no undefined-losing surprises)', () => {
    const state = playThroughSetup(makeGame(4, 6), applyAction);
    const view = toClientGameState(state, state.players[0].id);
    const roundTripped = JSON.parse(JSON.stringify(view));
    expect(roundTripped.phase).toBe(view.phase);
    expect(roundTripped.players).toHaveLength(view.players.length);
    expect(roundTripped.players[0].resources).toEqual(view.players[0].resources);
  });

  it('handles an unknown viewer id gracefully (nobody matches isSelf, no crash)', () => {
    const state = playThroughSetup(makeGame(4, 7), applyAction);
    const view = toClientGameState(state, 'not-a-real-player-id');
    expect(view.players.every((p) => !p.isSelf)).toBe(true);
    expect(view.players.every((p) => p.resources === null)).toBe(true);
  });
});
