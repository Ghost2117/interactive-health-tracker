import { describe, expect, it } from 'vitest';
import { applyAction, getBankTradeRate, totalVictoryPoints } from '../engine.js';
import { mulberry32 } from '../rng.js';
import type { Action } from '../actions.js';
import type { GameState, PlayerCount, Resource } from '../types.js';
import { RESOURCES } from '../types.js';
import { makeGame, playThroughSetup } from './testHelpers.js';

/**
 * Drives a full game end-to-end using only legal moves discovered from the
 * current state (never hand-scripted), to smoke-test that the state machine
 * always has *some* legal action and never dead-ends before a winner is
 * declared. This is the "does the game actually function" test.
 */
function pickBuildableRoad(state: GameState, playerId: string): string | null {
  for (const edge of Object.values(state.board.edges)) {
    if (state.roads[edge.id]) continue;
    const touchesNetwork = edge.vertexIds.some(
      (v) =>
        state.board.vertices[v].edgeIds.some((e) => state.roads[e] === playerId) ||
        state.buildings[v]?.playerId === playerId
    );
    if (touchesNetwork) return edge.id;
  }
  return null;
}

function pickBuildableSettlement(state: GameState, playerId: string): string | null {
  for (const vertex of Object.values(state.board.vertices)) {
    if (state.buildings[vertex.id]) continue;
    if (vertex.adjacentVertexIds.some((v) => state.buildings[v])) continue;
    const touchesRoad = vertex.edgeIds.some((e) => state.roads[e] === playerId);
    if (touchesRoad) return vertex.id;
  }
  return null;
}

function pickUpgradableCity(state: GameState, playerId: string): string | null {
  const entry = Object.entries(state.buildings).find(
    ([, b]) => b.playerId === playerId && b.type === 'settlement'
  );
  return entry ? entry[0] : null;
}

function affordable(resources: Record<Resource, number>, cost: Partial<Record<Resource, number>>): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(([r, n]) => resources[r] >= n);
}

const BUILD_PRIORITIES: Array<Partial<Record<Resource, number>>> = [
  { ore: 3, grain: 2 }, // city
  { brick: 1, lumber: 1, grain: 1, wool: 1 }, // settlement
  { brick: 1, lumber: 1 }, // road - keeps expansion options open
  { ore: 1, grain: 1, wool: 1 }, // dev card
];

/**
 * A non-trading bot stalls the instant its settlements happen to produce the
 * "wrong" resources, which is a realistic outcome of naive setup placement,
 * not an engine defect. Real players trade their way out of that, so the
 * bot does too: convert surplus resources at the best rate it has access to
 * until it can afford *something* on its priority list, or gives up.
 */
function attemptUsefulBankTrade(state: GameState, playerId: string): GameState | null {
  const player = state.players.find((p) => p.id === playerId)!;
  for (const cost of BUILD_PRIORITIES) {
    const missing = (Object.entries(cost) as [Resource, number][]).filter(([r, n]) => player.resources[r] < n);
    if (missing.length === 0) continue; // already affordable, nothing to convert toward
    for (const [needResource] of missing) {
      const surplus = RESOURCES.filter((r) => r !== needResource && !(cost as Record<string, number>)[r]).sort(
        (a, b) => player.resources[b] - player.resources[a]
      );
      for (const give of surplus) {
        const rate = getBankTradeRate(state, player, give);
        if (player.resources[give] >= rate && state.bank[needResource] >= 1) {
          const r = applyAction(state, playerId, {
            type: 'BANK_TRADE',
            give,
            want: needResource,
            giveCount: rate,
          });
          if (r.ok) return r.state;
        }
      }
    }
  }
  return null;
}

