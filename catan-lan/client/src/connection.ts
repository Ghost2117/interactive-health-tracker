import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientGameState, ClientMessage, LobbyState, ServerMessage } from '../../shared/protocol.js';

const STORAGE_KEY = 'catan-lan-session';
const MAX_RECONNECT_DELAY_MS = 10000;
const BASE_RECONNECT_DELAY_MS = 1000;

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
  /** 'connecting': first-ever connect, nothing to show yet. 'reconnecting':
   *  a previously-open connection dropped and a retry is scheduled — the
   *  UI should keep showing the last known lobby/game state underneath a
   *  banner rather than blanking out. */
  status: 'connecting' | 'open' | 'reconnecting';
  lobby: LobbyState | null;
  gameState: ClientGameState | null;
  playerId: string | null;
  error: string | null;
  actionError: string | null;
}

export function useConnection() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<ConnectionState>({
    status: 'connecting',
    lobby: null,
    gameState: null,
    playerId: null,
    error: null,
    actionError: null,
  });

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${location.host}/ws`);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        reconnectAttemptRef.current = 0;
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

      ws.addEventListener('close', () => {
        if (cancelled) return;
        setState((s) => ({ ...s, status: 'reconnecting' }));
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        reconnectTimerRef.current = setTimeout(connect, delay);
      });

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
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(message));
  }, []);

  /** Forgets this session and reloads to a clean slate — the simplest way
   *  to guarantee both the client and server (via the socket actually
   *  closing) end up in a consistent "not in any room" state. */
  const leaveSession = useCallback(() => {
    saveSession(null);
    location.reload();
  }, []);

  const clearActionError = useCallback(() => {
    setState((s) => ({ ...s, actionError: null }));
  }, []);

  return { state, send, leaveSession, clearActionError };
}
