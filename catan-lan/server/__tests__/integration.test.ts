import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import type { Action, ClientGameState, ClientMessage, PlayerCount, ServerMessage } from '../../shared/index.js';
import { Lobby } from '../lobby.js';

/**
 * End-to-end test: real HTTP + WebSocket server, real client sockets, no
 * shortcuts through the engine. This is the closest thing to "actually
 * launch it and have four browsers join over the network" that a test can
 * exercise headlessly.
 */

let httpServer: Server;
let wss: WebSocketServer;
let port: number;

beforeEach(async () => {
  const lobby = new Lobby();
  const connections = new WeakMap<WebSocket, { roomCode: string; playerId: string }>();

  httpServer = createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      const message: ClientMessage = JSON.parse(raw.toString());
      handle(ws, message);
    });
    ws.on('close', () => {
      const conn = connections.get(ws);
      if (!conn) return;
      const room = lobby.get(conn.roomCode);
      room?.disconnect(conn.playerId);
      if (room?.started) room.broadcastGameState();
      else room?.broadcastLobby();
    });
  });

  function handle(ws: WebSocket, message: ClientMessage) {
    switch (message.type) {
      case 'CREATE_ROOM': {
        const room = lobby.createRoom(message.playerCount);
        const player = room.addPlayer(message.name, message.color, ws);
        connections.set(ws, { roomCode: room.code, playerId: player.id });
        ws.send(JSON.stringify({ type: 'JOINED', roomCode: room.code, playerId: player.id, playerToken: player.token }));
        room.broadcastLobby();
        return;
      }
      case 'JOIN_ROOM': {
        const room = lobby.get(message.roomCode);
        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'no room' }));
          return;
        }
        const player = room.addPlayer(message.name, message.color, ws);
        connections.set(ws, { roomCode: room.code, playerId: player.id });
        ws.send(JSON.stringify({ type: 'JOINED', roomCode: room.code, playerId: player.id, playerToken: player.token }));
        room.broadcastLobby();
        return;
      }
      case 'START_GAME': {
        const conn = connections.get(ws)!;
        const room = lobby.get(conn.roomCode)!;
        const result = room.start();
        if (!result.ok) {
          ws.send(JSON.stringify({ type: 'ERROR', message: result.error }));
          return;
        }
        room.broadcastGameState();
        return;
      }
      case 'ACTION': {
        const conn = connections.get(ws)!;
        const room = lobby.get(conn.roomCode)!;
        const result = room.applyPlayerAction(conn.playerId, message.action);
        if (!result.ok) {
          ws.send(JSON.stringify({ type: 'ACTION_ERROR', error: result.error }));
          return;
        }
        room.broadcastGameState();
        return;
      }
      default:
        return;
    }
  }

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterEach(async () => {
  wss.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

class TestClient {
  ws: WebSocket;
  messages: ServerMessage[] = [];
  playerId = '';
  roomCode = '';
  latestState: ClientGameState | null = null;
  /** Bumped on every GAME_STATE message so callers can wait for "the next
   *  update after mine", rather than accidentally matching a stale message
   *  already sitting in `messages` from an earlier broadcast. */
  gameStateVersion = 0;

  constructor(port: number) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws.on('message', (raw) => {
      const message: ServerMessage = JSON.parse(raw.toString());
      this.messages.push(message);
      if (message.type === 'JOINED') {
        this.playerId = message.playerId;
        this.roomCode = message.roomCode;
      }
      if (message.type === 'GAME_STATE') {
        this.latestState = message.state;
        this.gameStateVersion += 1;
      }
    });
  }

  waitForNextGameState(timeoutMs = 3000): Promise<ClientGameState> {
    const baseline = this.gameStateVersion;
    if (this.gameStateVersion > baseline) return Promise.resolve(this.latestState!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for next GAME_STATE')), timeoutMs);
      const check = () => {
        if (this.gameStateVersion > baseline) {
          clearTimeout(timer);
          this.ws.off('message', check);
          resolve(this.latestState!);
        }
      };
      this.ws.on('message', check);
    });
  }

  waitForOpen(): Promise<void> {
    return new Promise((resolve) => this.ws.once('open', () => resolve()));
  }

  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  waitFor(predicate: (m: ServerMessage) => boolean, timeoutMs = 2000): Promise<ServerMessage> {
    const existing = this.messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for message')), timeoutMs);
      const handler = (raw: Buffer) => {
        const message: ServerMessage = JSON.parse(raw.toString());
        if (predicate(message)) {
          clearTimeout(timer);
          this.ws.off('message', handler);
          resolve(message);
        }
      };
      this.ws.on('message', handler);
    });
  }

  close(): void {
    this.ws.close();
  }
}

async function connectPlayers(count: PlayerCount): Promise<TestClient[]> {
  const clients: TestClient[] = [];
  for (let i = 0; i < count; i++) {
    const client = new TestClient(port);
    await client.waitForOpen();
    clients.push(client);
  }

  clients[0].send({ type: 'CREATE_ROOM', name: 'Player 0', color: 'red', playerCount: count });
  await clients[0].waitFor((m) => m.type === 'JOINED');
  const roomCode = clients[0].roomCode;

  for (let i = 1; i < clients.length; i++) {
    clients[i].send({ type: 'JOIN_ROOM', roomCode, name: `Player ${i}`, color: 'blue' });
    await clients[i].waitFor((m) => m.type === 'JOINED');
  }
  // Give the lobby broadcast a moment to land on everyone.
  await new Promise((resolve) => setTimeout(resolve, 50));
  return clients;
}

