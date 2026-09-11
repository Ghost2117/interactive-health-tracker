import { describe, expect, it } from 'vitest';
import { generateBoard, findRobberStartTile } from '../board.js';
import { mulberry32 } from '../rng.js';
import type { PlayerCount } from '../types.js';

describe('generateBoard', () => {
  it.each([4, 5, 6] as PlayerCount[])('produces the right tile count for %i players', (count) => {
    const board = generateBoard(count, { rng: mulberry32(42) });
    expect(board.tiles.length).toBe(count === 4 ? 19 : 30);
  });

  it.each([4, 5, 6] as PlayerCount[])('gives every non-desert tile a number 2-12 excluding 7 (%i players)', (count) => {
    const board = generateBoard(count, { rng: mulberry32(1) });
    for (const tile of board.tiles) {
      if (tile.resource === 'desert') {
        expect(tile.number).toBeNull();
      } else {
        expect(tile.number).toBeGreaterThanOrEqual(2);
        expect(tile.number).toBeLessThanOrEqual(12);
        expect(tile.number).not.toBe(7);
      }
    }
  });

  it('every tile has exactly 6 vertices and 6 edges', () => {
    const board = generateBoard(4, { rng: mulberry32(7) });
    for (const tile of board.tiles) {
      expect(new Set(tile.vertexIds).size).toBe(6);
      expect(new Set(tile.edgeIds).size).toBe(6);
    }
  });

  it('every edge connects exactly two vertices and touches 1-2 tiles', () => {
    const board = generateBoard(4, { rng: mulberry32(7) });
    for (const edge of Object.values(board.edges)) {
      expect(edge.vertexIds.length).toBe(2);
      expect(edge.tileIds.length).toBeGreaterThanOrEqual(1);
      expect(edge.tileIds.length).toBeLessThanOrEqual(2);
    }
  });

  it('every vertex touches 1-3 tiles and is symmetric with its edges', () => {
    const board = generateBoard(4, { rng: mulberry32(7) });
    for (const vertex of Object.values(board.vertices)) {
      expect(vertex.tileIds.length).toBeGreaterThanOrEqual(1);
      expect(vertex.tileIds.length).toBeLessThanOrEqual(3);
      for (const edgeId of vertex.edgeIds) {
        const edge = board.edges[edgeId];
        expect(edge.vertexIds).toContain(vertex.id);
      }
    }
  });

  it('has an interior vertex touching exactly 3 tiles (sanity check on adjacency)', () => {
    const board = generateBoard(4, { rng: mulberry32(7) });
    const maxTouching = Math.max(...Object.values(board.vertices).map((v) => v.tileIds.length));
    expect(maxTouching).toBe(3);
  });

  it('robber starts on a desert tile', () => {
    const board = generateBoard(4, { rng: mulberry32(3) });
    const tileId = findRobberStartTile(board);
    expect(board.tiles.find((t) => t.id === tileId)?.resource).toBe('desert');
  });

  it.each([4, 5, 6] as PlayerCount[])('assigns the expected number of ports for %i players', (count) => {
    const board = generateBoard(count, { rng: mulberry32(9) });
    const expectedTotal = count === 4 ? 9 : 11;
    expect(board.ports.length).toBe(expectedTotal);
    const generic = board.ports.filter((p) => p.type === '3:1').length;
    expect(generic).toBe(count === 4 ? 4 : 6);
    for (const port of board.ports) {
      const edgeExists = Object.values(board.edges).some(
        (e) => e.tileIds.length === 1 && e.vertexIds.includes(port.vertexIds[0]) && e.vertexIds.includes(port.vertexIds[1])
      );
      expect(edgeExists).toBe(true);
    }
  });

  it('avoids placing two 6/8 numbers on adjacent tiles when fairLayout is on', () => {
    const board = generateBoard(4, { rng: mulberry32(123), fairLayout: true });
    const byTile = new Map(board.tiles.map((t) => [t.id, t]));
    for (const tile of board.tiles) {
      if (tile.number !== 6 && tile.number !== 8) continue;
      const neighborIds = new Set<string>();
      for (const vId of tile.vertexIds) {
        for (const otherTileId of board.vertices[vId].tileIds) {
          if (otherTileId !== tile.id) neighborIds.add(otherTileId);
        }
      }
      for (const nId of neighborIds) {
        const n = byTile.get(nId)!;
        expect(n.number === 6 || n.number === 8).toBe(false);
      }
    }
  });

  it('is deterministic given the same rng seed', () => {
    const a = generateBoard(4, { rng: mulberry32(55) });
    const b = generateBoard(4, { rng: mulberry32(55) });
    expect(a.tiles.map((t) => `${t.resource}${t.number}`)).toEqual(b.tiles.map((t) => `${t.resource}${t.number}`));
  });
});
