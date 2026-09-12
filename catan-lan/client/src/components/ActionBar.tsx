import { useState } from 'react';
import type { Action } from '../../../shared/actions.js';
import type { ClientGameState } from '../../../shared/protocol.js';
import { RESOURCES, type Resource } from '../../../shared/types.js';
import { DEV_CARD_ICONS, RESOURCE_ICONS, RESOURCE_LABELS } from '../boardColors.js';
import type { BuildMode } from '../legalMoves.js';

const ROAD_COST = { brick: 1, lumber: 1 };
const SETTLEMENT_COST = { brick: 1, lumber: 1, grain: 1, wool: 1 };
const CITY_COST = { ore: 3, grain: 2 };
const DEV_CARD_COST = { ore: 1, grain: 1, wool: 1 };

function affordable(resources: Record<Resource, number> | null, cost: Partial<Record<Resource, number>>): boolean {
  if (!resources) return false;
  return (Object.entries(cost) as [Resource, number][]).every(([r, n]) => resources[r] >= n);
}

function costLabel(cost: Partial<Record<Resource, number>>): string {
  return (Object.entries(cost) as [Resource, number][]).map(([r, n]) => `${RESOURCE_ICONS[r]}×${n}`).join(' ');
}

interface Props {
  state: ClientGameState;
  selfId: string;
  buildMode: BuildMode;
  setBuildMode: (m: BuildMode) => void;
  dispatch: (action: Action) => void;
  onOpenTrade: () => void;
}

