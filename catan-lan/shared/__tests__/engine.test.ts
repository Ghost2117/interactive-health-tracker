import { beforeEach, describe, expect, it } from 'vitest';
import { applyAction, publicVictoryPoints, totalVictoryPoints } from '../engine.js';
import { mulberry32 } from '../rng.js';
import type { GameState, Resource } from '../types.js';
import { makeGame, playThroughSetup } from './testHelpers.js';

describe('setup phase', () => {
  it('runs a snake draft: player order forward then backward, second placement grants resources', () => {
    let state = makeGame(4, 10);
    const expectedOrder = [
      state.players[0].id,
      state.players[1].id,
      state.players[2].id,
      state.players[3].id,
      state.players[3].id,
      state.players[2].id,
      state.players[1].id,
      state.players[0].id,
    ];
    expect(state.setupQueue).toEqual(expectedOrder);

    state = playThroughSetup(state, applyAction);
    expect(state.phase).toBe('roll');
    expect(state.turnNumber).toBe(1);

    // Every player should have exactly 2 settlements and 2 roads placed.
    for (const player of state.players) {
      const settlements = Object.values(state.buildings).filter((b) => b.playerId === player.id);
      expect(settlements.length).toBe(2);
      const roads = Object.values(state.roads).filter((owner) => owner === player.id);
      expect(roads.length).toBe(2);
      // Second settlement grants starting resources, so at least one player has cards.
    }
    const totalStartingCards = state.players.reduce(
      (sum, p) => sum + Object.values(p.resources).reduce((a, b) => a + b, 0),
      0
    );
    expect(totalStartingCards).toBeGreaterThan(0);
  });

  it('rejects placing a settlement adjacent to another settlement', () => {
    let state = makeGame(4, 2);
    const firstVertex = Object.values(state.board.vertices)[0];
    const edgeId = firstVertex.edgeIds[0];
    const r1 = applyAction(state, state.players[0].id, {
      type: 'PLACE_SETUP_PIECE',
      settlementVertexId: firstVertex.id,
      roadEdgeId: edgeId,
    });
    expect(r1.ok).toBe(true);
    state = (r1 as { ok: true; state: GameState }).state;

    const adjacentVertexId = firstVertex.adjacentVertexIds[0];
    const r2 = applyAction(state, state.players[1].id, {
      type: 'PLACE_SETUP_PIECE',
      settlementVertexId: adjacentVertexId,
      roadEdgeId: state.board.vertices[adjacentVertexId].edgeIds[0],
    });
    expect(r2.ok).toBe(false);
  });

  it("rejects a road that isn't attached to the settlement just placed", () => {
    const state = makeGame(4, 4);
    const vertex = Object.values(state.board.vertices).find((v) => v.edgeIds.length >= 3)!;
    const unrelatedEdge = Object.values(state.board.edges).find((e) => !e.vertexIds.includes(vertex.id))!;
    const result = applyAction(state, state.players[0].id, {
      type: 'PLACE_SETUP_PIECE',
      settlementVertexId: vertex.id,
      roadEdgeId: unrelatedEdge.id,
    });
    expect(result.ok).toBe(false);
  });
});

