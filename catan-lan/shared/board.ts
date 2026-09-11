import type { Board, Edge, PlayerCount, PortInfo, PortType, Resource, Tile, Vertex } from './types.js';
import { type Rng, shuffle } from './rng.js';

/**
 * Board geometry uses "doubled" coordinates: tiles in the same row differ by
 * dcol=2, tiles in adjacent rows differ by dcol=+-1/drow=+-1. Centering each
 * row's columns on 0 keeps parity consistent for any row-length sequence
 * that changes by 1 between consecutive rows (which is all we need: the
 * standard 3-4-5-4-3 board and the 3-4-5-6-5-4-3 5-6 player board), so this
 * generalizes without needing a name-brand coordinate scheme.
 */
const ROW_LENGTHS: Record<PlayerCount, number[]> = {
  4: [3, 4, 5, 4, 3],
  5: [3, 4, 5, 6, 5, 4, 3],
  6: [3, 4, 5, 6, 5, 4, 3],
};

// Resource + number tile composition, matching the official component
// lists exactly (base game: 19 tiles; 5-6 Player Extension adds 11 more
// for 30 total). Physical tile *placement order* isn't reproduced (we
// shuffle digitally instead of dealing physical hexes face-down), only
// the totals, which is an equivalent randomization.
const RESOURCE_COUNTS: Record<PlayerCount, Record<Resource | 'desert', number>> = {
  4: { desert: 1, brick: 3, lumber: 4, ore: 3, grain: 4, wool: 4 },
  5: { desert: 2, brick: 5, lumber: 6, ore: 5, grain: 6, wool: 6 },
  6: { desert: 2, brick: 5, lumber: 6, ore: 5, grain: 6, wool: 6 },
};

const NUMBER_COUNTS: Record<PlayerCount, number[]> = {
  4: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
  5: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12],
  6: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12],
};

// Exact harbor composition per the official component lists. Base game: 4
// generic 3:1 + one 2:1 per resource (9 total). The 5-6 Player Extension
// adds exactly 2 more harbors: 1 more generic 3:1 and a second wool 2:1
// (not one of every resource again) — so the 5-6p total is 5 generic + 6
// resource-specific, with wool appearing twice.
const PORT_COMPOSITION: Record<PlayerCount, PortType[]> = {
  4: ['3:1', '3:1', '3:1', '3:1', 'brick', 'lumber', 'ore', 'grain', 'wool'],
  5: ['3:1', '3:1', '3:1', '3:1', '3:1', 'brick', 'lumber', 'ore', 'grain', 'wool', 'wool'],
  6: ['3:1', '3:1', '3:1', '3:1', '3:1', 'brick', 'lumber', 'ore', 'grain', 'wool', 'wool'],
};

const HEX_SIZE = 100;
const SQRT3 = Math.sqrt(3);

function hexCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * ((SQRT3 * HEX_SIZE) / 2), y: row * (1.5 * HEX_SIZE) };
}

function hexCorners(cx: number, cy: number): Array<{ x: number; y: number }> {
  const corners: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({
      x: Math.round((cx + HEX_SIZE * Math.cos(angle)) * 100) / 100,
      y: Math.round((cy + HEX_SIZE * Math.sin(angle)) * 100) / 100,
    });
  }
  return corners;
}

function vertexKey(p: { x: number; y: number }): string {
  return `${p.x.toFixed(2)}|${p.y.toFixed(2)}`;
}

function edgeKey(a: string, b: string): string {
  return [a, b].sort().join('_');
}

interface TileSkeleton {
  id: string;
  col: number;
  row: number;
  vertexIds: string[];
  edgeIds: string[];
}

