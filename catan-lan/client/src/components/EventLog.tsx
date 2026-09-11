import type { ClientGameState } from '../../../shared/protocol.js';

export function EventLog({ state }: { state: ClientGameState }) {
  const entries = [...state.log].slice(-40).reverse();
  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 8,
        maxHeight: 220,
        overflowY: 'auto',
        background: '#fafafa',
        fontSize: 12,
      }}
    >
      {entries.map((entry, i) => (
        <div key={i} style={{ padding: '2px 0', borderBottom: i < entries.length - 1 ? '1px solid #eee' : undefined }}>
          {entry}
        </div>
      ))}
    </div>
  );
}
