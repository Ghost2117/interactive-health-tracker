import { useState } from 'react';
import type { ClientMessage } from '../../../shared/protocol.js';
import type { PlayerCount } from '../../../shared/types.js';
import { PLAYER_COLOR_SWATCH } from '../boardColors.js';

const COLORS = Object.keys(PLAYER_COLOR_SWATCH);

export function HomeScreen({ send, error }: { send: (m: ClientMessage) => void; error: string | null }) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(4);
  const [roomCode, setRoomCode] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === 'create') {
      send({ type: 'CREATE_ROOM', name, color, playerCount });
    } else {
      send({ type: 'JOIN_ROOM', roomCode, name, color });
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24 }}>Catan LAN</h1>
      <p style={{ color: '#555', fontSize: 14 }}>
        Play a Catan-style board game with friends on the same WiFi network. One person hosts (Create Game); everyone
        else joins with the room code shown on the host's screen.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode('create')} style={tabStyle(mode === 'create')}>
          Create Game
        </button>
        <button onClick={() => setMode('join')} style={tabStyle(mode === 'join')}>
          Join Game
        </button>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required style={inputStyle} />
        </label>

        <label>
          Your color
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                title={c}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: PLAYER_COLOR_SWATCH[c],
                  border: color === c ? '3px solid #222' : '1px solid #999',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </label>

        {mode === 'create' ? (
          <label>
            Number of players
            <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value) as PlayerCount)} style={inputStyle}>
              <option value={4}>4 players (standard)</option>
              <option value={5}>5 players (extension)</option>
              <option value={6}>6 players (extension)</option>
            </select>
          </label>
        ) : (
          <label>
            Room code
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={4}
              required
              style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: 2 }}
            />
          </label>
        )}

        {error && <div style={{ color: '#a00', fontSize: 13 }}>{error}</div>}

        <button type="submit" style={submitStyle}>
          {mode === 'create' ? 'Create Game' : 'Join Game'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  marginTop: 4,
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: 14,
  boxSizing: 'border-box',
};

const submitStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 6,
  border: 'none',
  background: '#2f6b3a',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px 0',
    borderRadius: 6,
    border: active ? '2px solid #2f6b3a' : '1px solid #ccc',
    background: active ? '#eaf3ec' : '#fff',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
  };
}
