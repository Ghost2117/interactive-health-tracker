import { useMemo } from 'react';
import type { ClientGameState } from '../../../shared/protocol.js';
import { PLAYER_COLOR_SWATCH, RESOURCE_COLORS } from '../boardColors.js';

interface Props {
  state: ClientGameState;
  legalVertexIds: Set<string> | null;
  legalEdgeIds: Set<string> | null;
  legalTileIds: Set<string> | null;
  onVertexClick: (vertexId: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onTileClick: (tileId: string) => void;
}

function playerColor(state: ClientGameState, playerId: string): string {
  const player = state.players.find((p) => p.id === playerId);
  return player ? PLAYER_COLOR_SWATCH[player.color] ?? player.color : '#999';
}

export function BoardView({ state, legalVertexIds, legalEdgeIds, legalTileIds, onVertexClick, onEdgeClick, onTileClick }: Props) {
  const { board } = state;

  const bounds = useMemo(() => {
    const xs = Object.values(board.vertices).map((v) => v.x);
    const ys = Object.values(board.vertices).map((v) => v.y);
    const pad = 60;
    return {
      minX: Math.min(...xs) - pad,
      minY: Math.min(...ys) - pad,
      width: Math.max(...xs) - Math.min(...xs) + pad * 2,
      height: Math.max(...ys) - Math.min(...ys) + pad * 2,
    };
  }, [board]);

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
      style={{ width: '100%', height: 'auto', maxHeight: '70vh', touchAction: 'manipulation' }}
    >
      {board.tiles.map((tile) => {
        const points = tile.vertexIds.map((id) => board.vertices[id]).map((v) => `${v.x},${v.y}`).join(' ');
        const cx = tile.vertexIds.reduce((s, id) => s + board.vertices[id].x, 0) / tile.vertexIds.length;
        const cy = tile.vertexIds.reduce((s, id) => s + board.vertices[id].y, 0) / tile.vertexIds.length;
        const isRobber = tile.id === state.robberTileId;
        const isLegal = legalTileIds?.has(tile.id);
        return (
          <g key={tile.id} onClick={() => isLegal && onTileClick(tile.id)} style={{ cursor: isLegal ? 'pointer' : 'default' }}>
            <polygon
              points={points}
              fill={RESOURCE_COLORS[tile.resource]}
              stroke="#3a3a3a"
              strokeWidth={2}
              opacity={isLegal ? 1 : tile.resource === 'desert' ? 1 : 0.92}
            />
            {isLegal && <polygon points={points} fill="#ffffff" opacity={0.25} />}
            {tile.number !== null && (
              <g>
                <circle cx={cx} cy={cy} r={22} fill="#f5ecd7" stroke="#3a3a3a" strokeWidth={1.5} />
                <text
                  x={cx}
                  y={cy + 7}
                  textAnchor="middle"
                  fontSize={22}
                  fontWeight={700}
                  fill={tile.number === 6 || tile.number === 8 ? '#c1372b' : '#2a2a2a'}
                >
                  {tile.number}
                </text>
              </g>
            )}
            {isRobber && <circle cx={cx} cy={cy - 40} r={14} fill="#2a2a2a" stroke="#f5ecd7" strokeWidth={2} />}
          </g>
        );
      })}

      {board.ports.map((port) => {
        const [a, b] = port.vertexIds.map((id) => board.vertices[id]);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={`${a.id}-${b.id}`}>
            <line x1={a.x} y1={a.y} x2={mx} y2={my} stroke="#4a7ab5" strokeWidth={3} strokeDasharray="4 3" />
            <line x1={b.x} y1={b.y} x2={mx} y2={my} stroke="#4a7ab5" strokeWidth={3} strokeDasharray="4 3" />
            <circle cx={mx} cy={my} r={16} fill="#e8f1fb" stroke="#4a7ab5" strokeWidth={1.5} />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2a4a72">
              {port.type === '3:1' ? '3:1' : port.type.slice(0, 2).toUpperCase()}
            </text>
          </g>
        );
      })}

      {Object.entries(board.edges).map(([edgeId, edge]) => {
        const owner = state.roads[edgeId];
        const isLegal = legalEdgeIds?.has(edgeId);
        const [a, b] = edge.vertexIds.map((id) => board.vertices[id]);
        if (!owner && !isLegal) return null;
        return (
          <line
            key={edgeId}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={owner ? playerColor(state, owner) : '#ffffff'}
            strokeWidth={owner ? 8 : 10}
            strokeOpacity={owner ? 1 : 0.5}
            strokeLinecap="round"
            onClick={() => isLegal && onEdgeClick(edgeId)}
            style={{ cursor: isLegal ? 'pointer' : 'default' }}
          />
        );
      })}

      {Object.entries(board.vertices).map(([vertexId, vertex]) => {
        const building = state.buildings[vertexId];
        const isLegal = legalVertexIds?.has(vertexId);
        if (!building && !isLegal) return null;
        return (
          <g key={vertexId} onClick={() => isLegal && onVertexClick(vertexId)} style={{ cursor: isLegal ? 'pointer' : 'default' }}>
            {isLegal && !building && <circle cx={vertex.x} cy={vertex.y} r={12} fill="#ffffff" fillOpacity={0.55} stroke="#333" />}
            {building && building.type === 'settlement' && (
              <circle cx={vertex.x} cy={vertex.y} r={13} fill={playerColor(state, building.playerId)} stroke="#222" strokeWidth={2} />
            )}
            {building && building.type === 'city' && (
              <rect
                x={vertex.x - 14}
                y={vertex.y - 14}
                width={28}
                height={28}
                fill={playerColor(state, building.playerId)}
                stroke="#222"
                strokeWidth={2}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
