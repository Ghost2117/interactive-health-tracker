import { useState } from 'react';
import type { Action } from '../../../shared/actions.js';
import type { ClientGameState } from '../../../shared/protocol.js';
import { RESOURCES, type Resource } from '../../../shared/types.js';
import { RESOURCE_LABELS } from '../boardColors.js';

export function DiscardModal({ state, selfId, dispatch }: { state: ClientGameState; selfId: string; dispatch: (a: Action) => void }) {
  const self = state.players.find((p) => p.id === selfId)!;
  const total = self.resources ? RESOURCES.reduce((s, r) => s + self.resources![r], 0) : 0;
  const required = Math.floor(total / 2);
  const [amounts, setAmounts] = useState<Record<Resource, number>>({ brick: 0, lumber: 0, ore: 0, grain: 0, wool: 0 });

  const chosen = RESOURCES.reduce((s, r) => s + amounts[r], 0);

  return (
    <div style={overlayStyle}>
      <div style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>Discard {required} cards</h3>
        <p style={{ fontSize: 13, color: '#555' }}>A 7 was rolled and you have more than 7 cards. Choose {required} to discard.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {RESOURCES.map((r) => (
            <label key={r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 12 }}>
              {RESOURCE_LABELS[r]} ({self.resources?.[r] ?? 0})
              <input
                type="number"
                min={0}
                max={self.resources?.[r] ?? 0}
                value={amounts[r]}
                onChange={(e) =>
                  setAmounts({ ...amounts, [r]: Math.max(0, Math.min(self.resources?.[r] ?? 0, Number(e.target.value))) })
                }
                style={{ width: 48 }}
              />
            </label>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 13 }}>
          Selected {chosen} / {required}
        </div>
        <button
          disabled={chosen !== required}
          style={{
            marginTop: 10,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: chosen === required ? '#2f6b3a' : '#aaa',
            color: '#fff',
            cursor: chosen === required ? 'pointer' : 'not-allowed',
          }}
          onClick={() => dispatch({ type: 'DISCARD', resources: amounts })}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 30,
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: 20,
  width: 'min(90vw, 420px)',
};