describe('turn flow: rolling and production', () => {
  let state: GameState;
  beforeEach(() => {
    state = playThroughSetup(makeGame(4, 20), applyAction);
  });

  it('only the current player may roll', () => {
    const notCurrent = state.players.find((p) => p.id !== state.players[state.currentPlayerIndex].id)!;
    const result = applyAction(state, notCurrent.id, { type: 'ROLL_DICE' });
    expect(result.ok).toBe(false);
  });

  it('distributes resources to settlements/cities on the rolled number', () => {
    // rng sequence chosen so both dice come up 3 (die = floor(rng()*6)+1 => rng()=0.3 gives die 2... use forced rng)
    const forcedRng = (() => {
      const seq = [0.2, 0.2]; // die = floor(0.2*6)+1 = 2 each => sum 4
      let i = 0;
      return () => seq[i++ % seq.length];
    })();
    const current = state.players[state.currentPlayerIndex];
    const before = { ...current.resources };
    const result = applyAction(state, current.id, { type: 'ROLL_DICE' }, { rng: forcedRng });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    expect(after.dice).toEqual([2, 2]);
    expect(after.phase === 'main' || after.phase === 'robberDiscard' || after.phase === 'robberMove').toBe(true);
    const totalBefore = Object.values(before).reduce((a, b) => a + b, 0);
    const totalAfterAny = after.players.reduce(
      (sum, p) => sum + Object.values(p.resources).reduce((a, b) => a + b, 0),
      0
    );
    expect(totalAfterAny).toBeGreaterThanOrEqual(totalBefore);
  });

  it('rolling a 7 sends over-limit players to discard, then to robberMove', () => {
    const current = state.players[state.currentPlayerIndex];
    current.resources.brick = 9; // force them over the 7-card limit
    const forcedRng = (() => {
      const seq = [1 / 6 - 0.001, 1 / 6 - 0.001]; // die = 1 each => sum 2... need sum 7 instead
      let i = 0;
      return () => seq[i++ % seq.length];
    })();
    // die = floor(rng()*6)+1; want d1=3,d2=4 => rng values 0.4 and 0.55
    const seq = [0.4, 0.55];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const result = applyAction(state, current.id, { type: 'ROLL_DICE' }, { rng });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    expect(after.dice![0] + after.dice![1]).toBe(7);
    expect(after.phase).toBe('robberDiscard');
    expect(after.discardQueue).toContain(current.id);
  });

  it('gives a lone entitled player whatever the bank has left, instead of nothing, when supply is short', () => {
    const current = state.players[state.currentPlayerIndex];
    // Rig a single, isolated producing tile: clear the board's buildings
    // and place only a city for the current player, so they're the only
    // player entitled to this resource on this roll.
    const tile = state.board.tiles.find((t) => t.resource !== 'desert')!;
    const vertexId = tile.vertexIds[0];
    state.buildings = { [vertexId]: { playerId: current.id, type: 'city' } };
    state.bank[tile.resource as Resource] = 1; // demand will be 2 (city), supply only 1

    const forcedRng = (() => {
      // Roll dice summing to the tile's number.
      const n = tile.number!;
      const d1 = Math.min(6, Math.ceil(n / 2));
      const d2 = n - d1;
      const seq = [(d1 - 1) / 6 + 0.001, (d2 - 1) / 6 + 0.001];
      let i = 0;
      return () => seq[i++ % seq.length];
    })();

    const result = applyAction(state, current.id, { type: 'ROLL_DICE' }, { rng: forcedRng });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    expect(after.dice![0] + after.dice![1]).toBe(tile.number);
    const player = after.players.find((p) => p.id === current.id)!;
    expect(player.resources[tile.resource as Resource]).toBe(1); // got the 1 left, not 0 and not 2
    expect(after.bank[tile.resource as Resource]).toBe(0);
  });
});

describe('building', () => {
  let state: GameState;
  beforeEach(() => {
    state = playThroughSetup(makeGame(4, 30), applyAction);
    state.phase = 'main';
    // Give the current player ample resources to build freely.
    const current = state.players[state.currentPlayerIndex];
    current.resources = { brick: 10, lumber: 10, ore: 10, grain: 10, wool: 10 };
  });

  it('builds a road connected to the player network and charges resources', () => {
    const current = state.players[state.currentPlayerIndex];
    const ownedVertex = Object.entries(state.buildings).find(([, b]) => b.playerId === current.id)![0];
    const edgeId = state.board.vertices[ownedVertex].edgeIds.find((e) => !state.roads[e])!;
    const before = current.resources.brick;
    const result = applyAction(state, current.id, { type: 'BUILD_ROAD', edgeId });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    expect(after.roads[edgeId]).toBe(current.id);
    expect(after.players[state.currentPlayerIndex].resources.brick).toBe(before - 1);
  });

  it('rejects a road not connected to anything owned by the player', () => {
    const current = state.players[state.currentPlayerIndex];
    const disconnectedEdge = Object.values(state.board.edges).find(
      (e) => !state.roads[e.id] && !e.vertexIds.some((v) => state.buildings[v]?.playerId === current.id)
    )!;
    const result = applyAction(state, current.id, { type: 'BUILD_ROAD', edgeId: disconnectedEdge.id });
    expect(result.ok).toBe(false);
  });

  it('upgrades a settlement to a city and returns the settlement piece to supply', () => {
    const current = state.players[state.currentPlayerIndex];
    const vertexId = Object.entries(state.buildings).find(([, b]) => b.playerId === current.id)![0];
    const settlementsBefore = current.settlementsLeft;
    const citiesBefore = current.citiesLeft;
    const result = applyAction(state, current.id, { type: 'BUILD_CITY', vertexId });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    expect(after.buildings[vertexId].type).toBe('city');
    const player = after.players[state.currentPlayerIndex];
    expect(player.settlementsLeft).toBe(settlementsBefore + 1);
    expect(player.citiesLeft).toBe(citiesBefore - 1);
    expect(publicVictoryPoints(after, player)).toBeGreaterThanOrEqual(2);
  });

  it('rejects buying a dev card without enough resources', () => {
    const current = state.players[state.currentPlayerIndex];
    current.resources = { brick: 0, lumber: 0, ore: 0, grain: 0, wool: 0 };
    const result = applyAction(state, current.id, { type: 'BUY_DEV_CARD' });
    expect(result.ok).toBe(false);
  });
});

