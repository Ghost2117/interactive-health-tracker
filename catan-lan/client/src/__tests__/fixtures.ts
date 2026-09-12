import { applyAction } from '../../../shared/engine.js';
import { createGame } from '../../../shared/game.js';
import { toClientGameState } from '../../../shared/protocol.js';
import { mulberry32 } from '../../../shared/rng.js';
import type { GameState, PlayerCount } from '../../../shared/types.js';

/** Shared test scaffolding: build a real server GameState (not a hand-typed
 *  mock) so component tests exercise the same shapes the real app sends. */
export function makeServerGame(playerCount: PlayerCount = 4, seed = 1): GameState {
  const players = Array.from({ length: playerCount }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, color: 'red' }));
  return createGame({ roomCode: 'TEST', playerCount, players, rng: mulberry32(seed) });
}

export function finishSetup(server: GameState): GameState {
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

export { toClientGameState };