/** Builds the tile grid + vertex/edge graph, independent of resource assignment. */
function buildGeometry(playerCount: PlayerCount): {
  tileSkeletons: TileSkeleton[];
  vertices: Record<string, Vertex>;
  edges: Record<string, Edge>;
} {
  const rowLengths = ROW_LENGTHS[playerCount];
  const tileSkeletons: TileSkeleton[] = [];
  const vertices: Record<string, Vertex> = {};
  const edges: Record<string, Edge> = {};
  const vertexKeyToId = new Map<string, string>();
  let vertexCounter = 0;
  let edgeCounter = 0;

  rowLengths.forEach((len, rowIdx) => {
    const startCol = -(len - 1);
    for (let i = 0; i < len; i++) {
      const col = startCol + i * 2;
      const row = rowIdx;
      const id = `t-${col}-${row}`;
      const { x: cx, y: cy } = hexCenter(col, row);
      const corners = hexCorners(cx, cy);

      const cornerVertexIds = corners.map((corner) => {
        const key = vertexKey(corner);
        let vId = vertexKeyToId.get(key);
        if (!vId) {
          vId = `v${vertexCounter++}`;
          vertexKeyToId.set(key, vId);
          vertices[vId] = {
            id: vId,
            x: corner.x,
            y: corner.y,
            tileIds: [],
            edgeIds: [],
            adjacentVertexIds: [],
            port: null,
          };
        }
        const vertex = vertices[vId];
        if (!vertex.tileIds.includes(id)) vertex.tileIds.push(id);
        return vId;
      });

      const tileEdgeIds: string[] = [];
      for (let c = 0; c < 6; c++) {
        const a = cornerVertexIds[c];
        const b = cornerVertexIds[(c + 1) % 6];
        const key = edgeKey(a, b);
        let existing = edges[key];
        if (!existing) {
          existing = { id: `e${edgeCounter++}`, vertexIds: [a, b], tileIds: [] };
          edges[key] = existing;
        }
        if (!existing.tileIds.includes(id)) existing.tileIds.push(id);
        tileEdgeIds.push(existing.id);
        if (!vertices[a].edgeIds.includes(existing.id)) vertices[a].edgeIds.push(existing.id);
        if (!vertices[b].edgeIds.includes(existing.id)) vertices[b].edgeIds.push(existing.id);
        if (!vertices[a].adjacentVertexIds.includes(b)) vertices[a].adjacentVertexIds.push(b);
        if (!vertices[b].adjacentVertexIds.includes(a)) vertices[b].adjacentVertexIds.push(a);
      }

      tileSkeletons.push({ id, col, row, vertexIds: cornerVertexIds, edgeIds: tileEdgeIds });
    }
  });

  // Re-key edges by their assigned id (we keyed the working map by vertex pair).
  const edgesById: Record<string, Edge> = {};
  for (const e of Object.values(edges)) edgesById[e.id] = e;

  return { tileSkeletons, vertices, edges: edgesById };
}

function tileAdjacency(tileSkeletons: TileSkeleton[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const t of tileSkeletons) adjacency.set(t.id, new Set());
  const byVertexPairTile = new Map<string, string[]>();
  for (const t of tileSkeletons) {
    for (let i = 0; i < t.vertexIds.length; i++) {
      const a = t.vertexIds[i];
      const b = t.vertexIds[(i + 1) % t.vertexIds.length];
      const key = edgeKey(a, b);
      const arr = byVertexPairTile.get(key) ?? [];
      arr.push(t.id);
      byVertexPairTile.set(key, arr);
    }
  }
  for (const tileIds of byVertexPairTile.values()) {
    if (tileIds.length === 2) {
      adjacency.get(tileIds[0])!.add(tileIds[1]);
      adjacency.get(tileIds[1])!.add(tileIds[0]);
    }
  }
  return adjacency;
}

function assignResourcesAndNumbers(
  tileSkeletons: TileSkeleton[],
  playerCount: PlayerCount,
  rng: Rng,
  fair: boolean
): { resources: (Resource | 'desert')[]; numbers: (number | null)[] } {
  const counts = RESOURCE_COUNTS[playerCount];
  const resourcePool: (Resource | 'desert')[] = [];
  for (const [res, count] of Object.entries(counts) as [Resource | 'desert', number][]) {
    for (let i = 0; i < count; i++) resourcePool.push(res);
  }

  const adjacency = tileAdjacency(tileSkeletons);
  const maxAttempts = fair ? 200 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const resources = shuffle(resourcePool, rng);
    const numberPool = shuffle(NUMBER_COUNTS[playerCount], rng);
    const numbers: (number | null)[] = [];
    let ni = 0;
    for (const res of resources) {
      numbers.push(res === 'desert' ? null : numberPool[ni++]);
    }

    if (!fair || isFairLayout(tileSkeletons, resources, numbers, adjacency)) {
      return { resources, numbers };
    }
  }

  // Fall back to the last (unchecked) attempt rather than looping forever.
  const resources = shuffle(resourcePool, rng);
  const numberPool = shuffle(NUMBER_COUNTS[playerCount], rng);
  const numbers: (number | null)[] = [];
  let ni = 0;
  for (const res of resources) numbers.push(res === 'desert' ? null : numberPool[ni++]);
  return { resources, numbers };
}

