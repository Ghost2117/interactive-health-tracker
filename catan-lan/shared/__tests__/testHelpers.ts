import { createGame } from '../game.js';
import { mulberry32 } from '../rng.js';
import type { GameState, PlayerCount } from '../types.js';

export function makeGame(playerCount: PlayerCount = 4, seed = 1): GameState {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    color: ['red', 'blue', 'orange', 'white', 'green', 'brown'][i],
  }));
  return createGame({
    roomCode: 'TEST',
    playerCount,
    players,
    rng: mulberry32(seed),
    fairLayout: true,
  });
}

/** Finishes the snake-draft setup phase by picking arbitrary legal spots for every player. */
export function playThroughSetup(state: GameState, applyAction: typeof import('../engine.js').applyAction): GameState {
  let s = state;
  while (s.phase === 'setup') {
    const playerId = s.setupQueue[0];
    const { vertexId, edgeId } = findLegalSetupSpot(s);
    const result = applyAction(s, playerId, {
      type: 'PLACE_SETUP_PIECE',
      settlementVertexId: vertexId,
      roadEdgeId: edgeId,
    });
    if (!result.ok) throw new Error(`Setup placement failed: ${result.error}`);
    s = result.state;
  }
  return s;
}

export function findLegalSetupSpot(state: GameState): { vertexId: string; edgeId: string } {
  for (const vertex of Object.values(state.board.vertices)) {
    if (state.buildings[vertex.id]) continue;
    const tooClose = vertex.adjacentVertexIds.some((v) => state.buildings[v]);
    if (tooClose) continue;
    const edgeId = vertex.edgeIds[0];
    return { vertexId: vertex.id, edgeId };
  }
  throw new Error('No legal setup spot found');
}
