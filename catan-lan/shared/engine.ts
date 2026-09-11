import type { Action, ActionResult } from './actions.js';
import { otherVertexOfEdge } from './board.js';
import {
  CITY_COST,
  DEV_CARD_COST,
  MIN_LARGEST_ARMY,
  MIN_LONGEST_ROAD,
  ROAD_COST,
  SETTLEMENT_COST,
} from './decks.js';
import type { Rng } from './rng.js';
import { mulberry32, randomSeed } from './rng.js';
import type { GameState, Player, Resource, ResourceCount, TradeOffer } from './types.js';
import { RESOURCES } from './types.js';

function err(error: string): ActionResult {
  return { ok: false, error };
}

function ok(state: GameState): ActionResult {
  return { ok: true, state };
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function findPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function log(state: GameState, message: string): void {
  state.log.push(message);
  if (state.log.length > 200) state.log.shift();
}

function totalResourceCount(player: Player): number {
  return RESOURCES.reduce((sum, r) => sum + player.resources[r], 0);
}

function canAfford(player: Player, cost: Partial<ResourceCount>): boolean {
  return (Object.entries(cost) as [Resource, number][]).every(([r, n]) => player.resources[r] >= n);
}

function pay(state: GameState, player: Player, cost: Partial<ResourceCount>): void {
  for (const [r, n] of Object.entries(cost) as [Resource, number][]) {
    player.resources[r] -= n;
    state.bank[r] += n;
  }
}

function grantFromBank(state: GameState, player: Player, resource: Resource, amount: number): number {
  const granted = Math.max(0, Math.min(amount, state.bank[resource]));
  state.bank[resource] -= granted;
  player.resources[resource] += granted;
  return granted;
}

export function publicVictoryPoints(state: GameState, player: Player): number {
  let vp = 0;
  for (const building of Object.values(state.buildings)) {
    if (building.playerId !== player.id) continue;
    vp += building.type === 'city' ? 2 : 1;
  }
  if (state.longestRoad?.playerId === player.id) vp += 2;
  if (state.largestArmy?.playerId === player.id) vp += 2;
  return vp;
}

export function totalVictoryPoints(state: GameState, player: Player): number {
  const hiddenVp = player.devCards.filter((c) => c.type === 'victoryPoint').length;
  return publicVictoryPoints(state, player) + hiddenVp;
}

function checkForWinner(state: GameState): void {
  for (const player of state.players) {
    if (totalVictoryPoints(state, player) >= state.vpTarget) {
      state.winnerId = player.id;
      state.phase = 'gameOver';
      log(state, `${player.name} wins with ${totalVictoryPoints(state, player)} victory points!`);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Distance rule / connectivity
// ---------------------------------------------------------------------------

function violatesDistanceRule(state: GameState, vertexId: string): boolean {
  const vertex = state.board.vertices[vertexId];
  if (state.buildings[vertexId]) return true;
  return vertex.adjacentVertexIds.some((v) => !!state.buildings[v]);
}

function vertexTouchesPlayerRoad(state: GameState, playerId: string, vertexId: string): boolean {
  const vertex = state.board.vertices[vertexId];
  return vertex.edgeIds.some((edgeId) => state.roads[edgeId] === playerId);
}

function vertexTouchesPlayerBuilding(state: GameState, playerId: string, vertexId: string): boolean {
  const building = state.buildings[vertexId];
  return !!building && building.playerId === playerId;
}

function edgeConnectsToPlayerNetwork(state: GameState, playerId: string, edgeId: string): boolean {
  const edge = state.board.edges[edgeId];
  return edge.vertexIds.some(
    (v) => vertexTouchesPlayerRoad(state, playerId, v) || vertexTouchesPlayerBuilding(state, playerId, v)
  );
}

// ---------------------------------------------------------------------------
// Longest road / largest army
// ---------------------------------------------------------------------------

function longestRoadLengthForPlayer(state: GameState, playerId: string): number {
  const playerEdgeIds = Object.entries(state.roads)
    .filter(([, owner]) => owner === playerId)
    .map(([edgeId]) => edgeId);
  if (playerEdgeIds.length === 0) return 0;

  const edgesByVertex = new Map<string, string[]>();
  for (const edgeId of playerEdgeIds) {
    const edge = state.board.edges[edgeId];
    for (const v of edge.vertexIds) {
      const arr = edgesByVertex.get(v) ?? [];
      arr.push(edgeId);
      edgesByVertex.set(v, arr);
    }
  }

  function isBlocked(vertexId: string): boolean {
    const building = state.buildings[vertexId];
    return !!building && building.playerId !== playerId;
  }

  function extend(vertexId: string, visited: Set<string>): number {
    if (isBlocked(vertexId)) return 0;
    let best = 0;
    for (const edgeId of edgesByVertex.get(vertexId) ?? []) {
      if (visited.has(edgeId)) continue;
      const edge = state.board.edges[edgeId];
      const next = otherVertexOfEdge(edge, vertexId);
      visited.add(edgeId);
      best = Math.max(best, 1 + extend(next, visited));
      visited.delete(edgeId);
    }
    return best;
  }

  let overallBest = 0;
  for (const vertexId of edgesByVertex.keys()) {
    overallBest = Math.max(overallBest, extend(vertexId, new Set()));
  }
  return overallBest;
}

function recomputeLongestRoad(state: GameState): void {
  const lengths = new Map<string, number>();
  for (const player of state.players) {
    lengths.set(player.id, longestRoadLengthForPlayer(state, player.id));
  }
  const qualifying = [...lengths.entries()].filter(([, len]) => len >= MIN_LONGEST_ROAD);
  if (qualifying.length === 0) {
    if (state.longestRoad) log(state, `No one holds Longest Road anymore.`);
    state.longestRoad = null;
    return;
  }
  const maxLen = Math.max(...qualifying.map(([, len]) => len));
  const topPlayerIds = qualifying.filter(([, len]) => len === maxLen).map(([id]) => id);

  const holderStillTop = state.longestRoad && topPlayerIds.includes(state.longestRoad.playerId);
  if (holderStillTop) {
    state.longestRoad = { playerId: state.longestRoad!.playerId, length: maxLen };
    return;
  }
  if (topPlayerIds.length === 1) {
    const winner = findPlayer(state, topPlayerIds[0])!;
    if (!state.longestRoad || state.longestRoad.playerId !== winner.id) {
      log(state, `${winner.name} takes Longest Road (${maxLen}).`);
    }
    state.longestRoad = { playerId: winner.id, length: maxLen };
  }
  // Tie among non-holders with no previous holder in the tie: leave unclaimed.
}

function recomputeLargestArmy(state: GameState): void {
  const qualifying = state.players.filter((p) => p.knightsPlayed >= MIN_LARGEST_ARMY);
  if (qualifying.length === 0) {
    state.largestArmy = null;
    return;
  }
  const maxCount = Math.max(...qualifying.map((p) => p.knightsPlayed));
  const topPlayers = qualifying.filter((p) => p.knightsPlayed === maxCount);

  const holderStillTop = state.largestArmy && topPlayers.some((p) => p.id === state.largestArmy!.playerId);
  if (holderStillTop) {
    state.largestArmy = { playerId: state.largestArmy!.playerId, count: maxCount };
    return;
  }
  if (topPlayers.length === 1) {
    const winner = topPlayers[0];
    if (!state.largestArmy || state.largestArmy.playerId !== winner.id) {
      log(state, `${winner.name} takes Largest Army (${maxCount}).`);
    }
    state.largestArmy = { playerId: winner.id, count: maxCount };
  }
}

// ---------------------------------------------------------------------------
// Dice / production
// ---------------------------------------------------------------------------

function rollDie(rng: Rng): number {
  return Math.floor(rng() * 6) + 1;
}

function distributeProduction(state: GameState, diceSum: number): void {
  const demand = new Map<Resource, Map<string, number>>();
  for (const r of RESOURCES) demand.set(r, new Map());

  for (const tile of state.board.tiles) {
    if (tile.number !== diceSum) continue;
    if (tile.id === state.robberTileId) continue;
    if (tile.resource === 'desert') continue;
    for (const vertexId of tile.vertexIds) {
      const building = state.buildings[vertexId];
      if (!building) continue;
      const amount = building.type === 'city' ? 2 : 1;
      const byPlayer = demand.get(tile.resource)!;
      byPlayer.set(building.playerId, (byPlayer.get(building.playerId) ?? 0) + amount);
    }
  }

  for (const resource of RESOURCES) {
    const byPlayer = demand.get(resource)!;
    if (byPlayer.size === 0) continue;
    const totalDemand = [...byPlayer.values()].reduce((a, b) => a + b, 0);
    if (totalDemand > state.bank[resource]) {
      log(state, `Bank is short on ${resource}; no one collects it this roll.`);
      continue;
    }
    for (const [playerId, amount] of byPlayer.entries()) {
      const player = findPlayer(state, playerId)!;
      grantFromBank(state, player, resource, amount);
    }
  }
}

// ---------------------------------------------------------------------------
// Robber
// ---------------------------------------------------------------------------

function eligibleStealTargets(state: GameState, tileId: string, activePlayerId: string): string[] {
  const tile = state.board.tiles.find((t) => t.id === tileId)!;
  const owners = new Set<string>();
  for (const vertexId of tile.vertexIds) {
    const building = state.buildings[vertexId];
    if (building && building.playerId !== activePlayerId) owners.add(building.playerId);
  }
  return [...owners].filter((id) => totalResourceCount(findPlayer(state, id)!) > 0);
}

function performSteal(state: GameState, thief: Player, victimId: string, rng: Rng): void {
  const victim = findPlayer(state, victimId);
  if (!victim) return;
  const pool: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < victim.resources[r]; i++) pool.push(r);
  if (pool.length === 0) return;
  const chosen = pool[Math.floor(rng() * pool.length)];
  victim.resources[chosen] -= 1;
  thief.resources[chosen] += 1;
  log(state, `${thief.name} stole a card from ${victim.name}.`);
}

function moveRobber(
  state: GameState,
  activePlayer: Player,
  tileId: string,
  stealFromPlayerId: string | undefined,
  rng: Rng
): string | null {
  if (!state.board.tiles.some((t) => t.id === tileId)) return `Unknown tile ${tileId}`;
  if (tileId === state.robberTileId) return 'The robber must move to a different tile';

  const eligible = eligibleStealTargets(state, tileId, activePlayer.id);
  if (stealFromPlayerId && !eligible.includes(stealFromPlayerId)) {
    return 'That player cannot be robbed from the new tile';
  }
  if (!stealFromPlayerId && eligible.length > 0) {
    return 'You must choose a player to steal from';
  }

  state.robberTileId = tileId;
  log(state, `${activePlayer.name} moved the robber.`);
  if (stealFromPlayerId) performSteal(state, activePlayer, stealFromPlayerId, rng);
  return null;
}

// ---------------------------------------------------------------------------
// Setup phase
// ---------------------------------------------------------------------------

function handleSetupPlacement(
  state: GameState,
  playerId: string,
  settlementVertexId: string,
  roadEdgeId: string
): ActionResult {
  if (state.setupQueue[0] !== playerId) return err('Not your turn to place a setup piece');
  const player = findPlayer(state, playerId)!;

  if (violatesDistanceRule(state, settlementVertexId)) {
    return err('That spot is occupied or too close to another settlement');
  }
  const edge = state.board.edges[roadEdgeId];
  if (!edge) return err('Unknown road edge');
  if (state.roads[roadEdgeId]) return err('That road spot is already taken');
  if (!edge.vertexIds.includes(settlementVertexId)) {
    return err('The road must be attached to the settlement you just placed');
  }

  const isSecondPlacement = Object.values(state.buildings).some((b) => b.playerId === playerId);

  state.buildings[settlementVertexId] = { playerId, type: 'settlement' };
  player.settlementsLeft -= 1;
  state.roads[roadEdgeId] = playerId;
  player.roadsLeft -= 1;
  log(state, `${player.name} placed their ${isSecondPlacement ? 'second' : 'first'} settlement.`);

  if (isSecondPlacement) {
    const tiles = state.board.tiles.filter((t) => t.vertexIds.includes(settlementVertexId) && t.resource !== 'desert');
    for (const tile of tiles) {
      grantFromBank(state, player, tile.resource as Resource, 1);
    }
  }

  state.setupQueue.shift();
  recomputeLongestRoad(state);

  if (state.setupQueue.length === 0) {
    state.phase = 'roll';
    state.currentPlayerIndex = 0;
    state.turnNumber = 1;
    state.players[0].playedDevCardThisTurn = false;
    log(state, `Setup complete. ${state.players[0].name} goes first.`);
  } else {
    const nextPlayerId = state.setupQueue[0];
    state.currentPlayerIndex = state.players.findIndex((p) => p.id === nextPlayerId);
  }

  return ok(state);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface ApplyActionOptions {
  rng?: Rng;
}

export function applyAction(
  inputState: GameState,
  playerId: string,
  action: Action,
  options: ApplyActionOptions = {}
): ActionResult {
  const rng = options.rng ?? mulberry32(randomSeed());
  const state = clone(inputState);
  const player = findPlayer(state, playerId);
  if (!player) return err('Unknown player');
  if (state.phase === 'gameOver') return err('The game is over');

  switch (action.type) {
    case 'PLACE_SETUP_PIECE': {
      if (state.phase !== 'setup') return err('Not in the setup phase');
      return handleSetupPlacement(state, playerId, action.settlementVertexId, action.roadEdgeId);
    }

    case 'ROLL_DICE': {
      if (state.phase !== 'roll') return err('Not time to roll');
      if (state.players[state.currentPlayerIndex].id !== playerId) return err('Not your turn');
      const d1 = rollDie(rng);
      const d2 = rollDie(rng);
      const sum = d1 + d2;
      state.dice = [d1, d2];
      log(state, `${player.name} rolled ${d1} + ${d2} = ${sum}.`);

      if (sum === 7) {
        state.discardQueue = state.players
          .filter((p) => totalResourceCount(p) > 7)
          .map((p) => p.id);
        state.pendingRobberPlayerId = playerId;
        state.phase = state.discardQueue.length > 0 ? 'robberDiscard' : 'robberMove';
      } else {
        distributeProduction(state, sum);
        state.phase = 'main';
      }
      return ok(state);
    }

    case 'DISCARD': {
      if (state.phase !== 'robberDiscard') return err('No discard is pending');
      if (!state.discardQueue.includes(playerId)) return err('You do not need to discard');
      const total = Object.values(action.resources).reduce((a, b) => a + (b ?? 0), 0);
      const required = Math.floor(totalResourceCount(player) / 2);
      if (total !== required) return err(`You must discard exactly ${required} cards`);
      for (const [r, n] of Object.entries(action.resources) as [Resource, number][]) {
        if (player.resources[r] < n) return err(`You do not have ${n} ${r}`);
      }
      for (const [r, n] of Object.entries(action.resources) as [Resource, number][]) {
        player.resources[r] -= n;
        state.bank[r] += n;
      }
      state.discardQueue = state.discardQueue.filter((id) => id !== playerId);
      log(state, `${player.name} discarded ${required} cards.`);
      if (state.discardQueue.length === 0) {
        state.phase = 'robberMove';
      }
      return ok(state);
    }

    case 'MOVE_ROBBER': {
      if (state.phase !== 'robberMove') return err('The robber cannot be moved right now');
      if (state.pendingRobberPlayerId !== playerId) return err('Not your turn to move the robber');
      const moveErr = moveRobber(state, player, action.tileId, action.stealFromPlayerId, rng);
      if (moveErr) return err(moveErr);
      state.pendingRobberPlayerId = null;
      state.phase = 'main';
      return ok(state);
    }

    default:
      break;
  }

  // Every remaining action requires being the acting player's turn (except
  // RESPOND_TRADE, which by definition comes from someone else) and the
  // right phase for that *kind* of action:
  //  - dev cards may be played before OR after rolling ('roll' or 'main'),
  //    but never during the 5-6p Special Building Phase.
  //  - trading (bank or player) is only allowed in the normal 'main' phase —
  //    officially disallowed during the Special Building Phase.
  //  - building/buying a dev card/ending the turn is allowed in 'main' or
  //    during the Special Building Phase, but not before rolling.
  const inSpecialBuilding = state.phase === 'specialBuilding';
  const DEV_CARD_PLAY_ACTIONS = new Set(['PLAY_KNIGHT', 'PLAY_ROAD_BUILDING', 'PLAY_YEAR_OF_PLENTY', 'PLAY_MONOPOLY']);
  const TRADE_ACTIONS = new Set(['BANK_TRADE', 'OFFER_TRADE', 'RESPOND_TRADE', 'EXECUTE_TRADE', 'CANCEL_TRADE']);

  if (DEV_CARD_PLAY_ACTIONS.has(action.type)) {
    if (state.phase !== 'main' && state.phase !== 'roll') return err('You cannot do that right now');
  } else if (TRADE_ACTIONS.has(action.type)) {
    if (state.phase !== 'main') return err('Trading is not allowed right now');
  } else if (state.phase !== 'main' && !inSpecialBuilding) {
    return err('You cannot do that right now');
  }
  if (action.type !== 'RESPOND_TRADE' && state.players[state.currentPlayerIndex].id !== playerId) {
    return err('Not your turn');
  }

  switch (action.type) {
    case 'BUILD_ROAD': {
      if (player.roadsLeft <= 0) return err('No roads left to build');
      if (state.roads[action.edgeId]) return err('That road is already built');
      if (!edgeConnectsToPlayerNetwork(state, playerId, action.edgeId)) {
        return err('The road must connect to your existing roads or buildings');
      }
      if (!canAfford(player, ROAD_COST)) return err('Not enough resources for a road');
      pay(state, player, ROAD_COST);
      state.roads[action.edgeId] = playerId;
      player.roadsLeft -= 1;
      log(state, `${player.name} built a road.`);
      recomputeLongestRoad(state);
      checkForWinner(state);
      return ok(state);
    }

    case 'BUILD_SETTLEMENT': {
      if (player.settlementsLeft <= 0) return err('No settlements left to build');
      if (violatesDistanceRule(state, action.vertexId)) return err('That spot is occupied or too close to another settlement');
      if (!vertexTouchesPlayerRoad(state, playerId, action.vertexId)) {
        return err('The settlement must connect to one of your roads');
      }
      if (!canAfford(player, SETTLEMENT_COST)) return err('Not enough resources for a settlement');
      pay(state, player, SETTLEMENT_COST);
      state.buildings[action.vertexId] = { playerId, type: 'settlement' };
      player.settlementsLeft -= 1;
      log(state, `${player.name} built a settlement.`);
      recomputeLongestRoad(state);
      checkForWinner(state);
      return ok(state);
    }

    case 'BUILD_CITY': {
      const building = state.buildings[action.vertexId];
      if (!building || building.playerId !== playerId || building.type !== 'settlement') {
        return err('You need your own settlement there to upgrade it');
      }
      if (player.citiesLeft <= 0) return err('No cities left to build');
      if (!canAfford(player, CITY_COST)) return err('Not enough resources for a city');
      pay(state, player, CITY_COST);
      building.type = 'city';
      player.citiesLeft -= 1;
      player.settlementsLeft += 1;
      log(state, `${player.name} upgraded a settlement to a city.`);
      checkForWinner(state);
      return ok(state);
    }

    case 'BUY_DEV_CARD': {
      if (state.devDeck.length === 0) return err('No development cards left');
      if (!canAfford(player, DEV_CARD_COST)) return err('Not enough resources for a development card');
      pay(state, player, DEV_CARD_COST);
      const cardType = state.devDeck.pop()!;
      player.devCards.push({ type: cardType, boughtOnTurn: state.turnNumber });
      log(state, `${player.name} bought a development card.`);
      checkForWinner(state);
      return ok(state);
    }

    case 'PLAY_KNIGHT': {
      if (player.playedDevCardThisTurn) return err('You already played a development card this turn');
      const cardIdx = player.devCards.findIndex((c) => c.type === 'knight' && c.boughtOnTurn !== state.turnNumber);
      if (cardIdx === -1) return err('You have no playable knight card');
      const moveErr = moveRobber(state, player, action.tileId, action.stealFromPlayerId, rng);
      if (moveErr) return err(moveErr);
      player.devCards.splice(cardIdx, 1);
      player.playedDevCardThisTurn = true;
      player.knightsPlayed += 1;
      log(state, `${player.name} played a Knight.`);
      recomputeLargestArmy(state);
      checkForWinner(state);
      return ok(state);
    }

    case 'PLAY_ROAD_BUILDING': {
      if (player.playedDevCardThisTurn) return err('You already played a development card this turn');
      const cardIdx = player.devCards.findIndex((c) => c.type === 'roadBuilding' && c.boughtOnTurn !== state.turnNumber);
      if (cardIdx === -1) return err('You have no playable Road Building card');
      const edgeIds = action.edgeIds.slice(0, 2);
      if (edgeIds.length === 0) return err('Choose at least one road to build');
      if (new Set(edgeIds).size !== edgeIds.length) return err('Choose two different road spots');
      if (edgeIds.length > player.roadsLeft) return err('Not enough road pieces left');
      for (const edgeId of edgeIds) {
        if (state.roads[edgeId]) return err('That road is already built');
      }
      // Each free road must connect to the player's existing network, or
      // chain off the other free road placed in this same action - but at
      // least one of the (up to 2) roads must anchor to the real network.
      const connectsToExisting = (id: string) => edgeConnectsToPlayerNetwork(state, playerId, id);
      const shareVertex = (a: string, b: string) =>
        state.board.edges[a].vertexIds.some((v) => state.board.edges[b].vertexIds.includes(v));
      const anyAnchored = edgeIds.some(connectsToExisting);
      if (!anyAnchored) return err('Road Building roads must connect to your existing roads or buildings');
      for (const edgeId of edgeIds) {
        const otherEdgeId = edgeIds.find((id) => id !== edgeId);
        if (!connectsToExisting(edgeId) && !(otherEdgeId && shareVertex(edgeId, otherEdgeId))) {
          return err('Road Building roads must connect to your existing roads or buildings');
        }
      }
      for (const edgeId of edgeIds) {
        state.roads[edgeId] = playerId;
        player.roadsLeft -= 1;
      }
      player.devCards.splice(cardIdx, 1);
      player.playedDevCardThisTurn = true;
      log(state, `${player.name} played Road Building.`);
      recomputeLongestRoad(state);
      checkForWinner(state);
      return ok(state);
    }

    case 'PLAY_YEAR_OF_PLENTY': {
      if (player.playedDevCardThisTurn) return err('You already played a development card this turn');
      const cardIdx = player.devCards.findIndex((c) => c.type === 'yearOfPlenty' && c.boughtOnTurn !== state.turnNumber);
      if (cardIdx === -1) return err('You have no playable Year of Plenty card');
      player.devCards.splice(cardIdx, 1);
      player.playedDevCardThisTurn = true;
      for (const resource of action.resources) grantFromBank(state, player, resource, 1);
      log(state, `${player.name} played Year of Plenty.`);
      return ok(state);
    }

    case 'PLAY_MONOPOLY': {
      if (player.playedDevCardThisTurn) return err('You already played a development card this turn');
      const cardIdx = player.devCards.findIndex((c) => c.type === 'monopoly' && c.boughtOnTurn !== state.turnNumber);
      if (cardIdx === -1) return err('You have no playable Monopoly card');
      player.devCards.splice(cardIdx, 1);
      player.playedDevCardThisTurn = true;
      let total = 0;
      for (const other of state.players) {
        if (other.id === playerId) continue;
        total += other.resources[action.resource];
        player.resources[action.resource] += other.resources[action.resource];
        other.resources[action.resource] = 0;
      }
      log(state, `${player.name} played Monopoly on ${action.resource} and collected ${total} cards.`);
      return ok(state);
    }

    case 'BANK_TRADE': {
      if (action.give === action.want) return err('Choose two different resources');
      const rate = getBankTradeRate(state, player, action.give);
      if (action.giveCount !== rate) return err(`The rate for that resource is ${rate}:1`);
      if (player.resources[action.give] < action.giveCount) return err('Not enough resources');
      if (state.bank[action.want] < 1) return err('The bank is out of that resource');
      player.resources[action.give] -= action.giveCount;
      state.bank[action.give] += action.giveCount;
      player.resources[action.want] += 1;
      state.bank[action.want] -= 1;
      log(state, `${player.name} traded ${action.giveCount} ${action.give} for 1 ${action.want} with the bank.`);
      return ok(state);
    }

    case 'OFFER_TRADE': {
      if (state.activeTrade) return err('There is already an active trade offer');
      if (!canAfford(player, action.give)) return err('You do not have the resources you are offering');
      const trade: TradeOffer = {
        id: `trade-${state.turnNumber}-${state.log.length}`,
        fromPlayerId: playerId,
        give: action.give,
        want: action.want,
        responses: Object.fromEntries(state.players.filter((p) => p.id !== playerId).map((p) => [p.id, 'pending'])),
      };
      state.activeTrade = trade;
      log(state, `${player.name} proposed a trade.`);
      return ok(state);
    }

    case 'RESPOND_TRADE': {
      const trade = state.activeTrade;
      if (!trade || trade.id !== action.tradeId) return err('That trade is no longer active');
      if (!(playerId in trade.responses)) return err('You are not part of this trade');
      if (action.accept && !canAfford(player, trade.want)) {
        trade.responses[playerId] = 'rejected';
        return err('You do not have the resources requested');
      }
      trade.responses[playerId] = action.accept ? 'accepted' : 'rejected';
      return ok(state);
    }

    case 'EXECUTE_TRADE': {
      const trade = state.activeTrade;
      if (!trade || trade.id !== action.tradeId) return err('That trade is no longer active');
      if (trade.fromPlayerId !== playerId) return err('Only the trade proposer can complete it');
      if (trade.responses[action.withPlayerId] !== 'accepted') return err('That player has not accepted the trade');
      const other = findPlayer(state, action.withPlayerId)!;
      if (!canAfford(player, trade.give) || !canAfford(other, trade.want)) {
        return err('One of the players no longer has the required resources');
      }
      for (const [r, n] of Object.entries(trade.give) as [Resource, number][]) {
        player.resources[r] -= n;
        other.resources[r] += n;
      }
      for (const [r, n] of Object.entries(trade.want) as [Resource, number][]) {
        other.resources[r] -= n;
        player.resources[r] += n;
      }
      log(state, `${player.name} traded with ${other.name}.`);
      state.activeTrade = null;
      return ok(state);
    }

    case 'CANCEL_TRADE': {
      const trade = state.activeTrade;
      if (!trade || trade.id !== action.tradeId) return err('That trade is no longer active');
      if (trade.fromPlayerId !== playerId) return err('Only the trade proposer can cancel it');
      state.activeTrade = null;
      return ok(state);
    }

    case 'END_TURN': {
      return handleEndTurn(state, playerId, inSpecialBuilding);
    }

    default:
      return err(`Unhandled action ${(action as Action).type}`);
  }
}

/** The best available bank/port exchange rate this player has for giving away `give`. */
/**
 * Only needs `board.ports` and `buildings`, so it works for both the
 * authoritative GameState and the redacted ClientGameState the UI has.
 */
export function getBankTradeRate(
  state: Pick<GameState, 'board' | 'buildings'>,
  player: { id: string },
  give: Resource
): number {
  let rate = 4;
  for (const port of state.board.ports) {
    const owned = port.vertexIds.some((v) => state.buildings[v]?.playerId === player.id);
    if (!owned) continue;
    if (port.type === '3:1') rate = Math.min(rate, 3);
    if (port.type === give) rate = Math.min(rate, 2);
  }
  return rate;
}

function handleEndTurn(state: GameState, playerId: string, inSpecialBuilding: boolean): ActionResult {
  state.activeTrade = null;

  if (inSpecialBuilding) {
    const queue = state.specialBuildQueue ?? [];
    const idx = queue.indexOf(playerId);
    if (idx === -1) return err('Not your special building turn');
    queue.splice(idx, 1);
    if (queue.length > 0) {
      state.specialBuildQueue = queue;
      state.currentPlayerIndex = state.players.findIndex((p) => p.id === queue[0]);
    } else {
      state.specialBuildQueue = null;
      state.phase = 'roll';
      state.currentPlayerIndex = state.postSpecialBuildingIndex!;
      state.postSpecialBuildingIndex = null;
      state.turnNumber += 1;
      const next = state.players[state.currentPlayerIndex];
      next.playedDevCardThisTurn = false;
      log(state, `${next.name}'s turn.`);
    }
    return ok(state);
  }

  const player = findPlayer(state, playerId)!;
  log(state, `${player.name} ended their turn.`);

  if (state.playerCount >= 5) {
    const order = state.players.map((p) => p.id);
    const startIdx = state.currentPlayerIndex;
    // Everyone except the player whose turn just ended, in seat order
    // starting right after them and wrapping around.
    const rotated = [...order.slice(startIdx + 1), ...order.slice(0, startIdx)];
    state.specialBuildQueue = rotated;
    state.postSpecialBuildingIndex = (startIdx + 1) % state.players.length;
    state.phase = 'specialBuilding';
    state.currentPlayerIndex = state.players.findIndex((p) => p.id === rotated[0]);
    log(state, `Special Building Phase begins.`);
  } else {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    state.turnNumber += 1;
    state.phase = 'roll';
    const next = state.players[state.currentPlayerIndex];
    next.playedDevCardThisTurn = false;
    log(state, `${next.name}'s turn.`);
  }
  return ok(state);
}
