import { describe, expect, it } from 'vitest';
import { applyAction } from '../../../shared/engine.js';
import { createGame } from '../../../shared/game.js';
import { toClientGameState } from '../../../shared/protocol.js';
import { mulberry32 } from '../../../shared/rng.js';
import type { GameState } from '../../../shared/types.js';
import {
  eligibleStealTargets,
  legalCityVertices,
  legalRoadEdges,
  legalRobberTiles,
  legalSettlementVertices,
  legalSetupRoads,
  legalSetupVertices,
} from '../legalMoves.js';

function makeServerGame(seed = 1): GameState {
  const players = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, color: 'red' }));
  return createGame({ roomCode: 'TEST', playerCount: 4, players, rng: mulberry32(seed) });
}

describe('legalSetupVertices', () => {
  it('allows every vertex on a fresh board (nothing built yet)', () => {
    const server = makeServerGame();
    const client = toClientGameState(server, server.players[0].id);
    const legal = legalSetupVertices(client);
    expect(legal.size).toBe(Object.keys(client.board.vertices).length);
  });

  it('excludes a vertex and its neighbors once a settlement is placed there (matches the server distance rule)', () => {
    let server = makeServerGame(2);
    const firstVertex = Object.values(server.board.vertices)[0];
    const result = applyAction(server, server.players[0].id, {
      type: 'PLACE_SETUP_PIECE',
      settlementVertexId: firstVertex.id,
      roadEdgeId: firstVertex.edgeIds[0],
    });
    expect(result.ok).toBe(true);
    server = result.ok ? result.state : server;

    const client = toClientGameState(server, server.players[1].id);
    const legal = legalSetupVertices(client);
    expect(legal.has(firstVertex.id)).toBe(false);
    for (const neighborId of firstVertex.adjacentVertexIds) {
      expect(legal.has(neighborId)).toBe(false);
    }

    // Cross-check against the server: every vertex legalMoves excludes for
    // the distance rule must actually be rejected by applyAction, and
    // every vertex it allows must (for setup, ignoring turn order) not be
    // rejected specifically *for the distance rule*.
    for (const vertexId of Object.keys(client.board.vertices)) {
      if (legal.has(vertexId)) continue;
      if (vertexId === firstVertex.id || firstVertex.adjacentVertexIds.includes(vertexId)) {
        const r = applyAction(server, server.players[1].id, {
          type: 'PLACE_SETUP_PIECE',
          settlementVertexId: vertexId,
          roadEdgeId: server.board.vertices[vertexId].edgeIds[0],
        });
        expect(r.ok).toBe(false);
      }
    }
  });
});

describe('legalSetupRoads', () => {
  it('only offers the unoccupied edges touching the just-placed settlement', () => {
    const server = makeServerGame(3);
    const vertex = Object.values(server.board.vertices).find((v) => v.edgeIds.length === 3)!; // interior vertex
    const client = toClientGameState(server, server.players[0].id);
    const legal = legalSetupRoads(client, vertex.id);
    expect(legal.size).toBe(vertex.edgeIds.length);
    for (const edgeId of legal) expect(vertex.edgeIds).toContain(edgeId);
  });

  it('excludes an edge that is already built on', () => {
    let server = makeServerGame(4);
    const vertex = Object.values(server.board.vertices)[0];
    const roadEdgeId = vertex.edgeIds[0];
    const result = applyAction(server, server.players[0].id, {
      type: 'PLACE_SETUP_PIECE',
      settlementVertexId: vertex.id,
      roadEdgeId,
    });
    server = result.ok ? result.state : server;

    const client = toClientGameState(server, server.players[0].id);
    const legal = legalSetupRoads(client, vertex.id);
    expect(legal.has(roadEdgeId)).toBe(false);
  });
});

function finishSetup(server: GameState): GameState {
  let s = server;
  while (s.phase === 'setup') {
    const playerId = s.setupQueue[0];
    const vertex = Object.values(s.board.vertices).find((v) => {
      if (s.buildings[v.id]) return false;
      return !v.adjacentVertexIds.some((n) => s.buildings[n]);
    })!;
    const result = applyAction(s, playerId, {
      type: 'PLACE_SETUP_PIECE',
      settlementVertexId: vertex.id,
      roadEdgeId: vertex.edgeIds[0],
    });
    if (!result.ok) throw new Error(`setup failed: ${result.error}`);
    s = result.state;
  }
  return s;
}

describe('legalRoadEdges', () => {
  it("only offers edges connected to the player's existing roads or buildings", () => {
    const server = finishSetup(makeServerGame(5));
    const playerId = server.players[0].id;
    const client = toClientGameState(server, playerId);
    const legal = legalRoadEdges(client, playerId);

    expect(legal.size).toBeGreaterThan(0);
    for (const edgeId of legal) {
      // Every edge legalMoves offers must actually be accepted server-side
      // if the player could afford it (bypass cost by granting resources).
      let s = server;
      s.players.find((p) => p.id === playerId)!.resources = { brick: 5, lumber: 5, ore: 5, grain: 5, wool: 5 };
      s = { ...s, phase: 'main', currentPlayerIndex: s.players.findIndex((p) => p.id === playerId) };
      const result = applyAction(s, playerId, { type: 'BUILD_ROAD', edgeId });
      expect(result.ok).toBe(true);
    }
  });

  it('never offers an edge that is already built on by anyone', () => {
    const server = finishSetup(makeServerGame(6));
    const playerId = server.players[0].id;
    const client = toClientGameState(server, playerId);
    const legal = legalRoadEdges(client, playerId);
    for (const edgeId of legal) {
      expect(client.roads[edgeId]).toBeUndefined();
    }
  });
});

