// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HandPanel } from '../components/HandPanel.js';
import { finishSetup, makeServerGame, toClientGameState } from './fixtures.js';

afterEach(cleanup);

describe('HandPanel', () => {
  it("renders the viewer's own exact resource counts", () => {
    const server = finishSetup(makeServerGame(4, 1));
    const selfId = server.players[0].id;
    server.players[0].resources = { brick: 3, lumber: 1, ore: 0, grain: 2, wool: 4 };
    const state = toClientGameState(server, selfId);

    render(<HandPanel state={state} selfId={selfId} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders nothing for a viewer who is not in the game', () => {
    const server = finishSetup(makeServerGame(4, 2));
    const state = toClientGameState(server, server.players[0].id);
    const { container } = render(<HandPanel state={state} selfId="not-a-real-player" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows dev card counts only when the player holds any', () => {
    const server = finishSetup(makeServerGame(4, 3));
    const selfId = server.players[0].id;
    const state1 = toClientGameState(server, selfId);
    const { unmount } = render(<HandPanel state={state1} selfId={selfId} />);
    expect(screen.queryByText('Your dev cards')).toBeNull();
    unmount();

    server.players[0].devCards = [
      { type: 'knight', boughtOnTurn: 0 },
      { type: 'knight', boughtOnTurn: 0 },
      { type: 'monopoly', boughtOnTurn: 0 },
    ];
    const state2 = toClientGameState(server, selfId);
    render(<HandPanel state={state2} selfId={selfId} />);
    expect(screen.getByText('Your dev cards')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument(); // 2 knights
    expect(screen.getByText('×1')).toBeInTheDocument(); // 1 monopoly
  });

  it("never renders another player's resource numbers (they aren't in the redacted view at all)", () => {
    const server = finishSetup(makeServerGame(4, 4));
    const [self, other] = server.players;
    self.resources = { brick: 1, lumber: 1, ore: 1, grain: 1, wool: 1 };
    other.resources = { brick: 9, lumber: 9, ore: 9, grain: 9, wool: 9 };
    const state = toClientGameState(server, self.id);

    render(<HandPanel state={state} selfId={self.id} />);
    // The redacted view never carries another player's numeric hand at
    // all, so there is nothing here that could leak a "9" from `other`.
    expect(screen.queryByText('9')).toBeNull();
  });
});
