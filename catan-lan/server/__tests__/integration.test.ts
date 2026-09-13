import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import type { Action, ClientGameState, ClientMessage, PlayerCount, ServerMessage } from '../../shared/index.js';
import { attachGameServer } from '../gameServer.js';
import type { Lobby } from '../lobby.js';

/**
 * End-to-end test: the *real* server module (attachGameServer, exactly what
 * server/index.ts wires up in production) attached to a real HTTP server on
 * an ephemeral port, driven by real WebSocket client sockets. No
 * reimplementation of the protocol handling here — if this file passes, the
 * shipped server code is what was actually exercised.
 */

let httpServer: Server;
let wss: WebSocketServer;
let lobby: Lobby;
let port: number;

beforeEach(async () => {
  httpServer = createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  ({ wss, lobby } = attachGameServer(httpServer));

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

  describe('error handling', () => {
    it('replies with an ERROR instead of crashing on malformed JSON', async () => {
      const client = new TestClient(port);
      await client.waitForOpen();
      client.ws.send('{not valid json');
      const errorMsg = await client.waitFor((m) => m.type === 'ERROR');
      expect(errorMsg).toMatchObject({ type: 'ERROR', message: 'Malformed message' });
      // The connection must still be usable afterwards - not dead.
      client.send({ type: 'CREATE_ROOM', name: 'Alice', color: 'red', playerCount: 4 });
      await client.waitFor((m) => m.type === 'JOINED');
      client.close();
    });

    it('rejects an invalid player count on CREATE_ROOM', async () => {
      const client = new TestClient(port);
      await client.waitForOpen();
      // @ts-expect-error deliberately invalid for the test
      client.send({ type: 'CREATE_ROOM', name: 'Alice', color: 'red', playerCount: 3 });
      const errorMsg = await client.waitFor((m) => m.type === 'ERROR');
      expect(errorMsg).toMatchObject({ type: 'ERROR', message: expect.stringContaining('4, 5, or 6') });
      client.close();
    });

    it('rejects JOIN_ROOM with an unknown room code', async () => {
      const client = new TestClient(port);
      await client.waitForOpen();
      client.send({ type: 'JOIN_ROOM', roomCode: 'ZZZZ', name: 'Bob', color: 'blue' });
      const errorMsg = await client.waitFor((m) => m.type === 'ERROR');
      expect(errorMsg).toMatchObject({ type: 'ERROR', message: expect.stringContaining('No game found') });
      client.close();
    });

    it('rejects JOIN_ROOM once the lobby is full', async () => {
      const clients = await connectPlayers(4);
      const extra = new TestClient(port);
      await extra.waitForOpen();
      extra.send({ type: 'JOIN_ROOM', roomCode: clients[0].roomCode, name: 'Extra', color: 'brown' });
      const errorMsg = await extra.waitFor((m) => m.type === 'ERROR');
      expect(errorMsg).toMatchObject({ type: 'ERROR', message: expect.stringContaining('full') });
      clients.forEach((c) => c.close());
      extra.close();
    });

    it('rejects JOIN_ROOM once the game has already started', async () => {
      const clients = await connectPlayers(4);
      clients[0].send({ type: 'START_GAME' });
      await Promise.all(clients.map((c) => c.waitFor((m) => m.type === 'GAME_STATE')));

      const latecomer = new TestClient(port);
      await latecomer.waitForOpen();
      latecomer.send({ type: 'JOIN_ROOM', roomCode: clients[0].roomCode, name: 'Late', color: 'brown' });
      const errorMsg = await latecomer.waitFor((m) => m.type === 'ERROR');
      expect(errorMsg).toMatchObject({ type: 'ERROR', message: expect.stringContaining('already started') });
      clients.forEach((c) => c.close());
      latecomer.close();
    });

    it('only lets the host start the game', async () => {
      const clients = await connectPlayers(4);
      const nonHost = clients[1];
      nonHost.send({ type: 'START_GAME' });
      const errorMsg = await nonHost.waitFor((m) => m.type === 'ERROR');
      expect(errorMsg).toMatchObject({ type: 'ERROR', message: expect.stringContaining('host') });
      expect(nonHost.messages.some((m) => m.type === 'GAME_STATE')).toBe(false);
      clients.forEach((c) => c.close());
    });

    it('rejects starting with too few players', async () => {
      const clients: TestClient[] = [];
      for (let i = 0; i < 2; i++) {
        const c = new TestClient(port);
        await c.waitForOpen();
        clients.push(c);
      }
      clients[0].send({ type: 'CREATE_ROOM', name: 'Solo', color: 'red', playerCount: 4 });
      await clients[0].waitFor((m) => m.type === 'JOINED');
      clients[0].send({ type: 'START_GAME' });
      const errorMsg = await clients[0].waitFor((m) => m.type === 'ERROR');
      expect(errorMsg).toMatchObject({ type: 'ERROR', message: expect.stringContaining('4 players') });
      clients.forEach((c) => c.close());
    });

    it('rejects RECONNECT with a bad token', async () => {
      const clients = await connectPlayers(4);
      const impostor = new TestClient(port);
      await impostor.waitForOpen();
      impostor.send({ type: 'RECONNECT', roomCode: clients[0].roomCode, playerId: clients[0].playerId, playerToken: 'not-the-real-token' });
      const errorMsg = await impostor.waitFor((m) => m.type === 'ERROR');
      expect(errorMsg).toMatchObject({ type: 'ERROR', message: expect.stringContaining('Could not reconnect') });
      clients.forEach((c) => c.close());
      impostor.close();
    });

    it('responds to PING with PONG', async () => {
      const client = new TestClient(port);
      await client.waitForOpen();
      client.send({ type: 'PING' });
      const pong = await client.waitFor((m) => m.type === 'PONG');
      expect(pong.type).toBe('PONG');
      client.close();
    });
  });

  describe('reconnection', () => {
    it('lets a dropped player resume the same game with their token and see their private hand again', async () => {
      const clients = await connectPlayers(4);
      clients[0].send({ type: 'START_GAME' });
      await Promise.all(clients.map((c) => c.waitFor((m) => m.type === 'GAME_STATE')));

      const dropped = clients[1];
      const { roomCode, playerId } = dropped;
      // The server issues a fresh token in the JOINED reply; grab it from that message.
      const joined = dropped.messages.find((m) => m.type === 'JOINED') as Extract<ServerMessage, { type: 'JOINED' }>;
      dropped.close();
      await new Promise((r) => setTimeout(r, 100));

      const resumed = new TestClient(port);
      await resumed.waitForOpen();
      resumed.send({ type: 'RECONNECT', roomCode, playerId, playerToken: joined.playerToken });
      const joinedAgain = await resumed.waitFor((m) => m.type === 'JOINED');
      expect(joinedAgain).toMatchObject({ type: 'JOINED', playerId });

      const state = await resumed.waitFor((m) => m.type === 'GAME_STATE');
      if (state.type !== 'GAME_STATE') throw new Error('expected GAME_STATE');
      const self = state.state.players.find((p) => p.id === playerId)!;
      expect(self.resources).not.toBeNull(); // private hand visible to its own owner again
      expect(self.connected).toBe(true);

      clients.filter((c) => c !== dropped).forEach((c) => c.close());
      resumed.close();
    });
  });

  describe('duplicate colors and host migration over real sockets', () => {
    it('resolves a duplicate color request to a different color', async () => {
      const host = new TestClient(port);
      await host.waitForOpen();
      host.send({ type: 'CREATE_ROOM', name: 'Alice', color: 'red', playerCount: 4 });
      await host.waitFor((m) => m.type === 'JOINED');

      const bob = new TestClient(port);
      await bob.waitForOpen();
      bob.send({ type: 'JOIN_ROOM', roomCode: host.roomCode, name: 'Bob', color: 'red' });
      await bob.waitFor((m) => m.type === 'JOINED');

      const lobbyMsg = await bob.waitFor((m) => m.type === 'LOBBY_STATE');
      if (lobbyMsg.type !== 'LOBBY_STATE') throw new Error('expected LOBBY_STATE');
      const colors = lobbyMsg.lobby.players.map((p) => p.color);
      expect(new Set(colors).size).toBe(2); // no duplicate

      host.close();
      bob.close();
    });

    it('reassigns the host if the host disconnects before the game starts', async () => {
      const host = new TestClient(port);
      await host.waitForOpen();
      host.send({ type: 'CREATE_ROOM', name: 'Alice', color: 'red', playerCount: 4 });
      await host.waitFor((m) => m.type === 'JOINED');

      const bob = new TestClient(port);
      await bob.waitForOpen();
      bob.send({ type: 'JOIN_ROOM', roomCode: host.roomCode, name: 'Bob', color: 'blue' });
      await bob.waitFor((m) => m.type === 'JOINED');
      bob.messages = [];

      host.close();
      const lobbyMsg = await bob.waitFor((m) => m.type === 'LOBBY_STATE', 3000);
      if (lobbyMsg.type !== 'LOBBY_STATE') throw new Error('expected LOBBY_STATE');
      expect(lobbyMsg.lobby.hostId).toBe(bob.playerId);

      bob.close();
    });
  });

  describe('lobby cleanup', () => {
    it('removes an empty room from the lobby once everyone disconnects', async () => {
      const client = new TestClient(port);
      await client.waitForOpen();
      client.send({ type: 'CREATE_ROOM', name: 'Solo', color: 'red', playerCount: 4 });
      await client.waitFor((m) => m.type === 'JOINED');
      const roomCode = client.roomCode;
      expect(lobby.get(roomCode)).toBeDefined();

      client.close();
      await new Promise((r) => setTimeout(r, 1200)); // removeIfEmpty runs on a 1s timer after close

      expect(lobby.get(roomCode)).toBeUndefined();
    });
  });
});