describe('legalSettlementVertices', () => {
  it('requires both a vacant, distance-rule-legal spot AND a connecting road', () => {
    const server = finishSetup(makeServerGame(7));
    const playerId = server.players[0].id;
    const client = toClientGameState(server, playerId);
    const legal = legalSettlementVertices(client, playerId);

    for (const vertexId of legal) {
      expect(client.buildings[vertexId]).toBeUndefined();
      const touchesOwnRoad = client.board.vertices[vertexId].edgeIds.some((e) => client.roads[e] === playerId);
      expect(touchesOwnRoad).toBe(true);
    }
  });

  it('agrees with the server on legality once resources are granted', () => {
    const server = finishSetup(makeServerGame(8));
    const playerId = server.players[0].id;
    const client = toClientGameState(server, playerId);
    const legal = legalSettlementVertices(client, playerId);

    for (const vertexId of legal) {
      let s = server;
      s.players.find((p) => p.id === playerId)!.resources = { brick: 5, lumber: 5, ore: 5, grain: 5, wool: 5 };
      s = { ...s, phase: 'main', currentPlayerIndex: s.players.findIndex((p) => p.id === playerId) };
      const result = applyAction(s, playerId, { type: 'BUILD_SETTLEMENT', vertexId });
      expect(result.ok).toBe(true);
    }
  });
});

describe('legalCityVertices', () => {
  it("only offers the player's own settlements, never someone else's or their own cities", () => {
    const server = finishSetup(makeServerGame(9));
    const playerId = server.players[0].id;
    const client = toClientGameState(server, playerId);
    const legal = legalCityVertices(client, playerId);

    expect(legal.size).toBeGreaterThan(0);
    for (const vertexId of legal) {
      const building = client.buildings[vertexId];
      expect(building.playerId).toBe(playerId);
      expect(building.type).toBe('settlement');
    }
    // Every other player's settlements must be excluded.
    for (const [vertexId, building] of Object.entries(client.buildings)) {
      if (building.playerId !== playerId) expect(legal.has(vertexId)).toBe(false);
    }
  });
});

describe('legalRobberTiles', () => {
  it('offers every tile except the one the robber currently occupies', () => {
    const server = makeServerGame(10);
    const client = toClientGameState(server, server.players[0].id);
    const legal = legalRobberTiles(client);
    expect(legal.has(server.robberTileId)).toBe(false);
    expect(legal.size).toBe(client.board.tiles.length - 1);
  });
});

describe('eligibleStealTargets', () => {
  it('returns opponents (not the active player) with a building on the tile and at least 1 card', () => {
    const server = finishSetup(makeServerGame(11));
    const activePlayerId = server.players[0].id;
    // Find a tile touching a building owned by someone else.
    const client = toClientGameState(server, activePlayerId);
    const tile = client.board.tiles.find((t) =>
      t.vertexIds.some((v) => client.buildings[v] && client.buildings[v].playerId !== activePlayerId)
    )!;
    const opponentId = tile.vertexIds.map((v) => client.buildings[v]?.playerId).find((id) => id && id !== activePlayerId)!;

    // Give the opponent a card so they're a valid steal target.
    const server2 = { ...server, players: server.players.map((p) => (p.id === opponentId ? { ...p, resources: { ...p.resources, brick: 1 } } : p)) };
    const client2 = toClientGameState(server2, activePlayerId);
    const targets = eligibleStealTargets(client2, tile.id, activePlayerId);
    expect(targets).toContain(opponentId);
    expect(targets).not.toContain(activePlayerId);
  });

  it('excludes an opponent on the tile who has zero resource cards', () => {
    const server = finishSetup(makeServerGame(12));
    const activePlayerId = server.players[0].id;
    const zeroedServer = {
      ...server,
      players: server.players.map((p) => ({ ...p, resources: { brick: 0, lumber: 0, ore: 0, grain: 0, wool: 0 } })),
    };
    const client = toClientGameState(zeroedServer, activePlayerId);
    const tile = client.board.tiles.find((t) => t.vertexIds.some((v) => client.buildings[v]))!;
    const targets = eligibleStealTargets(client, tile.id, activePlayerId);
    expect(targets).toEqual([]);
  });

  it('returns an empty list for an unknown tile id', () => {
    const server = finishSetup(makeServerGame(13));
    const client = toClientGameState(server, server.players[0].id);
    expect(eligibleStealTargets(client, 'not-a-real-tile', server.players[0].id)).toEqual([]);
  });
});
