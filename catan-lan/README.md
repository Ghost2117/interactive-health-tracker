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

## Rules fidelity

Gameplay mechanics were audited rule-by-rule against the official rulebooks
(base game + 5-6 Player Extension) — see
[`docs/rules-audit.md`](docs/rules-audit.md) for the full checklist and what
it found. Ports, in particular: exact harbor composition (4 generic 3:1 + 1
per resource for 4p; 5 generic + 6 resource-specific — wool appears
twice — for 5-6p), each harbor's 2:1/3:1 rate only applies to a player who
has a settlement/city on one of that harbor's two vertices, and a player
never gets a better rate for a resource they don't hold the matching harbor
for.

## Known simplifications vs. the physical game

- **5-6 player extension**: bank/dev-card totals approximate the official
  expansion rather than reproducing exact physical card counts; tile,
  number, and harbor *composition* matches exactly, but physical placement
  order (dealt face-down, assembled by hand) is replaced with an equivalent
  digital shuffle.
- **Harbor positions**: placed algorithmically around the coastline in the
  correct composition (see above), not at the exact physical board
  positions.
- Board art (see `client/src/components/TileArt.tsx`) is original,
  abstracted iconography — pine trees for forest, rolling mounds for hills,
  jagged peaks for mountains, wheat for fields, sheep for pasture, dunes and
  a cactus for desert — rather than reproducing Catan's trademarked
  illustrations.
