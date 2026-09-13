import { describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { Room, SEAT_COLORS } from '../room.js';

// These tests only touch Room's bookkeeping (colors, host assignment), never
// actually sending anything, so a minimal stand-in is enough for the socket
// parameter — no real network connection needed.
function fakeSocket(): WebSocket {
  return {} as unknown as WebSocket;
}

describe('Room player colors', () => {
  it('uses the requested color when it is free', () => {
    const room = new Room('TEST', 4);
    const player = room.addPlayer('Alice', 'blue', fakeSocket());
    expect(player.color).toBe('blue');
  });

  it('falls back to a different color when the requested one is taken', () => {
    const room = new Room('TEST', 4);
    room.addPlayer('Alice', 'red', fakeSocket());
    const bob = room.addPlayer('Bob', 'red', fakeSocket());
    expect(bob.color).not.toBe('red');
    expect(SEAT_COLORS).toContain(bob.color);
  });

  it('never assigns two players the same color, even across many joins', () => {
    const room = new Room('TEST', 6);
    const players = Array.from({ length: 6 }, (_, i) => room.addPlayer(`P${i}`, 'red', fakeSocket()));
    const colors = players.map((p) => p.color);
    expect(new Set(colors).size).toBe(6);
  });
});

describe('Room host migration', () => {
  it('keeps the same host when a non-host player disconnects', () => {
    const room = new Room('TEST', 4);
    const host = room.addPlayer('Host', 'red', fakeSocket());
    const other = room.addPlayer('Other', 'blue', fakeSocket());
    room.disconnect(other.id);
    expect(room.hostId).toBe(host.id);
  });

  it('hands the host badge to another connected player if the host disconnects before the game starts', () => {
    const room = new Room('TEST', 4);
    const host = room.addPlayer('Host', 'red', fakeSocket());
    const other = room.addPlayer('Other', 'blue', fakeSocket());
    room.disconnect(host.id);
    expect(room.hostId).toBe(other.id);
    expect(room.lobbyState().players.find((p) => p.id === other.id)?.isHost).toBe(true);
  });

  it('picks a connected player for the new host, skipping other disconnected players', () => {
    const room = new Room('TEST', 4);
    const host = room.addPlayer('Host', 'red', fakeSocket());
    const disconnectedFirst = room.addPlayer('AlsoGone', 'blue', fakeSocket());
    const stillHere = room.addPlayer('StillHere', 'green', fakeSocket());
    room.disconnect(disconnectedFirst.id);
    room.disconnect(host.id);
    expect(room.hostId).toBe(stillHere.id);
  });

  it('does not reassign the host once the game has started', () => {
    const room = new Room('TEST', 4);
    const host = room.addPlayer('Host', 'red', fakeSocket());
    room.addPlayer('P2', 'blue', fakeSocket());
    room.addPlayer('P3', 'green', fakeSocket());
    room.addPlayer('P4', 'orange', fakeSocket());
    const result = room.start();
    expect(result.ok).toBe(true);
    room.disconnect(host.id);
    expect(room.hostId).toBe(host.id);
  });
});
