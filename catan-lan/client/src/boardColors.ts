import type { Resource } from '../../shared/types.js';

export const RESOURCE_COLORS: Record<Resource | 'desert', string> = {
  brick: '#c1633f',
  lumber: '#2f6b3a',
  ore: '#8a8f96',
  grain: '#e3bb3f',
  wool: '#9ac26b',
  desert: '#ddcda0',
};

export const RESOURCE_LABELS: Record<Resource | 'desert', string> = {
  brick: 'Brick',
  lumber: 'Lumber',
  ore: 'Ore',
  grain: 'Grain',
  wool: 'Wool',
  desert: 'Desert',
};

export const RESOURCE_ICONS: Record<Resource, string> = {
  brick: '🧱',
  lumber: '🪵',
  ore: '⛏️',
  grain: '🌾',
  wool: '🐑',
};

export const DEV_CARD_LABELS: Record<string, string> = {
  knight: 'Knight',
  roadBuilding: 'Road Building',
  yearOfPlenty: 'Year of Plenty',
  monopoly: 'Monopoly',
  victoryPoint: 'Victory Point',
};

export const DEV_CARD_ICONS: Record<string, string> = {
  knight: '⚔️',
  roadBuilding: '🛤️',
  yearOfPlenty: '🎁',
  monopoly: '💰',
  victoryPoint: '⭐',
};

export const PLAYER_COLOR_SWATCH: Record<string, string> = {
  red: '#d64545',
  blue: '#3a6bc4',
  orange: '#e08a2c',
  white: '#e8e8e8',
  green: '#3f9e5c',
  brown: '#8a5a3b',
};
