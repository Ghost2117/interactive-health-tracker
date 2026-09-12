import { generateBoard, findRobberStartTile } from './board.js';
import { BANK_SUPPLY, buildDevDeck, ROADS_PER_PLAYER, SETTLEMENTS_PER_PLAYER, CITIES_PER_PLAYER } from './decks.js';
import { type Rng, shuffle } from './rng.js';
import { DEFAULT_VP_TARGET, emptyResourceCount, type GameState, type Player, type PlayerCount } from './types.js';

export interface NewPlayerInfo {
  id: string;
  name: string;
  color: string;
}

export interface CreateGameOptions {
  roomCode: string;
  playerCount: PlayerCount;
  players: NewPlayerInfo[];
  rng: Rng;
  fairLayout?: boolean;
  vpTarget?: number;
}

/** Snake-draft setup order: 0,1,..,n-1,n-1,..,1,0 (second settlement gets starting resources). */
function buildSetupQueue(playerIds: string[]): string[] {
  return [...playerIds, ...[...playerIds].reverse()];
}

export function createGame(options: CreateGameOptions): GameState {
  const { roomCode, playerCount, players, rng, fairLayout = true, vpTarget = DEFAULT_VP_TARGET } = options;

  if (players.length !== playerCount) {
    throw new Error(`Expected ${playerCount} players, got ${players.length}`);
  }

  const board = generateBoard(playerCount, { rng, fairLayout });
  const robberTileId = findRobberStartTile(board);

  const seatOrder = shuffle(players, rng);
  const gamePlayers: Player[] = seatOrder.map((p, seat) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    seat,
    resources: emptyResourceCount(),
    devCards: [],
    playedDevCardThisTurn: false,
    knightsPlayed: 0,
    roadsLeft: ROADS_PER_PLAYER,
    settlementsLeft: SETTLEMENTS_PER_PLAYER,
    citiesLeft: CITIES_PER_PLAYER,
    connected: true,
  }));

  const bankAmount = BANK_SUPPLY[playerCount];
  const bank = {
    brick: bankAmount,
    lumber: bankAmount,
    ore: bankAmount,
    grain: bankAmount,
    wool: bankAmount,
  };

  const devDeck = shuffle(buildDevDeck(playerCount), rng);

  return {
    roomCode,
    playerCount,
    phase: 'setup',
    board,
    robberTileId,
    players: gamePlayers,
    currentPlayerIndex: 0,
    turnNumber: 0,
    dice: null,
    bank,
    devDeck,
    buildings: {},
    roads: {},
    longestRoad: null,
    largestArmy: null,
    setupQueue: buildSetupQueue(gamePlayers.map((p) => p.id)),
    pendingRobberPlayerId: null,
    discardQueue: [],
    activeTrade: null,
    specialBuildQueue: null,
    postSpecialBuildingIndex: null,
    winnerId: null,
    log: [`Game started with ${playerCount} players.`],
    vpTarget,
  };
}
