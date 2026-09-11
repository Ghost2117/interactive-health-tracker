import type { ClientGameState } from '../../../shared/protocol.js';

export function EventLog({ state }: { state: ClientGameState }) {
  const entries = [...state.log].slice(-40).reverse();
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, margin: '4px 0' }}>Game log</div>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 8,
          maxHeight: 200,
          overflowY: 'auto',
          background: 'var(--panel)',
          fontSize: 12,
        }}
      >
        {entries.map((entry, i) => (
          <div key={i} style={{ padding: '3px 0', borderBottom: i < entries.length - 1 ? '1px solid #eee' : undefined }}>
            {entry}
          </div>
        ))}
      </div>
    </div>
  );
}
