import type { DevCardType, PlayerCount, ResourceCount } from './types.js';

export const ROAD_COST: Partial<ResourceCount> = { brick: 1, lumber: 1 };
export const SETTLEMENT_COST: Partial<ResourceCount> = { brick: 1, lumber: 1, grain: 1, wool: 1 };
export const CITY_COST: Partial<ResourceCount> = { ore: 3, grain: 2 };
export const DEV_CARD_COST: Partial<ResourceCount> = { ore: 1, grain: 1, wool: 1 };

export const ROADS_PER_PLAYER = 15;
export const SETTLEMENTS_PER_PLAYER = 5;
export const CITIES_PER_PLAYER = 4;

export const MIN_LONGEST_ROAD = 5;
export const MIN_LARGEST_ARMY = 3;

// Bank supply. Base game ships 19 of each resource; the 5-6p extension adds
// enough cards to comfortably support more players (24 of each is the
// commonly used total once the extension's resource cards are added in).
export const BANK_SUPPLY: Record<PlayerCount, number> = {
  4: 19,
  5: 24,
  6: 24,
};

// Dev card deck composition, matching the physical decks exactly. Base game:
// 25 cards (14 knight, 5 victory point, 2 each of road building/year of
// plenty/monopoly). The 5-6p extension adds 9 cards on top (6 knight, 1 each
// of road building/year of plenty/monopoly) and adds no victory point cards,
// for a 34-card deck.
const DEV_DECK_COMPOSITION: Record<PlayerCount, Record<DevCardType, number>> = {
  4: { knight: 14, victoryPoint: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 },
  5: { knight: 20, victoryPoint: 5, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3 },
  6: { knight: 20, victoryPoint: 5, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3 },
};

export function buildDevDeck(playerCount: PlayerCount): DevCardType[] {
  const composition = DEV_DECK_COMPOSITION[playerCount];
  const deck: DevCardType[] = [];
  for (const [type, count] of Object.entries(composition) as [DevCardType, number][]) {
    for (let i = 0; i < count; i++) deck.push(type);
  }
  return deck;
}