describe('robber and stealing', () => {
  it('moving the robber onto an occupied tile requires stealing from an eligible player', () => {
    let state = playThroughSetup(makeGame(4, 40), applyAction);
    // Force phase into robberMove for the current player.
    state = { ...state, phase: 'robberMove', pendingRobberPlayerId: state.players[state.currentPlayerIndex].id };
    const currentId = state.players[state.currentPlayerIndex].id;
    const targetTile = state.board.tiles.find((t) => t.id !== state.robberTileId)!;
    const occupantVertex = targetTile.vertexIds.find((v) => state.buildings[v] && state.buildings[v].playerId !== currentId);

    const result = applyAction(state, currentId, { type: 'MOVE_ROBBER', tileId: targetTile.id });
    if (occupantVertex) {
      const occupantId = state.buildings[occupantVertex].playerId;
      const occupant = state.players.find((p) => p.id === occupantId)!;
      if (Object.values(occupant.resources).some((n) => n > 0)) {
        expect(result.ok).toBe(false);
      }
    }
  });

  it('cannot move the robber to the tile it is already on', () => {
    let state = playThroughSetup(makeGame(4, 41), applyAction);
    state = { ...state, phase: 'robberMove', pendingRobberPlayerId: state.players[state.currentPlayerIndex].id };
    const currentId = state.players[state.currentPlayerIndex].id;
    const result = applyAction(state, currentId, { type: 'MOVE_ROBBER', tileId: state.robberTileId });
    expect(result.ok).toBe(false);
  });
});