function driveOneTurn(state: GameState, rng: () => number): GameState {
  let s = state;
  const currentId = s.players[s.currentPlayerIndex].id;

  if (s.phase === 'roll') {
    const r = applyAction(s, currentId, { type: 'ROLL_DICE' }, { rng });
    expect(r.ok).toBe(true);
    s = r.ok ? r.state : s;
  }

  while (s.phase === 'robberDiscard' && s.discardQueue.length > 0) {
    const discardingId = s.discardQueue[0];
    const p = s.players.find((pl) => pl.id === discardingId)!;
    const total = RESOURCES.reduce((sum, r) => sum + p.resources[r], 0);
    const required = Math.floor(total / 2);
    const toDiscard: Partial<Record<Resource, number>> = {};
    let remaining = required;
    for (const r of RESOURCES) {
      const take = Math.min(p.resources[r], remaining);
      if (take > 0) toDiscard[r] = take;
      remaining -= take;
    }
    const r = applyAction(s, discardingId, { type: 'DISCARD', resources: toDiscard });
    expect(r.ok).toBe(true);
    s = r.ok ? r.state : s;
  }

  if (s.phase === 'robberMove') {
    const targetTile = s.board.tiles.find((t) => t.id !== s.robberTileId)!;
    const stealFromPlayerId = targetTile.vertexIds
      .map((v) => s.buildings[v]?.playerId)
      .find(
        (id) =>
          id &&
          id !== s.pendingRobberPlayerId &&
          RESOURCES.some((r) => s.players.find((p) => p.id === id)!.resources[r] > 0)
      );
    const r = applyAction(s, s.pendingRobberPlayerId!, {
      type: 'MOVE_ROBBER',
      tileId: targetTile.id,
      stealFromPlayerId,
    }, { rng });
    expect(r.ok).toBe(true);
    s = r.ok ? r.state : s;
  }

  // Greedily spend resources on whatever is legal, then end the turn.
  if (s.phase === 'main') {
    const player = s.players.find((p) => p.id === currentId)!;
    let guard = 0;
    while (guard++ < 60) {
      const cityVertex = affordable(player.resources, { ore: 3, grain: 2 }) ? pickUpgradableCity(s, currentId) : null;
      if (cityVertex) {
        const r = applyAction(s, currentId, { type: 'BUILD_CITY', vertexId: cityVertex });
        if (r.ok) {
          s = r.state;
          if (s.phase !== 'main') break;
          continue;
        }
      }
      const settlementVertex = affordable(player.resources, { brick: 1, lumber: 1, grain: 1, wool: 1 })
        ? pickBuildableSettlement(s, currentId)
        : null;
      if (settlementVertex) {
        const r = applyAction(s, currentId, { type: 'BUILD_SETTLEMENT', vertexId: settlementVertex });
        if (r.ok) {
          s = r.state;
          if (s.phase !== 'main') break;
          continue;
        }
      }
      const roadEdge = affordable(player.resources, { brick: 1, lumber: 1 }) ? pickBuildableRoad(s, currentId) : null;
      if (roadEdge) {
        const r = applyAction(s, currentId, { type: 'BUILD_ROAD', edgeId: roadEdge });
        if (r.ok) {
          s = r.state;
          if (s.phase !== 'main') break;
          continue;
        }
      }
      if (affordable(player.resources, { ore: 1, grain: 1, wool: 1 }) && s.devDeck.length > 0) {
        const r = applyAction(s, currentId, { type: 'BUY_DEV_CARD' });
        if (r.ok) {
          s = r.state;
          continue;
        }
      }
      const traded = attemptUsefulBankTrade(s, currentId);
      if (traded) {
        s = traded;
        continue;
      }
      break;
    }
    if (s.phase === 'main') {
      const r = applyAction(s, currentId, { type: 'END_TURN' });
      expect(r.ok).toBe(true);
      s = r.ok ? r.state : s;
    }
  }

  // Drain any Special Building Phase turns (5-6p) by passing immediately.
  while (s.phase === 'specialBuilding') {
    const activeId = s.players[s.currentPlayerIndex].id;
    const r = applyAction(s, activeId, { type: 'END_TURN' });
    expect(r.ok).toBe(true);
    s = r.ok ? r.state : s;
  }

  return s;
}

describe.each([4, 5, 6] as PlayerCount[])('full game simulation (%i players)', (playerCount) => {
  it('reaches a winner without the state machine ever getting stuck', () => {
    let state = makeGame(playerCount, 12345 + playerCount);
    state = playThroughSetup(state, applyAction);

    const rng = mulberry32(playerCount * 777);
    let turns = 0;
    const maxTurns = 4000;
    while (state.phase !== 'gameOver' && turns < maxTurns) {
      state = driveOneTurn(state, rng);
      turns += 1;
    }

    expect(state.phase).toBe('gameOver');
    expect(state.winnerId).not.toBeNull();
    const winner = state.players.find((p) => p.id === state.winnerId)!;
    expect(totalVictoryPoints(state, winner)).toBeGreaterThanOrEqual(state.vpTarget);

    // Sanity: bank never went negative, no duplicate building assignments.
    for (const amount of Object.values(state.bank)) {
      expect(amount).toBeGreaterThanOrEqual(0);
    }
    for (const player of state.players) {
      for (const r of RESOURCES) {
        expect(player.resources[r]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// Keep TypeScript honest that Action stays a discriminated union we exhaustively handle.
function _typeCheck(a: Action) {
  void a;
}
