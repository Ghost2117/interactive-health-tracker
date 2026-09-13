import type { ClientGameState } from '../../../shared/protocol.js';
import { DEV_CARD_ICONS, DEV_CARD_LABELS, RESOURCE_ICONS, RESOURCE_LABELS } from '../boardColors.js';
import { RESOURCES, type Resource } from '../../../shared/types.js';

export function HandPanel({ state, selfId }: { state: ClientGameState; selfId: string }) {
  const self = state.players.find((p) => p.id === selfId);
  if (!self || !self.resources) return null;

  const devCardCounts = new Map<string, number>();
  for (const card of self.devCards ?? []) {
    devCardCounts.set(card.type, (devCardCounts.get(card.type) ?? 0) + 1);
  }

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '10px 0' }}>
      <div>
        <div style={sectionLabel}>Your resources</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RESOURCES.map((r: Resource) => (
            <div key={r} style={cardStyle} title={RESOURCE_LABELS[r]}>
              <div style={{ fontSize: 18 }}>{RESOURCE_ICONS[r]}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{self.resources![r]}</div>
            </div>
          ))}
        </div>
      </div>
      {devCardCounts.size > 0 && (
        <div>
          <div style={sectionLabel}>Your dev cards</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[...devCardCounts.entries()].map(([type, count]) => (
              <div key={type} style={cardStyle} title={DEV_CARD_LABELS[type] ?? type}>
                <div style={{ fontSize: 18 }}>{DEV_CARD_ICONS[type] ?? '🃏'}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>×{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sectionLabel: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 };

const cardStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  minWidth: 44,
  textAlign: 'center',
  background: 'var(--panel)',
};
