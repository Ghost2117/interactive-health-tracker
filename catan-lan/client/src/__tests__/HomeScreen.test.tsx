// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeScreen } from '../components/HomeScreen.js';

afterEach(cleanup);

/** Both the mode tab and the form's submit button can read "Create Game" /
 *  "Join Game", so disambiguate by the DOM's own type attribute rather than
 *  an invented query option. */
function submitButton(): HTMLElement {
  return screen.getByText((_, el) => el?.tagName === 'BUTTON' && el.getAttribute('type') === 'submit');
}

function tabButton(label: 'Create Game' | 'Join Game'): HTMLElement {
  return screen.getAllByRole('button', { name: label }).find((el) => el.getAttribute('type') !== 'submit')!;
}

describe('HomeScreen: mode switching', () => {
  it('defaults to Create Game mode, showing a player-count select and no room code field', () => {
    render(<HomeScreen send={vi.fn()} error={null} />);
    expect(screen.getByText('Number of players')).toBeInTheDocument();
    expect(screen.queryByLabelText('Room code')).toBeNull();
  });

  it('switches to Join Game mode, showing a room code field instead of player count', () => {
    render(<HomeScreen send={vi.fn()} error={null} />);
    fireEvent.click(tabButton('Join Game'));
    expect(screen.getByLabelText('Room code')).toBeInTheDocument();
    expect(screen.queryByText('Number of players')).toBeNull();
  });
});

describe('HomeScreen: create game submission', () => {
  it('does not call send when the name is empty', () => {
    const send = vi.fn();
    render(<HomeScreen send={send} error={null} />);
    fireEvent.click(submitButton());
    expect(send).not.toHaveBeenCalled();
  });

  it('sends CREATE_ROOM with the entered name, chosen color, and player count', () => {
    const send = vi.fn();
    render(<HomeScreen send={send} error={null} />);

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByTitle('blue'));
    fireEvent.change(screen.getByLabelText('Number of players'), { target: { value: '6' } });
    fireEvent.click(submitButton());

    expect(send).toHaveBeenCalledWith({ type: 'CREATE_ROOM', name: 'Alice', color: 'blue', playerCount: 6 });
  });

  it('defaults to the first color swatch when none is explicitly picked', () => {
    const send = vi.fn();
    render(<HomeScreen send={send} error={null} />);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Bob' } });
    fireEvent.click(submitButton());
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }));
  });
});

describe('HomeScreen: join game submission', () => {
  it('sends JOIN_ROOM with the entered name and an uppercased room code', () => {
    const send = vi.fn();
    render(<HomeScreen send={send} error={null} />);
    fireEvent.click(tabButton('Join Game'));

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Cara' } });
    fireEvent.change(screen.getByLabelText('Room code'), { target: { value: 'ab12' } });
    fireEvent.click(submitButton());

    expect(send).toHaveBeenCalledWith({ type: 'JOIN_ROOM', roomCode: 'AB12', name: 'Cara', color: 'red' });
  });

  it('does not call send when the room code is empty', () => {
    const send = vi.fn();
    render(<HomeScreen send={send} error={null} />);
    fireEvent.click(tabButton('Join Game'));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Cara' } });
    fireEvent.click(submitButton());
    expect(send).not.toHaveBeenCalled();
  });
});

describe('HomeScreen: error display', () => {
  it('shows the error message when present', () => {
    render(<HomeScreen send={vi.fn()} error="Room not found" />);
    expect(screen.getByText('Room not found')).toBeInTheDocument();
  });

  it('shows nothing extra when there is no error', () => {
    render(<HomeScreen send={vi.fn()} error={null} />);
    expect(screen.queryByText(/not found/)).toBeNull();
  });
});
