import { useEffect, useMemo, useState } from 'react';
import type { Action } from '../../shared/actions.js';
import type { ClientGameState } from '../../shared/protocol.js';
import { useConnection } from './connection.js';
import { HomeScreen } from './components/HomeScreen.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import { BoardView } from './components/BoardView.js';
import { PlayerDock } from './components/PlayerDock.js';
import { HandPanel } from './components/HandPanel.js';
import { ActionBar } from './components/ActionBar.js';
import { TradePanel } from './components/TradePanel.js';
import { DiscardModal } from './components/DiscardModal.js';
import { EventLog } from './components/EventLog.js';
import {
  type BuildMode,
  eligibleStealTargets,
  legalCityVertices,
  legalRoadEdges,
  legalRobberTiles,
  legalSettlementVertices,
  legalSetupRoads,
  legalSetupVertices,
} from './legalMoves.js';

export default function App() {
  const { state: conn, send, clearActionError } = useConnection();
  const [buildMode, setBuildMode] = useState<BuildMode>(null);
  const [pendingSetupVertex, setPendingSetupVertex] = useState<string | null>(null);
  const [roadBuildingEdges, setRoadBuildingEdges] = useState<string[]>([]);
  const [showTrade, setShowTrade] = useState(false);
  const [stealChoice, setStealChoice] = useState<{ tileId: string; via: 'robberMove' | 'robberKnight'; options: string[] } | null>(
    null
  );

  const state = conn.gameState;
  const selfId = conn.playerId;

  // Surface an incoming trade offer automatically instead of making
  // everyone remember to click "Trade" to notice one exists.
  const activeTradeId = state?.activeTrade?.id ?? null;
  useEffect(() => {
    if (activeTradeId) setShowTrade(true);
  }, [activeTradeId]);

  const legalTargets = useMemo(() => {
    if (!state || !selfId) return { vertices: null, edges: null, tiles: null } as const;
    if (state.phase === 'setup') {
      if (state.setupQueue[0] !== selfId) return { vertices: null, edges: null, tiles: null } as const;
      if (pendingSetupVertex) return { vertices: null, edges: legalSetupRoads(state, pendingSetupVertex), tiles: null };
      return { vertices: legalSetupVertices(state), edges: null, tiles: null };
    }
    if (buildMode === 'road' || buildMode === 'roadBuilding') return { vertices: null, edges: legalRoadEdges(state, selfId), tiles: null };
    if (buildMode === 'settlement') return { vertices: legalSettlementVertices(state, selfId), edges: null, tiles: null };
    if (buildMode === 'city') return { vertices: legalCityVertices(state, selfId), edges: null, tiles: null };
    if (buildMode === 'robberMove' || buildMode === 'robberKnight') return { vertices: null, edges: null, tiles: legalRobberTiles(state) };
    if (state.phase === 'robberMove' && state.pendingRobberPlayerId === selfId) {
      return { vertices: null, edges: null, tiles: legalRobberTiles(state) };
    }
    return { vertices: null, edges: null, tiles: null } as const;
  }, [state, selfId, buildMode, pendingSetupVertex]);

  if (conn.status === 'connecting') {
    return <Centered>Connecting...</Centered>;
  }
  if (!selfId) {
    return <HomeScreen send={send} error={conn.error} />;
  }
  if (!state) {
    return conn.lobby ? <LobbyScreen lobby={conn.lobby} selfId={selfId} send={send} /> : <Centered>Loading lobby...</Centered>;
  }

  function dispatch(action: Action) {
    send({ type: 'ACTION', action });
    setBuildMode(null);
    setPendingSetupVertex(null);
    setRoadBuildingEdges([]);
    setStealChoice(null);
  }

  function resolveRobberAction(tileId: string, via: 'robberMove' | 'robberKnight', stealFromPlayerId?: string) {
    if (via === 'robberMove') dispatch({ type: 'MOVE_ROBBER', tileId, stealFromPlayerId });
    else dispatch({ type: 'PLAY_KNIGHT', tileId, stealFromPlayerId });
  }

  function handleTileClick(tileId: string) {
    if (!state) return;
    const via: 'robberMove' | 'robberKnight' | null =
      buildMode === 'robberKnight' ? 'robberKnight' : buildMode === 'robberMove' || (state.phase === 'robberMove' && state.pendingRobberPlayerId === selfId) ? 'robberMove' : null;
    if (!via) return;
    const options = eligibleStealTargets(state, tileId, selfId!);
    if (options.length === 0) resolveRobberAction(tileId, via);
    else if (options.length === 1) resolveRobberAction(tileId, via, options[0]);
    else setStealChoice({ tileId, via, options });
  }

  function handleVertexClick(vertexId: string) {
    if (!state) return;
    if (state.phase === 'setup') {
      setPendingSetupVertex(vertexId);
      return;
    }
    if (buildMode === 'settlement') dispatch({ type: 'BUILD_SETTLEMENT', vertexId });
    if (buildMode === 'city') dispatch({ type: 'BUILD_CITY', vertexId });
  }

  function handleEdgeClick(edgeId: string) {
    if (!state) return;
    if (state.phase === 'setup' && pendingSetupVertex) {
      dispatch({ type: 'PLACE_SETUP_PIECE', settlementVertexId: pendingSetupVertex, roadEdgeId: edgeId });
      return;
    }
    if (buildMode === 'road') {
      dispatch({ type: 'BUILD_ROAD', edgeId });
      return;
    }
    if (buildMode === 'roadBuilding') {
      const next = [...roadBuildingEdges, edgeId];
      setRoadBuildingEdges(next);
      if (next.length >= 2) {
        dispatch({ type: 'PLAY_ROAD_BUILDING', edgeIds: next });
      }
      return;
    }
  }

  const self = state.players.find((p) => p.id === selfId);
  const needsToDiscard = state.phase === 'robberDiscard' && state.discardQueue.includes(selfId!);
  const isGameOver = state.phase === 'gameOver';
  const winner = state.players.find((p) => p.id === state.winnerId);
  const isMyTurn = state.players[state.currentPlayerIndex]?.id === selfId;

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '12px 16px 32px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 20, margin: '6px 0' }}>🏝️ Catan LAN — Room {state.roomCode}</h1>
        <PhaseBadge state={state} isMyTurn={isMyTurn} />
      </header>

      <PlayerDock state={state} />

      {isGameOver && winner && (
        <div
          style={{
            padding: 18,
            background: 'var(--accent-light)',
            border: '1px solid var(--accent)',
            borderRadius: 10,
            textAlign: 'center',
            margin: '10px 0',
          }}
        >
          <h2 style={{ margin: 0 }}>🏆 {winner.name} wins!</h2>
        </div>
      )}

      {state.phase === 'setup' && (
        <div style={hintStyle}>
          {state.setupQueue[0] === selfId
            ? pendingSetupVertex
              ? '👉 Now click a road spot next to your new settlement.'
              : '👉 Click an empty spot to place your settlement.'
            : `Waiting for ${state.players.find((p) => p.id === state.setupQueue[0])?.name ?? 'the next player'} to place a settlement...`}
        </div>
      )}

      {activeTradeId && !showTrade && (
        <button style={{ ...hintStyle, ...clickableHint }} onClick={() => setShowTrade(true)}>
          🔁 There's an active trade offer — click to view it
        </button>
      )}

      <div style={cardStyle}>
        <BoardView
          state={state}
          legalVertexIds={legalTargets.vertices}
          legalEdgeIds={legalTargets.edges}
          legalTileIds={legalTargets.tiles}
          onVertexClick={handleVertexClick}
          onEdgeClick={handleEdgeClick}
          onTileClick={handleTileClick}
        />
      </div>

      {!isGameOver && self && (
        <ActionBar state={state} selfId={selfId!} buildMode={buildMode} setBuildMode={setBuildMode} dispatch={dispatch} onOpenTrade={() => setShowTrade(true)} />
      )}

      {self && <HandPanel state={state} selfId={selfId!} />}

      {conn.actionError && (
        <div style={errorBannerStyle}>
          <span>⚠️ {conn.actionError}</span>
          <button onClick={clearActionError} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}>
            ✕
          </button>
        </div>
      )}

      <EventLog state={state} />

      {showTrade && !isGameOver && <TradePanel state={state} selfId={selfId!} dispatch={dispatch} onClose={() => setShowTrade(false)} />}
      {needsToDiscard && <DiscardModal state={state} selfId={selfId!} dispatch={dispatch} />}

      {stealChoice && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>Steal from whom?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stealChoice.options.map((playerId) => {
                const player = state.players.find((p) => p.id === playerId)!;
                return (
                  <button
                    key={playerId}
                    style={enabledBtn}
                    onClick={() => resolveRobberAction(stealChoice.tileId, stealChoice.via, playerId)}
                  >
                    🎴 {player.name} ({player.resourceCount} cards)
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseBadge({ state, isMyTurn }: { state: ClientGameState; isMyTurn: boolean }) {
  if (state.phase === 'gameOver') return null;
  const label = isMyTurn ? "Your turn" : `${state.players[state.currentPlayerIndex]?.name}'s turn`;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: 999,
        background: isMyTurn ? 'var(--accent)' : 'var(--border)',
        color: isMyTurn ? '#fff' : 'var(--text-muted)',
      }}
    >
      {label}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>{children}</div>;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 8,
  margin: '8px 0',
};

const hintStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  padding: '8px 12px',
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  margin: '8px 0',
};

const clickableHint: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  color: 'var(--accent)',
  fontWeight: 600,
};

const errorBannerStyle: React.CSSProperties = {
  color: '#a00',
  fontSize: 13,
  padding: '8px 12px',
  background: '#fdecec',
  border: '1px solid #f3b8b8',
  borderRadius: 8,
  margin: '8px 0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 40,
};

const panelStyle: React.CSSProperties = { background: '#fff', borderRadius: 10, padding: 20, width: 'min(90vw, 380px)' };

const enabledBtn: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #2f6b3a',
  background: '#fff',
  color: '#2f6b3a',
  cursor: 'pointer',
  fontSize: 13,
};