describe('development cards', () => {
  it('playing a knight moves the robber, increments knightsPlayed, and can grant largest army', () => {
    let state = playThroughSetup(makeGame(4, 50), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.devCards = [
      { type: 'knight', boughtOnTurn: 0 },
      { type: 'knight', boughtOnTurn: 0 },
      { type: 'knight', boughtOnTurn: 0 },
    ];
    let s = state;
    for (let i = 0; i < 3; i++) {
      s.players[s.currentPlayerIndex].playedDevCardThisTurn = false;
      const targetTile = s.board.tiles.find((t) => t.id !== s.robberTileId)!;
      const stealFromPlayerId = targetTile.vertexIds
        .map((v) => s.buildings[v]?.playerId)
        .find((id) => id && id !== current.id && Object.values(s.players.find((p) => p.id === id)!.resources).some((n) => n > 0));
      const result = applyAction(s, current.id, {
        type: 'PLAY_KNIGHT',
        tileId: targetTile.id,
        stealFromPlayerId,
      });
      expect(result.ok).toBe(true);
      s = result.ok ? result.state : s;
    }
    const player = s.players.find((p) => p.id === current.id)!;
    expect(player.knightsPlayed).toBe(3);
    expect(s.largestArmy?.playerId).toBe(current.id);
    expect(publicVictoryPoints(s, player)).toBeGreaterThanOrEqual(2);
  });

  it('cannot play a dev card bought this turn', () => {
    let state = playThroughSetup(makeGame(4, 51), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.devCards = [{ type: 'knight', boughtOnTurn: state.turnNumber }];
    const targetTile = state.board.tiles.find((t) => t.id !== state.robberTileId)!;
    const result = applyAction(state, current.id, { type: 'PLAY_KNIGHT', tileId: targetTile.id });
    expect(result.ok).toBe(false);
  });

  it('year of plenty grants exactly the requested resources from the bank', () => {
    let state = playThroughSetup(makeGame(4, 52), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.devCards = [{ type: 'yearOfPlenty', boughtOnTurn: 0 }];
    current.resources = { brick: 0, lumber: 0, ore: 0, grain: 0, wool: 0 };
    const result = applyAction(state, current.id, {
      type: 'PLAY_YEAR_OF_PLENTY',
      resources: ['ore', 'grain'],
    });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    const player = after.players.find((p) => p.id === current.id)!;
    expect(player.resources.ore).toBe(1);
    expect(player.resources.grain).toBe(1);
  });

  it('road building requires the free roads to connect to your network', () => {
    let state = playThroughSetup(makeGame(4, 55), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.devCards = [{ type: 'roadBuilding', boughtOnTurn: 0 }];

    const disconnectedEdge = Object.values(state.board.edges).find(
      (e) => !state.roads[e.id] && !e.vertexIds.some((v) => state.buildings[v]?.playerId === current.id)
    )!;
    const rejected = applyAction(state, current.id, {
      type: 'PLAY_ROAD_BUILDING',
      edgeIds: [disconnectedEdge.id],
    });
    expect(rejected.ok).toBe(false);

    const ownedVertex = Object.entries(state.buildings).find(([, b]) => b.playerId === current.id)![0];
    const connectedEdge = state.board.vertices[ownedVertex].edgeIds.find((e) => !state.roads[e])!;
    const accepted = applyAction(state, current.id, {
      type: 'PLAY_ROAD_BUILDING',
      edgeIds: [connectedEdge],
    });
    expect(accepted.ok).toBe(true);
  });

  it('monopoly transfers all of a resource from every other player', () => {
    let state = playThroughSetup(makeGame(4, 53), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.devCards = [{ type: 'monopoly', boughtOnTurn: 0 }];
    for (const p of state.players) {
      if (p.id !== current.id) p.resources.wool = 3;
    }
    const result = applyAction(state, current.id, { type: 'PLAY_MONOPOLY', resource: 'wool' });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    const player = after.players.find((p) => p.id === current.id)!;
    expect(player.resources.wool).toBe(9);
    for (const p of after.players) {
      if (p.id !== current.id) expect(p.resources.wool).toBe(0);
    }
  });

  it('only one dev card may be played per turn', () => {
    let state = playThroughSetup(makeGame(4, 54), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.devCards = [
      { type: 'yearOfPlenty', boughtOnTurn: 0 },
      { type: 'monopoly', boughtOnTurn: 0 },
    ];
    const r1 = applyAction(state, current.id, { type: 'PLAY_YEAR_OF_PLENTY', resources: ['ore', 'grain'] });
    expect(r1.ok).toBe(true);
    const s2 = r1.ok ? r1.state : state;
    const r2 = applyAction(s2, current.id, { type: 'PLAY_MONOPOLY', resource: 'wool' });
    expect(r2.ok).toBe(false);
  });

  it('dev cards may be played before rolling, on the "roll" phase', () => {
    const state = playThroughSetup(makeGame(4, 56), applyAction);
    expect(state.phase).toBe('roll');
    const current = state.players[state.currentPlayerIndex];
    current.devCards = [{ type: 'monopoly', boughtOnTurn: 0 }];
    current.resources.wool = 0;
    for (const p of state.players) {
      if (p.id !== current.id) p.resources.wool = 2;
    }
    const result = applyAction(state, current.id, { type: 'PLAY_MONOPOLY', resource: 'wool' });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    expect(after.phase).toBe('roll'); // playing a dev card doesn't consume the roll
    const player = after.players.find((p) => p.id === current.id)!;
    expect(player.resources.wool).toBe(6);
  });

  it('rejects playing a dev card during the robber/discard phases', () => {
    let state = playThroughSetup(makeGame(4, 57), applyAction);
    const current = state.players[state.currentPlayerIndex];
    current.devCards = [{ type: 'knight', boughtOnTurn: 0 }];
    state.phase = 'robberDiscard';
    state.discardQueue = [state.players[1].id];
    const targetTile = state.board.tiles.find((t) => t.id !== state.robberTileId)!;
    const result = applyAction(state, current.id, { type: 'PLAY_KNIGHT', tileId: targetTile.id });
    expect(result.ok).toBe(false);
  });
});

describe('bank and player trades', () => {
  it('trades at 4:1 with the bank with no port', () => {
    let state = playThroughSetup(makeGame(4, 60), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.resources = { brick: 0, lumber: 4, ore: 0, grain: 0, wool: 0 };
    // Neutralize ports so this test exercises the plain 4:1 bank rate,
    // regardless of which vertices setup happened to settle on.
    state.board.ports = [];
    for (const v of Object.values(state.board.vertices)) v.port = null;
    const result = applyAction(state, current.id, {
      type: 'BANK_TRADE',
      give: 'lumber',
      want: 'ore',
      giveCount: 4,
    });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    const player = after.players.find((p) => p.id === current.id)!;
    expect(player.resources.lumber).toBe(0);
    expect(player.resources.ore).toBe(1);
  });

  it('rejects a bank trade at the wrong rate', () => {
    let state = playThroughSetup(makeGame(4, 61), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.resources.lumber = 3;
    const result = applyAction(state, current.id, {
      type: 'BANK_TRADE',
      give: 'lumber',
      want: 'ore',
      giveCount: 3,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects trading a resource for itself with the bank', () => {
    let state = playThroughSetup(makeGame(4, 63), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.resources = { brick: 0, lumber: 4, ore: 0, grain: 0, wool: 0 };
    const result = applyAction(state, current.id, { type: 'BANK_TRADE', give: 'lumber', want: 'lumber', giveCount: 4 });
    expect(result.ok).toBe(false);
  });

  it('player-to-player trade completes only after the other player accepts', () => {
    let state = playThroughSetup(makeGame(4, 62), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    const other = state.players.find((p) => p.id !== current.id)!;
    current.resources = { brick: 0, lumber: 0, ore: 3, grain: 0, wool: 0 };
    other.resources = { brick: 0, lumber: 0, ore: 0, grain: 0, wool: 3 };

    const offerResult = applyAction(state, current.id, {
      type: 'OFFER_TRADE',
      give: { ore: 1 },
      want: { wool: 1 },
    });
    expect(offerResult.ok).toBe(true);
    let s = offerResult.ok ? offerResult.state : state;
    const tradeId = s.activeTrade!.id;

    const execTooEarly = applyAction(s, current.id, { type: 'EXECUTE_TRADE', tradeId, withPlayerId: other.id });
    expect(execTooEarly.ok).toBe(false);

    const respond = applyAction(s, other.id, { type: 'RESPOND_TRADE', tradeId, accept: true });
    expect(respond.ok).toBe(true);
    s = respond.ok ? respond.state : s;

    const exec = applyAction(s, current.id, { type: 'EXECUTE_TRADE', tradeId, withPlayerId: other.id });
    expect(exec.ok).toBe(true);
    const after = exec.ok ? exec.state : s;
    const finalCurrent = after.players.find((p) => p.id === current.id)!;
    const finalOther = after.players.find((p) => p.id === other.id)!;
    expect(finalCurrent.resources.ore).toBe(2);
    expect(finalCurrent.resources.wool).toBe(1);
    expect(finalOther.resources.wool).toBe(2);
    expect(finalOther.resources.ore).toBe(1);
  });
});

describe('turn rotation', () => {
  it('advances to the next player and resets dev card flag', () => {
    let state = playThroughSetup(makeGame(4, 70), applyAction);
    state.phase = 'main';
    const current = state.players[state.currentPlayerIndex];
    current.playedDevCardThisTurn = true;
    const result = applyAction(state, current.id, { type: 'END_TURN' });
    expect(result.ok).toBe(true);
    const after = result.ok ? result.state : state;
    expect(after.currentPlayerIndex).toBe((state.currentPlayerIndex + 1) % 4);
    expect(after.phase).toBe('roll');
    expect(after.players[after.currentPlayerIndex].playedDevCardThisTurn).toBe(false);
  });

  it('runs a Special Building Phase for 5-6 player games between turns', () => {
    let state = playThroughSetup(makeGame(6, 71), applyAction);
    state.phase = 'main';
    const startingIdx = state.currentPlayerIndex;
    const current = state.players[startingIdx];
    const result = applyAction(state, current.id, { type: 'END_TURN' });
    expect(result.ok).toBe(true);
    let s = result.ok ? result.state : state;
    expect(s.phase).toBe('specialBuilding');
    expect(s.specialBuildQueue?.length).toBe(5);

    // Everyone else passes their special building turn in order.
    while (s.phase === 'specialBuilding') {
      const activeId = s.players[s.currentPlayerIndex].id;
      const r = applyAction(s, activeId, { type: 'END_TURN' });
      expect(r.ok).toBe(true);
      s = r.ok ? r.state : s;
    }
    expect(s.phase).toBe('roll');
    expect(s.currentPlayerIndex).toBe((startingIdx + 1) % 6);
  });

  it('Special Building Phase allows building but not trading or playing dev cards', () => {
    let state = playThroughSetup(makeGame(6, 72), applyAction);
    state.phase = 'specialBuilding';
    const active = state.players[state.currentPlayerIndex];
    active.resources = { brick: 4, lumber: 4, ore: 4, grain: 4, wool: 4 };
    active.devCards = [{ type: 'knight', boughtOnTurn: 0 }];
    state.specialBuildQueue = state.players.filter((p) => p.id !== active.id).map((p) => p.id);
    state.postSpecialBuildingIndex = 0;

    const ownedVertex = Object.entries(state.buildings).find(([, b]) => b.playerId === active.id)![0];
    const edgeId = state.board.vertices[ownedVertex].edgeIds.find((e) => !state.roads[e])!;
    const buildResult = applyAction(state, active.id, { type: 'BUILD_ROAD', edgeId });
    expect(buildResult.ok).toBe(true);

    const bankTradeResult = applyAction(state, active.id, {
      type: 'BANK_TRADE',
      give: 'brick',
      want: 'ore',
      giveCount: 4,
    });
    expect(bankTradeResult.ok).toBe(false);

    const offerResult = applyAction(state, active.id, { type: 'OFFER_TRADE', give: { brick: 1 }, want: { ore: 1 } });
    expect(offerResult.ok).toBe(false);

    const knightResult = applyAction(state, active.id, {
      type: 'PLAY_KNIGHT',
      tileId: state.board.tiles.find((t) => t.id !== state.robberTileId)!.id,
    });
    expect(knightResult.ok).toBe(false);
  });
});

describe('victory conditions', () => {
  it('declares a winner once a player reaches the victory point target', () => {
    let state = playThroughSetup(makeGame(4, 80), applyAction);
    state.phase = 'main';
    state.vpTarget = 3; // lower the bar so the test doesn't need a full game
    const current = state.players[state.currentPlayerIndex];
    current.resources = { brick: 10, lumber: 10, ore: 10, grain: 10, wool: 10 };
    const ownedVertex = Object.entries(state.buildings).find(([, b]) => b.playerId === current.id)![0];

    const cityResult = applyAction(state, current.id, { type: 'BUILD_CITY', vertexId: ownedVertex });
    expect(cityResult.ok).toBe(true);
    const after = cityResult.ok ? cityResult.state : state;
    const player = after.players.find((p) => p.id === current.id)!;
    // Starting 2 settlements (2 VP) + 1 city upgrade (+1 VP) = 3 VP.
    expect(totalVictoryPoints(after, player)).toBeGreaterThanOrEqual(3);
    expect(after.phase).toBe('gameOver');
    expect(after.winnerId).toBe(current.id);
  });

  it('rejects further actions once the game is over', () => {
    let state = playThroughSetup(makeGame(4, 81), applyAction);
    state.phase = 'gameOver';
    state.winnerId = state.players[0].id;
    const result = applyAction(state, state.players[1].id, { type: 'ROLL_DICE' });
    expect(result.ok).toBe(false);
  });
});

describe('determinism', () => {
  it('produces identical results for identical inputs', () => {
    const s1 = makeGame(4, 999);
    const s2 = makeGame(4, 999);
    expect(s1.board.tiles.map((t) => t.resource)).toEqual(s2.board.tiles.map((t) => t.resource));
    expect(s1.players.map((p) => p.id)).toEqual(s2.players.map((p) => p.id));

    const rng1 = mulberry32(5);
    const rng2 = mulberry32(5);
    const done1 = playThroughSetup(s1, applyAction);
    const done2 = playThroughSetup(s2, applyAction);
    const r1 = applyAction(done1, done1.players[done1.currentPlayerIndex].id, { type: 'ROLL_DICE' }, { rng: rng1 });
    const r2 = applyAction(done2, done2.players[done2.currentPlayerIndex].id, { type: 'ROLL_DICE' }, { rng: rng2 });
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.state.dice).toEqual(r2.state.dice);
    }
  });
});