function isFairLayout(
  tileSkeletons: TileSkeleton[],
  resources: (Resource | 'desert')[],
  numbers: (number | null)[],
  adjacency: Map<string, Set<string>>
): boolean {
  const indexById = new Map(tileSkeletons.map((t, i) => [t.id, i]));
  for (const t of tileSkeletons) {
    const idx = indexById.get(t.id)!;
    const num = numbers[idx];
    if (num !== 6 && num !== 8) continue;
    for (const neighborId of adjacency.get(t.id) ?? []) {
      const nIdx = indexById.get(neighborId)!;
      const nNum = numbers[nIdx];
      if (nNum === 6 || nNum === 8) return false;
    }
  }
  return true;
}

function assignPorts(
  tileSkeletons: TileSkeleton[],
  vertices: Record<string, Vertex>,
  edges: Record<string, Edge>,
  playerCount: PlayerCount,
  rng: Rng
): PortInfo[] {
  const boundaryEdges = Object.values(edges).filter((e) => e.tileIds.length === 1);

  const cx = tileSkeletons.reduce((sum, t) => sum + hexCenter(t.col, t.row).x, 0) / tileSkeletons.length;
  const cy = tileSkeletons.reduce((sum, t) => sum + hexCenter(t.col, t.row).y, 0) / tileSkeletons.length;

  const ordered = boundaryEdges
    .map((e) => {
      const [a, b] = e.vertexIds;
      const mx = (vertices[a].x + vertices[b].x) / 2;
      const my = (vertices[a].y + vertices[b].y) / 2;
      return { edge: e, angle: Math.atan2(my - cy, mx - cx) };
    })
    .sort((x, y) => x.angle - y.angle)
    .map((x) => x.edge);

  const totalPorts = PORT_COMPOSITION[playerCount].length;
  const shuffledTypes = shuffle(PORT_COMPOSITION[playerCount], rng);

  const ports: PortInfo[] = [];
  const step = ordered.length / totalPorts;
  const usedVertexIds = new Set<string>();
  let typeIdx = 0;
  for (let i = 0; i < totalPorts && typeIdx < shuffledTypes.length; i++) {
    const edge = ordered[Math.floor(i * step) % ordered.length];
    const [a, b] = edge.vertexIds;
    if (usedVertexIds.has(a) || usedVertexIds.has(b)) continue;
    const type = shuffledTypes[typeIdx++];
    vertices[a].port = type;
    vertices[b].port = type;
    usedVertexIds.add(a);
    usedVertexIds.add(b);
    ports.push({ type, vertexIds: [a, b] });
  }
  return ports;
}

export interface GenerateBoardOptions {
  rng: Rng;
  fairLayout?: boolean;
}

export function generateBoard(playerCount: PlayerCount, options: GenerateBoardOptions): Board {
  const { rng, fairLayout = true } = options;
  const { tileSkeletons, vertices, edges } = buildGeometry(playerCount);
  const { resources, numbers } = assignResourcesAndNumbers(tileSkeletons, playerCount, rng, fairLayout);

  const tiles: Tile[] = tileSkeletons.map((skeleton, i) => ({
    id: skeleton.id,
    col: skeleton.col,
    row: skeleton.row,
    resource: resources[i],
    number: numbers[i],
    vertexIds: skeleton.vertexIds,
    edgeIds: skeleton.edgeIds,
  }));

  const ports = assignPorts(tileSkeletons, vertices, edges, playerCount, rng);

  return { tiles, vertices, edges, ports };
}

export function findRobberStartTile(board: Board): string {
  const desert = board.tiles.find((t) => t.resource === 'desert');
  if (!desert) throw new Error('Board has no desert tile for the robber to start on');
  return desert.id;
}

export function tilesTouchingVertex(board: Board, vertexId: string): Tile[] {
  const vertex = board.vertices[vertexId];
  return vertex.tileIds.map((id) => board.tiles.find((t) => t.id === id)!).filter(Boolean);
}

export function edgeConnectsToVertex(edge: Edge, vertexId: string): boolean {
  return edge.vertexIds[0] === vertexId || edge.vertexIds[1] === vertexId;
}

export function otherVertexOfEdge(edge: Edge, vertexId: string): string {
  return edge.vertexIds[0] === vertexId ? edge.vertexIds[1] : edge.vertexIds[0];
}
