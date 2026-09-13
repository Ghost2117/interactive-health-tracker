export type Resource = 'brick' | 'lumber' | 'ore' | 'grain' | 'wool';

export const RESOURCES: Resource[] = ['brick', 'lumber', 'ore', 'grain', 'wool'];

export type ResourceCount = Record<Resource, number>;

export function emptyResourceCount(): ResourceCount {
  return { brick: 0, lumber: 0, ore: 0, grain: 0, wool: 0 };
}

export type DevCardType =
  | 'knight'
  | 'roadBuilding'
  | 'yearOfPlenty'
  | 'monopoly'
  | 'victoryPoint';

export type PlayerCount = 4 | 5 | 6;

export type Phase =
  | 'lobby'
  | 'setup'
  | 'roll'
  | 'main'
  | 'robberDiscard'
  | 'robberMove'
  | 'robberSteal'
  | 'specialBuilding'
  | 'gameOver';

export type PortType = '3:1' | Resource;

export interface PortInfo {
  type: PortType;
  vertexIds: [string, string];
}

export interface Tile {
  id: string;
  col: number;
  row: number;
  resource: Resource | 'desert';
  number: number | null;
  vertexIds: string[];
  edgeIds: string[];
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
  tileIds: string[];
  edgeIds: string[];
  adjacentVertexIds: string[];
  port: PortType | null;
}

export interface Edge {
  id: string;
  vertexIds: [string, string];
  tileIds: string[];
}

export interface Board {
  tiles: Tile[];
  vertices: Record<string, Vertex>;
  edges: Record<string, Edge>;
  ports: PortInfo[];
}

export interface DevCard {
  type: DevCardType;
  boughtOnTurn: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  seat: number;
  resources: ResourceCount;
  devCards: DevCard[];
  playedDevCardThisTurn: boolean;
  knightsPlayed: number;
  roadsLeft: number;
  settlementsLeft: number;
  citiesLeft: number;
  connected: boolean;
}

export interface Building {
  playerId: string;
  type: 'settlement' | 'city';
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  give: Partial<ResourceCount>;
  want: Partial<ResourceCount>;
  responses: Record<string, 'pending' | 'accepted' | 'rejected'>;
}

export interface GameState {
  roomCode: string;
  playerCount: PlayerCount;
  phase: Phase;
  board: Board;
  robberTileId: string;
  players: Player[];
  currentPlayerIndex: number;
  turnNumber: number;
  dice: [number, number] | null;
  bank: ResourceCount;
  devDeck: DevCardType[];
  buildings: Record<string, Building>;
  roads: Record<string, string>;
  longestRoad: { playerId: string; length: number } | null;
  largestArmy: { playerId: string; count: number } | null;
  setupQueue: string[];
  pendingRobberPlayerId: string | null;
  discardQueue: string[];
  activeTrade: TradeOffer | null;
  specialBuildQueue: string[] | null;
  /** Index to resume normal turn order at once the 5-6p Special Building Phase drains. */
  postSpecialBuildingIndex: number | null;
  winnerId: string | null;
  log: string[];
  vpTarget: number;
}

export const DEFAULT_VP_TARGET = 10;
