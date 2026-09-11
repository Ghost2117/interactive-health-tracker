import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientGameState, ClientMessage, LobbyState, ServerMessage } from '../../shared/protocol.js';

const STORAGE_KEY = 'catan-lan-session';

interface StoredSession {
  roomCode: string;
  playerId: string;
  playerToken: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: StoredSession | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable (private browsing); reconnection just won't persist.
  }
}

export interface ConnectionState {
  status: 'connecting' | 'open' | 'closed';
  lobby: LobbyState | null;
  gameState: ClientGameState | null;
  playerId: string | null;
  error: string | null;
  actionError: string | null;
}

export function useConnection() {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<ConnectionState>({
    status: 'connecting',
    lobby: null,
    gameState: null,
    playerId: null,
    error: null,
    actionError: null,
  });

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/ws`);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      setState((s) => ({ ...s, status: 'open' }));
      const session = loadSession();
      if (session) {
        ws.send(
          JSON.stringify({
            type: 'RECONNECT',
            roomCode: session.roomCode,
            playerId: session.playerId,
            playerToken: session.playerToken,
          } satisfies ClientMessage)
        );
      }
    });

    ws.addEventListener('close', () => setState((s) => ({ ...s, status: 'closed' })));

    ws.addEventListener('message', (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      switch (message.type) {
        case 'JOINED':
          saveSession({ roomCode: message.roomCode, playerId: message.playerId, playerToken: message.playerToken });
          setState((s) => ({ ...s, playerId: message.playerId, error: null }));
          return;
        case 'LOBBY_STATE':
          setState((s) => ({ ...s, lobby: message.lobby }));
          return;
        case 'GAME_STATE':
          setState((s) => ({ ...s, gameState: message.state, actionError: null }));
          return;
        case 'ACTION_ERROR':
          setState((s) => ({ ...s, actionError: message.error }));
          return;
        case 'ERROR':
          setState((s) => ({ ...s, error: message.message }));
          return;
        case 'PONG':
          return;
      }
    });

    return () => ws.close();
  }, []);

  const send = useCallback((message: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(message));
  }, []);

  const leaveSession = useCallback(() => {
    saveSession(null);
    setState((s) => ({ ...s, lobby: null, gameState: null, playerId: null }));
  }, []);

  const clearActionError = useCallback(() => {
    setState((s) => ({ ...s, actionError: null }));
  }, []);

  return { state, send, leaveSession, clearActionError };
}
