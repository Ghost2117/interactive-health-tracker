import type { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { applyAction, createGame, toClientGameState } from '../shared/index.js';
import type { Action, GameState, LobbyState, PlayerCount, ServerMessage } from '../shared/index.js';
import { mulberry32, randomSeed } from '../shared/rng.js';

export const SEAT_COLORS = ['red', 'blue', 'orange', 'white', 'green', 'brown'];

interface RoomPlayer {
  id: string;
  token: string;
  name: string;
  color: string;
  connected: boolean;
  socket: WebSocket | null;
}

export class Room {
  code: string;
  playerCount: PlayerCount;
  hostId = '';
  players: RoomPlayer[] = [];
  state: GameState | null = null;

  constructor(code: string, playerCount: PlayerCount) {
    this.code = code;
    this.playerCount = playerCount;
  }

  get started(): boolean {
    return this.state !== null;
  }

  isFull(): boolean {
    return this.players.length >= this.playerCount;
  }

  addPlayer(name: string, requestedColor: string, socket: WebSocket): RoomPlayer {
    const color = this.resolveColor(requestedColor);
    const player: RoomPlayer = { id: uuidv4(), token: uuidv4(), name, color, connected: true, socket };
    this.players.push(player);
    if (!this.hostId) this.hostId = player.id;
    return player;
  }

  /** Falls back to the next unused color instead of letting two players end
   *  up visually identical on the board. There are exactly as many colors
   *  (6) as the max player count, so one is always free. */
  private resolveColor(requestedColor: string): string {
    const taken = new Set(this.players.map((p) => p.color));
    if (SEAT_COLORS.includes(requestedColor) && !taken.has(requestedColor)) return requestedColor;
    return SEAT_COLORS.find((c) => !taken.has(c)) ?? requestedColor;
  }

  reconnect(playerId: string, token: string, socket: WebSocket): RoomPlayer | null {
    const player = this.players.find((p) => p.id === playerId && p.token === token);
    if (!player) return null;
    player.socket = socket;
    player.connected = true;
    if (this.state) {
      const gamePlayer = this.state.players.find((p) => p.id === playerId);
      if (gamePlayer) gamePlayer.connected = true;
    }
    return player;
  }

  disconnect(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = false;
      player.socket = null;
    }
    if (this.state) {
      const gamePlayer = this.state.players.find((p) => p.id === playerId);
      if (gamePlayer) gamePlayer.connected = false;
    }
    // If the host drops before the game starts, nobody else can ever start
    // it — hand the host badge to another connected player so the lobby
    // isn't permanently stuck.
    if (!this.started && playerId === this.hostId) {
      const nextHost = this.players.find((p) => p.connected);
      if (nextHost) this.hostId = nextHost.id;
    }
  }

  lobbyState(): LobbyState {
    return {
      roomCode: this.code,
      playerCount: this.playerCount,
      hostId: this.hostId,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        connected: p.connected,
        isHost: p.id === this.hostId,
      })),
    };
  }

  start(): { ok: true } | { ok: false; error: string } {
    if (this.started) return { ok: false, error: 'Game already started' };
    if (this.players.length !== this.playerCount) {
      return { ok: false, error: `Need exactly ${this.playerCount} players to start (have ${this.players.length})` };
    }
    this.state = createGame({
      roomCode: this.code,
      playerCount: this.playerCount,
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
      rng: mulberry32(randomSeed()),
    });
    return { ok: true };
  }

  applyPlayerAction(playerId: string, action: Action): { ok: true } | { ok: false; error: string } {
    if (!this.state) return { ok: false, error: 'The game has not started yet' };
    const result = applyAction(this.state, playerId, action);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    return { ok: true };
  }

  send(playerId: string, message: ServerMessage): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player?.socket && player.socket.readyState === player.socket.OPEN) {
      player.socket.send(JSON.stringify(message));
    }
  }

  broadcastLobby(): void {
    const lobby = this.lobbyState();
    for (const p of this.players) this.send(p.id, { type: 'LOBBY_STATE', lobby });
  }

  broadcastGameState(): void {
    if (!this.state) return;
    for (const p of this.players) {
      this.send(p.id, { type: 'GAME_STATE', state: toClientGameState(this.state, p.id) });
    }
  }

  sendGameStateTo(playerId: string): void {
    if (!this.state) return;
    this.send(playerId, { type: 'GAME_STATE', state: toClientGameState(this.state, playerId) });
  }
}
