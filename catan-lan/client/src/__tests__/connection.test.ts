// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnection } from '../connection.js';

/** A minimal, controllable stand-in for the browser WebSocket, driven
 *  explicitly by tests instead of a real socket/server. */
class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  // --- test-only helpers, standing in for what a real server would do ---
  triggerOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  triggerMessage(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  triggerServerClose(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
}

function lastSocket(): FakeWebSocket {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useConnection: connecting', () => {
  it('starts in "connecting" and moves to "open" once the socket opens', () => {
    const { result } = renderHook(() => useConnection());
    expect(result.current.state.status).toBe('connecting');

    act(() => lastSocket().triggerOpen());
    expect(result.current.state.status).toBe('open');
  });

  it('sends no RECONNECT message on first connect when there is no stored session', () => {
    renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    expect(lastSocket().sent).toHaveLength(0);
  });

  it('auto-sends RECONNECT with the stored session on connect', () => {
    localStorage.setItem('catan-lan-session', JSON.stringify({ roomCode: 'ABCD', playerId: 'p1', playerToken: 'tok' }));
    renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());

    expect(lastSocket().sent).toHaveLength(1);
    expect(JSON.parse(lastSocket().sent[0])).toEqual({
      type: 'RECONNECT',
      roomCode: 'ABCD',
      playerId: 'p1',
      playerToken: 'tok',
    });
  });
});

describe('useConnection: message handling', () => {
  it('stores the session and playerId on JOINED', () => {
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    act(() => lastSocket().triggerMessage({ type: 'JOINED', roomCode: 'WXYZ', playerId: 'p9', playerToken: 'secret' }));

    expect(result.current.state.playerId).toBe('p9');
    expect(JSON.parse(localStorage.getItem('catan-lan-session')!)).toEqual({
      roomCode: 'WXYZ',
      playerId: 'p9',
      playerToken: 'secret',
    });
  });

  it('updates lobby state on LOBBY_STATE', () => {
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    const lobby = { roomCode: 'WXYZ', playerCount: 4 as const, hostId: 'p1', players: [] };
    act(() => lastSocket().triggerMessage({ type: 'LOBBY_STATE', lobby }));
    expect(result.current.state.lobby).toEqual(lobby);
  });

  it('updates game state on GAME_STATE and clears any prior action error', () => {
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    act(() => lastSocket().triggerMessage({ type: 'ACTION_ERROR', error: 'nope' }));
    expect(result.current.state.actionError).toBe('nope');

    const fakeState = { phase: 'roll' } as never;
    act(() => lastSocket().triggerMessage({ type: 'GAME_STATE', state: fakeState }));
    expect(result.current.state.gameState).toEqual(fakeState);
    expect(result.current.state.actionError).toBeNull();
  });

  it('surfaces ACTION_ERROR and ERROR messages separately', () => {
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    act(() => lastSocket().triggerMessage({ type: 'ERROR', message: 'room not found' }));
    expect(result.current.state.error).toBe('room not found');
    expect(result.current.state.actionError).toBeNull();
  });

  it('does not throw on an unrecognized message type', () => {
    renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    expect(() => act(() => lastSocket().triggerMessage({ type: 'SOMETHING_UNKNOWN' }))).not.toThrow();
  });
});

describe('useConnection: reconnection with backoff', () => {
  it('marks status "reconnecting" immediately when the socket drops', () => {
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    act(() => lastSocket().triggerServerClose());
    expect(result.current.state.status).toBe('reconnecting');
  });

  it('keeps the last known lobby/game state visible while reconnecting (does not clear it)', () => {
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    act(() => lastSocket().triggerMessage({ type: 'JOINED', roomCode: 'AAAA', playerId: 'p1', playerToken: 't' }));
    act(() => lastSocket().triggerServerClose());
    expect(result.current.state.playerId).toBe('p1'); // still there
  });

  it('retries after the first backoff delay and can reach "open" again', async () => {
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    act(() => lastSocket().triggerServerClose());
    expect(FakeWebSocket.instances).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // base delay
    });
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => lastSocket().triggerOpen());
    expect(result.current.state.status).toBe('open');
  });

  it('re-sends RECONNECT with the same stored session after a drop and retry', async () => {
    localStorage.setItem('catan-lan-session', JSON.stringify({ roomCode: 'ABCD', playerId: 'p1', playerToken: 'tok' }));
    renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    lastSocket().sent = []; // clear the first RECONNECT so we only see the retry's

    act(() => lastSocket().triggerServerClose());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    act(() => lastSocket().triggerOpen());

    expect(lastSocket().sent).toHaveLength(1);
    expect(JSON.parse(lastSocket().sent[0])).toMatchObject({ type: 'RECONNECT', roomCode: 'ABCD' });
  });

  it('backs off with increasing delay on repeated drops (does not retry instantly every time)', async () => {
    renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());

    act(() => lastSocket().triggerServerClose()); // 1st drop -> ~1000ms delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(FakeWebSocket.instances).toHaveLength(1); // not yet

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2);
    });
    expect(FakeWebSocket.instances).toHaveLength(2); // now it retried

    act(() => lastSocket().triggerServerClose()); // 2nd consecutive drop -> ~2000ms delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(FakeWebSocket.instances).toHaveLength(2); // still waiting, backoff grew
  });
});

describe('useConnection: leaveSession', () => {
  it('clears the stored session', () => {
    localStorage.setItem('catan-lan-session', JSON.stringify({ roomCode: 'ABCD', playerId: 'p1', playerToken: 'tok' }));
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());

    // jsdom deliberately doesn't implement navigation/reload, so this will
    // log a "not implemented" notice - that's expected and harmless here;
    // what matters is the session is forgotten before that call happens.
    try {
      act(() => result.current.leaveSession());
    } catch {
      // Some jsdom versions throw on location.reload(); either way the
      // session-clearing line above it must have already run.
    }
    expect(localStorage.getItem('catan-lan-session')).toBeNull();
  });
});

describe('useConnection: clearActionError', () => {
  it('clears just the action error, leaving other state alone', () => {
    const { result } = renderHook(() => useConnection());
    act(() => lastSocket().triggerOpen());
    act(() => lastSocket().triggerMessage({ type: 'JOINED', roomCode: 'AAAA', playerId: 'p1', playerToken: 't' }));
    act(() => lastSocket().triggerMessage({ type: 'ACTION_ERROR', error: 'bad move' }));
    expect(result.current.state.actionError).toBe('bad move');

    act(() => result.current.clearActionError());
    expect(result.current.state.actionError).toBeNull();
    expect(result.current.state.playerId).toBe('p1');
  });
});