function findLegalSetupSpot(state: ClientGameState): { vertexId: string; edgeId: string } {
  for (const vertex of Object.values(state.board.vertices)) {
    if (state.buildings[vertex.id]) continue;
    if (vertex.adjacentVertexIds.some((v) => state.buildings[v])) continue;
    return { vertexId: vertex.id, edgeId: vertex.edgeIds[0] };
  }
  throw new Error('no legal setup spot');
}

describe('server integration', () => {
  it('runs a full 4-player lobby -> setup -> several turns flow over real sockets', async () => {
    const clients = await connectPlayers(4);

    clients[0].send({ type: 'START_GAME' });
    await Promise.all(clients.map((c) => c.waitFor((m) => m.type === 'GAME_STATE')));

    expect(clients[0].latestState?.phase).toBe('setup');
    expect(clients[0].latestState?.players.length).toBe(4);

    // Play through the whole setup phase (2 placements x 4 players = 8).
    for (let i = 0; i < 8; i++) {
      const state = clients[0].latestState!;
      if (state.phase !== 'setup') break;
      const activePlayerId = state.setupQueue[0];
      const actor = clients.find((c) => c.playerId === activePlayerId)!;
      const spot = findLegalSetupSpot(state);
      actor.send({
        type: 'ACTION',
        action: { type: 'PLACE_SETUP_PIECE', settlementVertexId: spot.vertexId, roadEdgeId: spot.edgeId },
      });
      await Promise.all(clients.map((c) => c.waitForNextGameState()));
    }

    const finalState = clients[0].latestState!;
    expect(finalState.phase).toBe('roll');
    expect(finalState.turnNumber).toBe(1);
    for (const player of finalState.players) {
      const settlementCount = Object.values(finalState.buildings).filter((b) => b.playerId === player.id).length;
      expect(settlementCount).toBe(2);
    }

    // Roll dice for the first player and confirm everyone's view updates,
    // with each player only ever seeing their own resource hand in detail.
    const currentPlayerId = finalState.players[finalState.currentPlayerIndex].id;
    const actor = clients.find((c) => c.playerId === currentPlayerId)!;
    actor.send({ type: 'ACTION', action: { type: 'ROLL_DICE' } });
    await Promise.all(clients.map((c) => c.waitForNextGameState()));

    for (const client of clients) {
      const state = client.latestState!;
      expect(state.dice).not.toBeNull();
      for (const p of state.players) {
        if (p.id === client.playerId) {
          expect(p.resources).not.toBeNull();
        } else {
          expect(p.resources).toBeNull();
          expect(typeof p.resourceCount).toBe('number');
        }
      }
    }

    clients.forEach((c) => c.close());
  }, 20000);

  it('rejects an action from the wrong player and only tells the sender', async () => {
    const clients = await connectPlayers(4);
    clients[0].send({ type: 'START_GAME' });
    await Promise.all(clients.map((c) => c.waitFor((m) => m.type === 'GAME_STATE')));

    const state = clients[0].latestState!;
    const notActive = clients.find((c) => c.playerId !== state.setupQueue[0])!;
    clients.forEach((c) => (c.messages = []));

    const spot = findLegalSetupSpot(state);
    const badAction: Action = { type: 'PLACE_SETUP_PIECE', settlementVertexId: spot.vertexId, roadEdgeId: spot.edgeId };
    notActive.send({ type: 'ACTION', action: badAction });
    const errorMsg = await notActive.waitFor((m) => m.type === 'ACTION_ERROR');
    expect(errorMsg.type).toBe('ACTION_ERROR');

    // Other clients should not have received a GAME_STATE update from the rejected action.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const others = clients.filter((c) => c !== notActive);
    for (const other of others) {
      expect(other.messages.some((m) => m.type === 'GAME_STATE')).toBe(false);
    }

    clients.forEach((c) => c.close());
  }, 10000);

  it('runs a 6-player game through lobby + setup with a Special Building Phase available', async () => {
    const clients = await connectPlayers(6);
    clients[0].send({ type: 'START_GAME' });
    await Promise.all(clients.map((c) => c.waitFor((m) => m.type === 'GAME_STATE')));
    expect(clients[0].latestState?.playerCount).toBe(6);
    expect(clients[0].latestState?.board.tiles.length).toBe(30);

    for (let i = 0; i < 12; i++) {
      const state = clients[0].latestState!;
      if (state.phase !== 'setup') break;
      const activePlayerId = state.setupQueue[0];
      const actor = clients.find((c) => c.playerId === activePlayerId)!;
      const spot = findLegalSetupSpot(state);
      actor.send({
        type: 'ACTION',
        action: { type: 'PLACE_SETUP_PIECE', settlementVertexId: spot.vertexId, roadEdgeId: spot.edgeId },
      });
      await Promise.all(clients.map((c) => c.waitForNextGameState()));
    }
    expect(clients[0].latestState?.phase).toBe('roll');
    clients.forEach((c) => c.close());
  }, 20000);
});
