# Catan LAN

A Catan-style board game for 4-6 players over a local network (same WiFi/router)
— no internet, no accounts, no installs beyond a browser. Built from the plan
in [`../docs/catan-lan-plan.md`](../docs/catan-lan-plan.md).

One player hosts the game on their machine; everyone else joins from a
browser on any device on the same network.

## Running it

```bash
npm install
npm run build:client   # builds the React client into client/dist
npm run dev:server     # starts the host server on port 3000
```

The server prints the LAN URL (and a QR code) to join from other devices,
e.g. `http://192.168.1.42:3000`. Open that on your own device too, or
`http://localhost:3000` on the host machine.

For client-side iteration with hot reload, run `npm run dev:client`
(Vite dev server) alongside `npm run dev:server` in another terminal — the
Vite dev server proxies WebSocket traffic to the game server.

## Testing

```bash
npm test          # rules engine, board generation, and full-game simulations
npm run typecheck # shared/server/client type checking
```

The test suite includes:
- **Board generation** (`shared/__tests__/board.test.ts`) — geometry,
  adjacency, port placement, and 6/8-fairness for both the standard and
  5-6 player boards.
- **Rules engine** (`shared/__tests__/engine.test.ts`) — setup, building,
  trading, dev cards, the robber, longest road / largest army, and win
  conditions.
- **Full-game simulations** (`shared/__tests__/simulation.test.ts`) — drives
  entire games for 4, 5, and 6 players using only legal moves discovered
  from game state, verifying the state machine always reaches a winner.
- **Server integration** (`server/__tests__/integration.test.ts`) — spins up
  the real HTTP/WebSocket server and drives it with real socket clients
  through lobby → setup → play, checking that private hands are never
  leaked to other players.

## Project layout

- `shared/` — board generation, the rules engine (`applyAction`), and the
  client/server wire protocol. No Node- or browser-specific code; usable
  from both.
- `server/` — the authoritative game host: lobby/room management, the
  WebSocket protocol handler, and static file serving for the built client.
- `client/` — a Vite + React single-page app: lobby screens and an SVG
  board renderer with click-to-build interactions.

## Known simplifications vs. the physical game

- **5-6 player extension**: board tile/number/dev-card counts approximate
  the official expansion; exact physical card ordering isn't reproduced.
- **Ports**: placed algorithmically around the board's perimeter in the
  correct ratios (4 generic + 5 resource-specific for 4p; 6 + 5 for 5-6p),
  not at their exact positions on the physical board.
- **Dev cards**: match the official timing rule — one per turn, playable
  before or after rolling, never the turn you bought it, and never during
  the 5-6p Special Building Phase (which also disallows all trading).
- Board art is flat-colored hexes rather than illustrated tiles, to avoid
  reproducing Catan's trademarked artwork.
