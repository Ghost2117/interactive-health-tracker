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
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 0' }}>
      {state.players.map((p, i) => {
        const isCurrent = i === state.currentPlayerIndex && state.phase !== 'gameOver';
        const swatch = PLAYER_COLOR_SWATCH[p.color] ?? p.color;
        return (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 12px',
              borderRadius: 10,
              border: isCurrent ? `2px solid ${swatch}` : '1px solid var(--border)',
              background: isCurrent ? 'var(--accent-light)' : 'var(--panel)',
              boxShadow: isCurrent ? '0 1px 4px rgba(0,0,0,0.08)' : undefined,
              opacity: p.connected ? 1 : 0.5,
              transition: 'background 0.2s, border 0.2s',
            }}
          >
            {isCurrent && <span aria-hidden>▶</span>}
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: '50%',
                background: swatch,
                display: 'inline-block',
                border: '1px solid #333',
                flexShrink: 0,
              }}
            />
            <strong style={{ fontSize: 13 }}>
              {p.name}
              {p.isSelf ? ' (you)' : ''}
            </strong>
            <span style={statStyle} title="Victory points">
              🏆 {publicVictoryPoints(state, p.id)}
            </span>
            <span style={statStyle} title="Resource cards in hand">
              🎴 {p.resourceCount}
            </span>
            <span style={statStyle} title="Development cards">
              🃏 {p.devCardCount}
            </span>
            {state.longestRoad?.playerId === p.id && <span title="Longest Road">🛣️</span>}
            {state.largestArmy?.playerId === p.id && <span title="Largest Army">⚔️</span>}
            {!p.connected && <span style={{ fontSize: 11, color: '#a00' }}>offline</span>}
          </div>
        );
      })}
    </div>
  );
}

const statStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)' };