export function ActionBar({ state, selfId, buildMode, setBuildMode, dispatch, onOpenTrade }: Props) {
  const [showYearOfPlenty, setShowYearOfPlenty] = useState(false);
  const [showMonopoly, setShowMonopoly] = useState(false);
  const [yopChoice, setYopChoice] = useState<[Resource, Resource]>(['brick', 'brick']);
  const [monopolyChoice, setMonopolyChoice] = useState<Resource>('brick');

  const self = state.players.find((p) => p.id === selfId)!;
  const isMyTurn = state.players[state.currentPlayerIndex].id === selfId;
  const resources = self.resources;

  if (state.phase === 'robberMove' && state.pendingRobberPlayerId === selfId) {
    return (
      <div style={barStyle}>
        <span style={{ fontSize: 13, color: '#555' }}>🦹 You rolled a 7 — click a tile to move the robber.</span>
      </div>
    );
  }

  // Dev cards can be played before or after rolling, but never during the
  // 5-6p Special Building Phase; everything else needs 'main' or SBP.
  const canPlayDevCards = isMyTurn && (state.phase === 'roll' || state.phase === 'main');
  const canBuild = isMyTurn && (state.phase === 'main' || state.phase === 'specialBuilding');
  const canTrade = isMyTurn && state.phase === 'main';

  if (!canPlayDevCards && !canBuild && !(state.phase === 'roll' && isMyTurn)) return null;

  const playableDevCards = new Set((self.devCards ?? []).filter((c) => c.boughtOnTurn !== state.turnNumber).map((c) => c.type));
  const devCardDisabled = self.playedDevCardThisTurn;

  return (
    <div style={barStyle}>
      {state.phase === 'roll' && isMyTurn && (
        <button style={primaryBtn} onClick={() => dispatch({ type: 'ROLL_DICE' })}>
          🎲 Roll Dice
        </button>
      )}

      {canPlayDevCards && (
        <>
          <button
            style={buildMode === 'robberKnight' ? activeBtn : playableDevCards.has('knight') && !devCardDisabled ? enabledBtn : disabledBtn}
            disabled={!playableDevCards.has('knight') || devCardDisabled}
            onClick={() => setBuildMode(buildMode === 'robberKnight' ? null : 'robberKnight')}
          >
            {DEV_CARD_ICONS.knight} Knight
          </button>
          <button
            style={buildMode === 'roadBuilding' ? activeBtn : playableDevCards.has('roadBuilding') && !devCardDisabled ? enabledBtn : disabledBtn}
            disabled={!playableDevCards.has('roadBuilding') || devCardDisabled}
            onClick={() => setBuildMode(buildMode === 'roadBuilding' ? null : 'roadBuilding')}
          >
            {DEV_CARD_ICONS.roadBuilding} Road Building
          </button>
          <button
            style={playableDevCards.has('yearOfPlenty') && !devCardDisabled ? enabledBtn : disabledBtn}
            disabled={!playableDevCards.has('yearOfPlenty') || devCardDisabled}
            onClick={() => setShowYearOfPlenty((s) => !s)}
          >
            {DEV_CARD_ICONS.yearOfPlenty} Year of Plenty
          </button>
          <button
            style={playableDevCards.has('monopoly') && !devCardDisabled ? enabledBtn : disabledBtn}
            disabled={!playableDevCards.has('monopoly') || devCardDisabled}
            onClick={() => setShowMonopoly((s) => !s)}
          >
            {DEV_CARD_ICONS.monopoly} Monopoly
          </button>
        </>
      )}

      {canBuild && (
        <>
          <span style={dividerStyle} />
          <button
            style={buildMode === 'road' ? activeBtn : affordable(resources, ROAD_COST) ? enabledBtn : disabledBtn}
            disabled={!affordable(resources, ROAD_COST)}
            onClick={() => setBuildMode(buildMode === 'road' ? null : 'road')}
          >
            🛣️ Road {costLabel(ROAD_COST)}
          </button>
          <button
            style={buildMode === 'settlement' ? activeBtn : affordable(resources, SETTLEMENT_COST) ? enabledBtn : disabledBtn}
            disabled={!affordable(resources, SETTLEMENT_COST)}
            onClick={() => setBuildMode(buildMode === 'settlement' ? null : 'settlement')}
          >
            🏠 Settlement {costLabel(SETTLEMENT_COST)}
          </button>
          <button
            style={buildMode === 'city' ? activeBtn : affordable(resources, CITY_COST) ? enabledBtn : disabledBtn}
            disabled={!affordable(resources, CITY_COST)}
            onClick={() => setBuildMode(buildMode === 'city' ? null : 'city')}
          >
            🏛️ City {costLabel(CITY_COST)}
          </button>
          <button
            style={affordable(resources, DEV_CARD_COST) && state.devDeckCount > 0 ? enabledBtn : disabledBtn}
            disabled={!affordable(resources, DEV_CARD_COST) || state.devDeckCount === 0}
            onClick={() => dispatch({ type: 'BUY_DEV_CARD' })}
          >
            🃏 Dev Card {costLabel(DEV_CARD_COST)} ({state.devDeckCount} left)
          </button>
        </>
      )}

      {canTrade && (
        <button style={enabledBtn} onClick={onOpenTrade}>
          🔁 Trade
        </button>
      )}

      {canBuild && (
        <button style={{ ...enabledBtn, marginLeft: 'auto' }} onClick={() => dispatch({ type: 'END_TURN' })}>
          {state.phase === 'specialBuilding' ? 'Pass Special Build ⏭️' : 'End Turn ⏭️'}
        </button>
      )}

      {buildMode === 'roadBuilding' && (
        <div style={{ fontSize: 12, color: '#555', width: '100%' }}>
          Click 1-2 road spots on the board, then they'll be built for free.
          <RoadBuildingConfirm onDone={() => setBuildMode(null)} />
        </div>
      )}

      {showYearOfPlenty && (
        <div style={inlineFormStyle}>
          <span>Take:</span>
          <select value={yopChoice[0]} onChange={(e) => setYopChoice([e.target.value as Resource, yopChoice[1]])}>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}
              </option>
            ))}
          </select>
          <select value={yopChoice[1]} onChange={(e) => setYopChoice([yopChoice[0], e.target.value as Resource])}>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            style={enabledBtn}
            onClick={() => {
              dispatch({ type: 'PLAY_YEAR_OF_PLENTY', resources: yopChoice });
              setShowYearOfPlenty(false);
            }}
          >
            Confirm
          </button>
          <button style={ghostBtn} onClick={() => setShowYearOfPlenty(false)}>
            Cancel
          </button>
        </div>
      )}

      {showMonopoly && (
        <div style={inlineFormStyle}>
          <span>Monopolize:</span>
          <select value={monopolyChoice} onChange={(e) => setMonopolyChoice(e.target.value as Resource)}>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            style={enabledBtn}
            onClick={() => {
              dispatch({ type: 'PLAY_MONOPOLY', resource: monopolyChoice });
              setShowMonopoly(false);
            }}
          >
            Confirm
          </button>
          <button style={ghostBtn} onClick={() => setShowMonopoly(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function RoadBuildingConfirm({ onDone }: { onDone: () => void }) {
  // The actual edge selection happens on the board (App tracks it and
  // dispatches PLAY_ROAD_BUILDING once 1-2 edges are picked); this button
  // just lets the player back out of the mode without building anything.
  return (
    <button style={{ ...enabledBtn, marginTop: 4 }} onClick={onDone}>
      Cancel
    </button>
  );
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  padding: '10px 0',
  borderTop: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background: 'var(--border)',
  margin: '0 2px',
};

const inlineFormStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  width: '100%',
  fontSize: 13,
};

const enabledBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #2f6b3a',
  background: '#fff',
  color: '#2f6b3a',
  cursor: 'pointer',
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #ccc',
  background: '#fff',
  color: '#666',
  cursor: 'pointer',
  fontSize: 13,
};

const activeBtn: React.CSSProperties = { ...enabledBtn, background: '#2f6b3a', color: '#fff' };

const disabledBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #ddd',
  background: '#f2f2f2',
  color: '#aaa',
  cursor: 'not-allowed',
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const primaryBtn: React.CSSProperties = { ...enabledBtn, fontSize: 16, padding: '10px 18px', fontWeight: 700 };
