// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionBar } from '../components/ActionBar.js';
import type { ClientGameState } from '../../../shared/protocol.js';
import { finishSetup, makeServerGame, toClientGameState } from './fixtures.js';

afterEach(cleanup);

function setup(overrides: Partial<{ state: ClientGameState }> = {}) {
  const server = finishSetup(makeServerGame(4, 1));
  const selfId = server.players[server.currentPlayerIndex].id;
  const state = overrides.state ?? toClientGameState(server, selfId);
  const dispatch = vi.fn();
  const setBuildMode = vi.fn();
  const onOpenTrade = vi.fn();
  render(
    <ActionBar state={state} selfId={selfId} buildMode={null} setBuildMode={setBuildMode} dispatch={dispatch} onOpenTrade={onOpenTrade} />
  );
  return { dispatch, setBuildMode, onOpenTrade, selfId, state };
}

describe('ActionBar: roll phase', () => {
  it("shows Roll Dice on the current player's turn and dispatches ROLL_DICE when clicked", () => {
    const { dispatch } = setup();
    const rollBtn = screen.getByRole('button', { name: /Roll Dice/ });
    fireEvent.click(rollBtn);
    expect(dispatch).toHaveBeenCalledWith({ type: 'ROLL_DICE' });
  });

  it('does not show any build buttons before rolling (building is a main-phase action)', () => {
    setup();
    expect(screen.queryByRole('button', { name: /Settlement/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /City/ })).toBeNull();
  });

  it('does show dev card buttons before rolling, since they can be played any time on your turn', () => {
    setup();
    expect(screen.getByRole('button', { name: /Knight/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Road Building/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Year of Plenty/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Monopoly/ })).toBeInTheDocument();
  });

  it('renders nothing for a player whose turn it is not', () => {
    const server = finishSetup(makeServerGame(4, 2));
    const notCurrent = server.players.find((_, i) => i !== server.currentPlayerIndex)!;
    const state = toClientGameState(server, notCurrent.id);
    const { container } = render(
      <ActionBar state={state} selfId={notCurrent.id} buildMode={null} setBuildMode={vi.fn()} dispatch={vi.fn()} onOpenTrade={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ActionBar: main phase building', () => {
  function setupInMainPhaseWithResources() {
    const server = finishSetup(makeServerGame(4, 3));
    const selfId = server.players[server.currentPlayerIndex].id;
    const rich = { ...server, phase: 'main' as const };
    rich.players = rich.players.map((p) => (p.id === selfId ? { ...p, resources: { brick: 5, lumber: 5, ore: 5, grain: 5, wool: 5 } } : p));
    const state = toClientGameState(rich, selfId);
    const dispatch = vi.fn();
    const setBuildMode = vi.fn();
    render(<ActionBar state={state} selfId={selfId} buildMode={null} setBuildMode={setBuildMode} dispatch={dispatch} onOpenTrade={vi.fn()} />);
    return { dispatch, setBuildMode, selfId, state };
  }

  it('enables build buttons when the player can afford them and toggles build mode on click', () => {
    const { setBuildMode } = setupInMainPhaseWithResources();
    // Distinguish the "Road" build button from "Road Building" (dev card) by its leading emoji.
    const roadBtn = screen.getByRole('button', { name: /^🛣️ Road/ });
    expect(roadBtn).not.toBeDisabled();
    fireEvent.click(roadBtn);
    expect(setBuildMode).toHaveBeenCalledWith('road');
  });

  it('disables Buy Dev Card once the deck is empty, even with enough resources', () => {
    const server = finishSetup(makeServerGame(4, 4));
    const selfId = server.players[server.currentPlayerIndex].id;
    const noDeck = { ...server, phase: 'main' as const, devDeck: [] };
    noDeck.players = noDeck.players.map((p) => (p.id === selfId ? { ...p, resources: { brick: 5, lumber: 5, ore: 5, grain: 5, wool: 5 } } : p));
    const state = toClientGameState(noDeck, selfId);
    render(<ActionBar state={state} selfId={selfId} buildMode={null} setBuildMode={vi.fn()} dispatch={vi.fn()} onOpenTrade={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Dev Card/ })).toBeDisabled();
  });

  it('disables build buttons the player cannot afford', () => {
    const server = finishSetup(makeServerGame(4, 5));
    const selfId = server.players[server.currentPlayerIndex].id;
    const poor = { ...server, phase: 'main' as const };
    poor.players = poor.players.map((p) => (p.id === selfId ? { ...p, resources: { brick: 0, lumber: 0, ore: 0, grain: 0, wool: 0 } } : p));
    const state = toClientGameState(poor, selfId);
    render(<ActionBar state={state} selfId={selfId} buildMode={null} setBuildMode={vi.fn()} dispatch={vi.fn()} onOpenTrade={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^🛣️ Road/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Settlement/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /City/ })).toBeDisabled();
  });

  it('disables all dev card buttons once one has already been played this turn', () => {
    const server = finishSetup(makeServerGame(4, 6));
    const selfId = server.players[server.currentPlayerIndex].id;
    const played = { ...server, phase: 'main' as const };
    played.players = played.players.map((p) =>
      p.id === selfId
        ? { ...p, playedDevCardThisTurn: true, devCards: [{ type: 'knight' as const, boughtOnTurn: 0 }] }
        : p
    );
    const state = toClientGameState(played, selfId);
    render(<ActionBar state={state} selfId={selfId} buildMode={null} setBuildMode={vi.fn()} dispatch={vi.fn()} onOpenTrade={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Knight/ })).toBeDisabled();
  });

  it('shows a Trade button in main phase', () => {
    setupInMainPhaseWithResources();
    expect(screen.getByRole('button', { name: /Trade/ })).toBeInTheDocument();
  });
});

describe('ActionBar: robber move phase', () => {
  it('shows only the robber hint for the player who must move it, no other controls', () => {
    const server = finishSetup(makeServerGame(4, 7));
    const selfId = server.players[server.currentPlayerIndex].id;
    const robberState = { ...server, phase: 'robberMove' as const, pendingRobberPlayerId: selfId };
    const state = toClientGameState(robberState, selfId);
    render(<ActionBar state={state} selfId={selfId} buildMode={null} setBuildMode={vi.fn()} dispatch={vi.fn()} onOpenTrade={vi.fn()} />);
    expect(screen.getByText(/move the robber/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
