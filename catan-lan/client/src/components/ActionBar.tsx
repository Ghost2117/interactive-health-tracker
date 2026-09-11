import { useState } from 'react';
import type { Action } from '../../../shared/actions.js';
import type { ClientGameState } from '../../../shared/protocol.js';
import { RESOURCES, type Resource } from '../../../shared/types.js';
import type { BuildMode } from '../legalMoves.js';

const ROAD_COST = { brick: 1, lumber: 1 };
const SETTLEMENT_COST = { brick: 1, lumber: 1, grain: 1, wool: 1 };
const CITY_COST = { ore: 3, grain: 2 };
const DEV_CARD_COST = { ore: 1, grain: 1, wool: 1 };

function affordable(resources: Record<Resource, number> | null, cost: Partial<Record<Resource, number>>): boolean {
  if (!resources) return false;
  return (Object.entries(cost) as [Resource, number][]).every(([r, n]) => resources[r] >= n);
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

  if (state.phase === 'roll' && isMyTurn) {
    return (
      <div style={barStyle}>
        <button style={primaryBtn} onClick={() => dispatch({ type: 'ROLL_DICE' })}>
          🎲 Roll Dice
        </button>
      </div>
    );
  }

  if (state.phase === 'robberMove' && state.pendingRobberPlayerId === selfId) {
    return (
      <div style={barStyle}>
        <span style={{ fontSize: 13, color: '#555' }}>You rolled a 7 — click a tile to move the robber.</span>
      </div>
    );
  }

  const canBuild = (state.phase === 'main' || state.phase === 'specialBuilding') && isMyTurn;
  if (!canBuild) return null;

  const playableDevCards = new Set((self.devCards ?? []).filter((c) => c.boughtOnTurn !== state.turnNumber).map((c) => c.type));

  return (
    <div style={barStyle}>
      <button
        style={buildMode === 'road' ? activeBtn : affordable(resources, ROAD_COST) ? enabledBtn : disabledBtn}
        disabled={!affordable(resources, ROAD_COST)}
        onClick={() => setBuildMode(buildMode === 'road' ? null : 'road')}
      >
        Build Road (1 brick, 1 lumber)
      </button>
      <button
        style={buildMode === 'settlement' ? activeBtn : affordable(resources, SETTLEMENT_COST) ? enabledBtn : disabledBtn}
        disabled={!affordable(resources, SETTLEMENT_COST)}
        onClick={() => setBuildMode(buildMode === 'settlement' ? null : 'settlement')}
      >
        Build Settlement
      </button>
      <button
        style={buildMode === 'city' ? activeBtn : affordable(resources, CITY_COST) ? enabledBtn : disabledBtn}
        disabled={!affordable(resources, CITY_COST)}
        onClick={() => setBuildMode(buildMode === 'city' ? null : 'city')}
      >
        Build City (3 ore, 2 grain)
      </button>
      <button
        style={affordable(resources, DEV_CARD_COST) && state.devDeckCount > 0 ? enabledBtn : disabledBtn}
        disabled={!affordable(resources, DEV_CARD_COST) || state.devDeckCount === 0}
        onClick={() => dispatch({ type: 'BUY_DEV_CARD' })}
      >
        Buy Dev Card ({state.devDeckCount} left)
      </button>

      {state.phase === 'main' && (
        <>
          <button
            style={buildMode === 'robberKnight' ? activeBtn : playableDevCards.has('knight') && !self.playedDevCardThisTurn ? enabledBtn : disabledBtn}
            disabled={!playableDevCards.has('knight') || self.playedDevCardThisTurn}
            onClick={() => setBuildMode(buildMode === 'robberKnight' ? null : 'robberKnight')}
          >
            Play Knight
          </button>
          <button
            style={buildMode === 'roadBuilding' ? activeBtn : playableDevCards.has('roadBuilding') && !self.playedDevCardThisTurn ? enabledBtn : disabledBtn}
            disabled={!playableDevCards.has('roadBuilding') || self.playedDevCardThisTurn}
            onClick={() => setBuildMode(buildMode === 'roadBuilding' ? null : 'roadBuilding')}
          >
            Play Road Building
          </button>
          <button
            style={playableDevCards.has('yearOfPlenty') && !self.playedDevCardThisTurn ? enabledBtn : disabledBtn}
            disabled={!playableDevCards.has('yearOfPlenty') || self.playedDevCardThisTurn}
            onClick={() => setShowYearOfPlenty((s) => !s)}
          >
            Play Year of Plenty
          </button>
          <button
            style={playableDevCards.has('monopoly') && !self.playedDevCardThisTurn ? enabledBtn : disabledBtn}
            disabled={!playableDevCards.has('monopoly') || self.playedDevCardThisTurn}
            onClick={() => setShowMonopoly((s) => !s)}
          >
            Play Monopoly
          </button>
          <button style={enabledBtn} onClick={onOpenTrade}>
            Trade
          </button>
        </>
      )}

      <button style={{ ...enabledBtn, marginLeft: 'auto' }} onClick={() => dispatch({ type: 'END_TURN' })}>
        {state.phase === 'specialBuilding' ? 'Pass Special Build' : 'End Turn'}
      </button>

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
                {r}
              </option>
            ))}
          </select>
          <select value={yopChoice[1]} onChange={(e) => setYopChoice([yopChoice[0], e.target.value as Resource])}>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {r}
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
        </div>
      )}

      {showMonopoly && (
        <div style={inlineFormStyle}>
          <span>Monopolize:</span>
          <select value={monopolyChoice} onChange={(e) => setMonopolyChoice(e.target.value as Resource)}>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {r}
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
  borderTop: '1px solid #ddd',
  borderBottom: '1px solid #ddd',
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
};

const activeBtn: React.CSSProperties = { ...enabledBtn, background: '#2f6b3a', color: '#fff' };

const disabledBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #ccc',
  background: '#f0f0f0',
  color: '#999',
  cursor: 'not-allowed',
  fontSize: 13,
};

const primaryBtn: React.CSSProperties = { ...enabledBtn, fontSize: 16, padding: '10px 18px' };
