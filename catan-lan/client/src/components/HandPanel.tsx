import type { ClientGameState } from '../../../shared/protocol.js';
import { RESOURCE_LABELS } from '../boardColors.js';
import { RESOURCES, type Resource } from '../../../shared/types.js';

export function HandPanel({ state, selfId }: { state: ClientGameState; selfId: string }) {
  const self = state.players.find((p) => p.id === selfId);
  if (!self || !self.resources) return null;

  const devCardCounts = new Map<string, number>();
  for (const card of self.devCards ?? []) {
    devCardCounts.set(card.type, (devCardCounts.get(card.type) ?? 0) + 1);
  }

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '8px 0' }}>
      <div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Your resources</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {RESOURCES.map((r: Resource) => (
            <div
              key={r}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #ccc',
                minWidth: 40,
                textAlign: 'center',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: 10, color: '#666' }}>{RESOURCE_LABELS[r]}</div>
              <div style={{ fontWeight: 700 }}>{self.resources![r]}</div>
            </div>
          ))}
        </div>
      </div>
      {devCardCounts.size > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Your dev cards</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[...devCardCounts.entries()].map(([type, count]) => (
              <div key={type} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ccc', background: '#fff' }}>
                {type} x{count}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
