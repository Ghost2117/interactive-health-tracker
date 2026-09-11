import type { ClientGameState } from '../../../shared/protocol.js';
import { PLAYER_COLOR_SWATCH } from '../boardColors.js';

function publicVictoryPoints(state: ClientGameState, playerId: string): number {
  let vp = 0;
  for (const b of Object.values(state.buildings)) {
    if (b.playerId !== playerId) continue;
    vp += b.type === 'city' ? 2 : 1;
  }
  if (state.longestRoad?.playerId === playerId) vp += 2;
  if (state.largestArmy?.playerId === playerId) vp += 2;
  return vp;
}

export function PlayerDock({ state }: { state: ClientGameState }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0' }}>
      {state.players.map((p, i) => {
        const isCurrent = i === state.currentPlayerIndex;
        return (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              border: isCurrent ? '2px solid #333' : '1px solid #ccc',
              background: isCurrent ? '#fffbe8' : '#fafafa',
              opacity: p.connected ? 1 : 0.5,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: PLAYER_COLOR_SWATCH[p.color] ?? p.color,
                display: 'inline-block',
                border: '1px solid #333',
              }}
            />
            <strong style={{ fontSize: 13 }}>
              {p.name}
              {p.isSelf ? ' (you)' : ''}
            </strong>
            <span style={{ fontSize: 12, color: '#555' }}>VP {publicVictoryPoints(state, p.id)}</span>
            <span style={{ fontSize: 12, color: '#555' }}>Cards {p.resourceCount}</span>
            <span style={{ fontSize: 12, color: '#555' }}>Dev {p.devCardCount}</span>
            {state.longestRoad?.playerId === p.id && <span title="Longest Road">🛣️</span>}
            {state.largestArmy?.playerId === p.id && <span title="Largest Army">⚔️</span>}
            {!p.connected && <span style={{ fontSize: 11, color: '#a00' }}>offline</span>}
          </div>
        );
      })}
    </div>
  );
}
