import type { Action } from './actions.js';
import type { DevCard, GameState, Player, PlayerCount, Resource } from './types.js';

export interface ClientPlayerView extends Omit<Player, 'resources' | 'devCards'> {
  isSelf: boolean;
  resourceCount: number;
  devCardCount: number;
  /** Only populated when isSelf is true. */
  resources: Record<Resource, number> | null;
  devCards: DevCard[] | null;
}

export interface ClientGameState extends Omit<GameState, 'players' | 'devDeck'> {
  players: ClientPlayerView[];
  devDeckCount: number;
}

export function toClientGameState(state: GameState, viewerPlayerId: string): ClientGameState {
  const { players, devDeck, ...rest } = state;
  return {
    ...rest,
    devDeckCount: devDeck.length,
    players: players.map((p) => {
      const isSelf = p.id === viewerPlayerId;
      const totalResources = Object.values(p.resources).reduce((a, b) => a + b, 0);
      const { resources, devCards, ...publicFields } = p;
      return {
        ...publicFields,
        isSelf,
        resourceCount: totalResources,
        devCardCount: p.devCards.length,
        resources: isSelf ? resources : null,
        devCards: isSelf ? devCards : null,
      };
    }),
  };
}

export interface LobbyPlayerView {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  isHost: boolean;
}

export interface LobbyState {
  roomCode: string;
  playerCount: PlayerCount;
  hostId: string;
  players: LobbyPlayerView[];
}

export type ClientMessage =
  | { type: 'CREATE_ROOM'; name: string; color: string; playerCount: PlayerCount }
  | { type: 'JOIN_ROOM'; roomCode: string; name: string; color: string }
  | { type: 'RECONNECT'; roomCode: string; playerId: string; playerToken: string }
  | { type: 'START_GAME' }
  | { type: 'ACTION'; action: Action }
  | { type: 'PING' };

export type ServerMessage =
  | { type: 'JOINED'; roomCode: string; playerId: string; playerToken: string }
  | { type: 'LOBBY_STATE'; lobby: LobbyState }
  | { type: 'GAME_STATE'; state: ClientGameState }
  | { type: 'ACTION_ERROR'; error: string }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG' };
