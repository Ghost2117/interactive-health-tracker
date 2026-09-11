import type { ClientMessage, LobbyState } from '../../../shared/protocol.js';
import { PLAYER_COLOR_SWATCH } from '../boardColors.js';

export function LobbyScreen({ lobby, selfId, send }: { lobby: LobbyState; selfId: string; send: (m: ClientMessage) => void }) {
  const isHost = lobby.hostId === selfId;
  const joinUrl = `${location.protocol}//${location.host}`;

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24 }}>Lobby</h1>
      <p style={{ fontSize: 14, color: '#555' }}>
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
          borderRadius: 8,
          margin: '12px 0',
        }}
      >
        {lobby.roomCode}
      </div>

      <div style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>
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
              border: '1px solid #ddd',
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
            {p.id === selfId && <span style={{ color: '#666' }}>(you)</span>}
            {p.isHost && <span style={{ color: '#666' }}>host</span>}
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
            background: lobby.players.length === lobby.playerCount ? '#2f6b3a' : '#aaa',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: lobby.players.length === lobby.playerCount ? 'pointer' : 'not-allowed',
          }}
        >
          {lobby.players.length === lobby.playerCount ? 'Start Game' : `Waiting for ${lobby.playerCount - lobby.players.length} more player(s)`}
        </button>
      ) : (
        <p style={{ marginTop: 16, color: '#555' }}>Waiting for the host to start the game...</p>
      )}
    </div>
  );
}
