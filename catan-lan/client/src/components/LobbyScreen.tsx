import type { ClientMessage, LobbyState } from '../../../shared/protocol.js';
import { PLAYER_COLOR_SWATCH } from '../boardColors.js';

export function LobbyScreen({
  lobby,
  selfId,
  send,
  onLeave,
}: {
  lobby: LobbyState;
  selfId: string;
  send: (m: ClientMessage) => void;
  onLeave: () => void;
}) {
  const isHost = lobby.hostId === selfId;
  const joinUrl = `${location.protocol}//${location.host}`;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          padding: 24,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}
      >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 26, margin: '0 0 8px' }}>🛋️ Lobby</h1>
        <button
          onClick={onLeave}
          style={{
            fontSize: 12,
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--panel)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          Leave
        </button>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        Have other players open <strong>{joinUrl}</strong> on this WiFi network, choose "Join Game", and enter the code
        below.
      </p>
      <div
        style={{
          fontSize: 40,
          fontWeight: 800,
          letterSpacing: 8,
          textAlign: 'center',
          padding: '16px 0',
          background: '#f5ecd7',
          border: '1px solid var(--border)',
          borderRadius: 8,
          margin: '12px 0',
        }}
      >
        {lobby.roomCode}
      </div>

      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
        {lobby.players.length} / {lobby.playerCount} players joined
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lobby.players.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              opacity: p.connected ? 1 : 0.5,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: PLAYER_COLOR_SWATCH[p.color] ?? p.color,
                border: '1px solid #333',
              }}
            />
            <strong>{p.name}</strong>
            {p.id === selfId && <span style={{ color: 'var(--text-muted)' }}>(you)</span>}
            {p.isHost && <span style={{ color: 'var(--text-muted)' }}>host</span>}
            {!p.connected && <span style={{ color: '#a00', fontSize: 12 }}>disconnected</span>}
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          onClick={() => send({ type: 'START_GAME' })}
          disabled={lobby.players.length !== lobby.playerCount}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '10px 0',
            borderRadius: 6,
            border: 'none',
            background: lobby.players.length === lobby.playerCount ? 'var(--accent)' : '#aaa',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: lobby.players.length === lobby.playerCount ? 'pointer' : 'not-allowed',
          }}
        >
          {lobby.players.length === lobby.playerCount ? 'Start Game' : `Waiting for ${lobby.playerCount - lobby.players.length} more player(s)`}
        </button>
      ) : (
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Waiting for the host to start the game...</p>
      )}
      </div>
    </div>
  );
}
