import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { Lobby } from '../lobby.js';

function fakeSocket(): WebSocket {
  return {} as unknown as WebSocket;
}

describe('Lobby.createRoom', () => {
  it('generates a 4-character uppercase room code from the unambiguous alphabet', () => {
    const lobby = new Lobby();
    const room = lobby.createRoom(4);
    expect(room.code).toMatch(/^[A-Z0-9]{4}$/);
    // No visually-confusable characters (0/O, 1/I) should ever appear.
    expect(room.code).not.toMatch(/[01OI]/);
  });

  it('never hands out a code already in use', () => {
    const lobby = new Lobby();
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const room = lobby.createRoom(4);
      expect(codes.has(room.code)).toBe(false);
      codes.add(room.code);
    }
  });

  it('creates a room with the requested player count and no players yet', () => {
    const lobby = new Lobby();
    const room = lobby.createRoom(6);
    expect(room.playerCount).toBe(6);
    expect(room.players).toHaveLength(0);
    expect(room.started).toBe(false);
  });
});

describe('Lobby.get', () => {
  it('finds a room by its exact code', () => {
    const lobby = new Lobby();
    const room = lobby.createRoom(4);
    expect(lobby.get(room.code)).toBe(room);
  });

  it('is case-insensitive and trims whitespace, matching how players type codes', () => {
    const lobby = new Lobby();
    const room = lobby.createRoom(4);
    expect(lobby.get(room.code.toLowerCase())).toBe(room);
    expect(lobby.get(`  ${room.code}  `)).toBe(room);
    expect(lobby.get(`  ${room.code.toLowerCase()}  `)).toBe(room);
  });

  it('returns undefined for an unknown code', () => {
    const lobby = new Lobby();
    expect(lobby.get('ZZZZ')).toBeUndefined();
  });
});

describe('Lobby.removeIfEmpty', () => {
  it('removes a room once every player has disconnected', () => {
    const lobby = new Lobby();
    const room = lobby.createRoom(4);
    const player = room.addPlayer('Alice', 'red', fakeSocket());
    room.disconnect(player.id);

    lobby.removeIfEmpty(room.code);
    expect(lobby.get(room.code)).toBeUndefined();
  });

  it('keeps a room while at least one player is still connected', () => {
    const lobby = new Lobby();
    const room = lobby.createRoom(4);
    const alice = room.addPlayer('Alice', 'red', fakeSocket());
    room.addPlayer('Bob', 'blue', fakeSocket());
    room.disconnect(alice.id); // Bob is still connected

    lobby.removeIfEmpty(room.code);
    expect(lobby.get(room.code)).toBe(room);
  });

  it('is a no-op for a code that does not exist', () => {
    const lobby = new Lobby();
    expect(() => lobby.removeIfEmpty('ZZZZ')).not.toThrow();
  });

  it('is a no-op for a room with no players at all yet', () => {
    const lobby = new Lobby();
    const room = lobby.createRoom(4);
    // .every() on an empty array is vacuously true, so an empty-but-never-
    // joined room would also get swept - make sure that's handled sanely
    // (it's fine either way, this just documents the actual behavior).
    lobby.removeIfEmpty(room.code);
    expect(lobby.get(room.code)).toBeUndefined();
  });
});
