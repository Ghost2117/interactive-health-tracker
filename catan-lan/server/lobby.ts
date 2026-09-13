import type { PlayerCount } from '../shared/index.js';
import { Room } from './room.js';

// Avoids visually ambiguous characters (0/O, 1/I) in spoken/typed room codes.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export class Lobby {
  private rooms = new Map<string, Room>();

  createRoom(playerCount: PlayerCount): Room {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const room = new Room(code, playerCount);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  removeIfEmpty(code: string): void {
    const room = this.rooms.get(code);
    if (room && room.players.every((p) => !p.connected)) {
      this.rooms.delete(code);
    }
  }
}
