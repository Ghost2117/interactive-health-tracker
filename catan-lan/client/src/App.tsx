import { useMemo, useState } from 'react';
import type { Action } from '../../shared/actions.js';
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

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 12, fontFamily: 'system-ui, sans-serif' }}>
      <PlayerDock state={state} />

      {isGameOver && winner && (
        <div style={{ padding: 16, background: '#fff7d6', borderRadius: 8, textAlign: 'center', margin: '10px 0' }}>
          <h2 style={{ margin: 0 }}>🏆 {winner.name} wins!</h2>
        </div>
      )}

      {state.phase === 'setup' && (
        <div style={{ fontSize: 13, color: '#555', padding: '4px 0' }}>
          {state.setupQueue[0] === selfId
            ? pendingSetupVertex
              ? 'Now click a road spot next to your new settlement.'
              : 'Click an empty spot to place your settlement.'
            : `Waiting for ${state.players.find((p) => p.id === state.setupQueue[0])?.name ?? 'the next player'} to place a settlement...`}
        </div>
      )}

      <BoardView
        state={state}
        legalVertexIds={legalTargets.vertices}
        legalEdgeIds={legalTargets.edges}
        legalTileIds={legalTargets.tiles}
        onVertexClick={handleVertexClick}
        onEdgeClick={handleEdgeClick}
        onTileClick={handleTileClick}
      />

      {!isGameOver && self && (
        <ActionBar state={state} selfId={selfId!} buildMode={buildMode} setBuildMode={setBuildMode} dispatch={dispatch} onOpenTrade={() => setShowTrade(true)} />
      )}

      {self && <HandPanel state={state} selfId={selfId!} />}

      {conn.actionError && (
        <div style={{ color: '#a00', fontSize: 13, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
          <span>{conn.actionError}</span>
          <button onClick={clearActionError} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
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
                    {player.name} ({player.resourceCount} cards)
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

function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>{children}</div>;
}

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
