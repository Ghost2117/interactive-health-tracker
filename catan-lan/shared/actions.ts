import type { Resource } from './types.js';

export type Action =
  | { type: 'ROLL_DICE' }
  | { type: 'PLACE_SETUP_PIECE'; settlementVertexId: string; roadEdgeId: string }
  | { type: 'BUILD_ROAD'; edgeId: string }
  | { type: 'BUILD_SETTLEMENT'; vertexId: string }
  | { type: 'BUILD_CITY'; vertexId: string }
  | { type: 'BUY_DEV_CARD' }
  | { type: 'PLAY_KNIGHT'; tileId: string; stealFromPlayerId?: string }
  | { type: 'PLAY_ROAD_BUILDING'; edgeIds: string[] }
  | { type: 'PLAY_YEAR_OF_PLENTY'; resources: [Resource, Resource] }
  | { type: 'PLAY_MONOPOLY'; resource: Resource }
  | { type: 'MOVE_ROBBER'; tileId: string; stealFromPlayerId?: string }
  | { type: 'DISCARD'; resources: Partial<Record<Resource, number>> }
  | { type: 'BANK_TRADE'; give: Resource; want: Resource; giveCount: number }
  | { type: 'OFFER_TRADE'; give: Partial<Record<Resource, number>>; want: Partial<Record<Resource, number>> }
  | { type: 'RESPOND_TRADE'; tradeId: string; accept: boolean }
  | { type: 'EXECUTE_TRADE'; tradeId: string; withPlayerId: string }
  | { type: 'CANCEL_TRADE'; tradeId: string }
  | { type: 'END_TURN' };

export type ActionResult =
  | { ok: true; state: import('./types.js').GameState }
  | { ok: false; error: string };
