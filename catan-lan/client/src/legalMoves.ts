import type { ClientGameState } from '../../shared/protocol.js';

export type BuildMode = 'setupRoad' | 'road' | 'settlement' | 'city' | 'robberMove' | 'robberKnight' | 'roadBuilding' | null;

function vertexTouchesPlayerRoad(state: ClientGameState, playerId: string, vertexId: string): boolean {
  return state.board.vertices[vertexId].edgeIds.some((e) => state.roads[e] === playerId);
}

function vertexTouchesPlayerBuilding(state: ClientGameState, playerId: string, vertexId: string): boolean {
  const b = state.buildings[vertexId];
  return !!b && b.playerId === playerId;
}

function violatesDistanceRule(state: ClientGameState, vertexId: string): boolean {
  if (state.buildings[vertexId]) return true;
  return state.board.vertices[vertexId].adjacentVertexIds.some((v) => !!state.buildings[v]);
}

export function legalSetupVertices(state: ClientGameState): Set<string> {
  const result = new Set<string>();
  for (const vertexId of Object.keys(state.board.vertices)) {
    if (!violatesDistanceRule(state, vertexId)) result.add(vertexId);
  }
  return result;
}

export function legalSetupRoads(state: ClientGameState, settlementVertexId: string): Set<string> {
  return new Set(state.board.vertices[settlementVertexId].edgeIds.filter((e) => !state.roads[e]));
}

export function legalRoadEdges(state: ClientGameState, playerId: string): Set<string> {
  const result = new Set<string>();
  for (const [edgeId, edge] of Object.entries(state.board.edges)) {
    if (state.roads[edgeId]) continue;
    const connects = edge.vertexIds.some(
      (v) => vertexTouchesPlayerRoad(state, playerId, v) || vertexTouchesPlayerBuilding(state, playerId, v)
    );
    if (connects) result.add(edgeId);
  }
  return result;
}

export function legalSettlementVertices(state: ClientGameState, playerId: string): Set<string> {
  const result = new Set<string>();
  for (const vertexId of Object.keys(state.board.vertices)) {
    if (violatesDistanceRule(state, vertexId)) continue;
    if (vertexTouchesPlayerRoad(state, playerId, vertexId)) result.add(vertexId);
  }
  return result;
}

export function legalCityVertices(state: ClientGameState, playerId: string): Set<string> {
  const result = new Set<string>();
  for (const [vertexId, b] of Object.entries(state.buildings)) {
    if (b.playerId === playerId && b.type === 'settlement') result.add(vertexId);
  }
  return result;
}

export function legalRobberTiles(state: ClientGameState): Set<string> {
  return new Set(state.board.tiles.filter((t) => t.id !== state.robberTileId).map((t) => t.id));
}

export function eligibleStealTargets(state: ClientGameState, tileId: string, activePlayerId: string): string[] {
  const tile = state.board.tiles.find((t) => t.id === tileId);
  if (!tile) return [];
  const owners = new Set<string>();
  for (const vertexId of tile.vertexIds) {
    const b = state.buildings[vertexId];
    if (b && b.playerId !== activePlayerId) owners.add(b.playerId);
  }
  return [...owners].filter((id) => (state.players.find((p) => p.id === id)?.resourceCount ?? 0) > 0);
}
