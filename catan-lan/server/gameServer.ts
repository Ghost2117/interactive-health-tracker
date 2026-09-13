import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, PlayerCount } from '../shared/index.js';
import { Lobby } from './lobby.js';

interface ConnState {
  roomCode: string;
  playerId: string;
}

export function isValidPlayerCount(n: unknown): n is PlayerCount {
  return n === 4 || n === 5 || n === 6;
}

/**
 * Wires the Catan game's WebSocket protocol onto an existing HTTP server.
 * Split out from server/index.ts so tests can attach it to a throwaway
 * server on an ephemeral port and exercise the exact same code the real
 * server runs, instead of a hand-reimplemented copy.
 */
export function attachGameServer(httpServer: HttpServer): { lobby: Lobby; wss: WebSocketServer } {
  const lobby = new Lobby();
  const connections = new WeakMap<WebSocket, ConnState>();
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Malformed message' }));
        return;
      }
      handleMessage(ws, message);
    });

    ws.on('close', () => {
      const conn = connections.get(ws);
      if (!conn) return;
      const room = lobby.get(conn.roomCode);
      if (!room) return;
      room.disconnect(conn.playerId);
      if (room.started) room.broadcastGameState();
      else room.broadcastLobby();
      setTimeout(() => lobby.removeIfEmpty(conn.roomCode), 1000);
    });
  });

  function handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'CREATE_ROOM': {
        if (!isValidPlayerCount(message.playerCount)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Player count must be 4, 5, or 6' }));
          return;
        }
        const name = message.name.trim().slice(0, 20) || 'Player';
        const room = lobby.createRoom(message.playerCount);
        const player = room.addPlayer(name, message.color, ws);
        connections.set(ws, { roomCode: room.code, playerId: player.id });
        ws.send(JSON.stringify({ type: 'JOINED', roomCode: room.code, playerId: player.id, playerToken: player.token }));
        room.broadcastLobby();
        return;
      }

      case 'JOIN_ROOM': {
        const room = lobby.get(message.roomCode);
        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR', message: `No game found with code ${message.roomCode}` }));
          return;
        }
        if (room.started) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'That game has already started' }));
          return;
        }
        if (room.isFull()) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'That game lobby is full' }));
          return;
        }
        const name = message.name.trim().slice(0, 20) || 'Player';
        const player = room.addPlayer(name, message.color, ws);
        connections.set(ws, { roomCode: room.code, playerId: player.id });
        ws.send(JSON.stringify({ type: 'JOINED', roomCode: room.code, playerId: player.id, playerToken: player.token }));
        room.broadcastLobby();
        return;
      }

      case 'RECONNECT': {
        const room = lobby.get(message.roomCode);
        const player = room?.reconnect(message.playerId, message.playerToken, ws);
        if (!room || !player) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Could not reconnect to that game' }));
          return;
        }
        connections.set(ws, { roomCode: room.code, playerId: player.id });
        ws.send(JSON.stringify({ type: 'JOINED', roomCode: room.code, playerId: player.id, playerToken: player.token }));
        if (room.started) {
          room.sendGameStateTo(player.id);
          room.broadcastGameState();
        } else {
          room.broadcastLobby();
        }
        return;
      }

      case 'START_GAME': {
        const conn = connections.get(ws);
        if (!conn) return;
        const room = lobby.get(conn.roomCode);
        if (!room) return;
        if (room.hostId !== conn.playerId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Only the host can start the game' }));
          return;
        }
        const result = room.start();
        if (!result.ok) {
          ws.send(JSON.stringify({ type: 'ERROR', message: result.error }));
          return;
        }
        room.broadcastGameState();
        return;
      }

      case 'ACTION': {
        const conn = connections.get(ws);
        if (!conn) return;
        const room = lobby.get(conn.roomCode);
        if (!room) return;
        const result = room.applyPlayerAction(conn.playerId, message.action);
        if (!result.ok) {
          ws.send(JSON.stringify({ type: 'ACTION_ERROR', error: result.error }));
          return;
        }
        room.broadcastGameState();
        return;
      }

      case 'PING': {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }

      default:
        return;
    }
  }

  return { lobby, wss };
}
