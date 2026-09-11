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
npm test          # 177 tests: unit, component, and integration
npm run typecheck # shared/server/client type checking
```

177 tests across 16 files, organized by layer:

**Unit tests — `shared/`** (pure game logic, no I/O):
- `board.test.ts` — hex geometry, vertex/edge adjacency, harbor
  composition/placement, and 6/8-number fairness for the standard and
  5-6 player boards.
- `engine.test.ts` — `applyAction` for setup, building, trading (bank/port/
  player), all four dev cards, the robber, discards, longest road / largest
  army tie-breaking, the Special Building Phase, and victory conditions —
  including the illegal-action/error-return path for nearly every rule.
- `game.test.ts` — `createGame`'s initial state (board, bank, dev deck,
  setup queue) per player count, determinism, and its thrown error when the
  player list doesn't match the requested count.
- `decks.test.ts` — dev card deck composition per player count.
- `rng.test.ts` — the seeded PRNG's determinism and range, and that
  `shuffle`/`pick` behave as real permutation/selection helpers.
- `protocol.test.ts` — `toClientGameState`'s hand-redaction: a viewer sees
  their own resources/dev cards in full and everyone else's only as counts,
  verified to hold from every player's point of view and to survive a JSON
  round-trip (as it does over the wire).

**Unit tests — `server/`**:
- `room.test.ts` — per-room color-collision resolution and host migration
  on disconnect.
- `lobby.test.ts` — room code generation/uniqueness/lookup and empty-room
  cleanup.
- `staticServer.test.ts` — file serving, SPA fallback routing, unbuilt-client
  404 handling, and — the one worth calling out — a percent-encoded path
  traversal attack (`%2e%2e%2f`, which slips past the URL parser's own
  dot-segment normalization since the slashes are encoded too) is correctly
  blocked with a 403, not just the trivial unencoded `../` case.

**Unit tests — `client/`**:
- `legalMoves.test.ts` — the client's own legal-move helpers (used to
  highlight clickable board targets) cross-checked against the server's
  `applyAction` so the two never silently disagree on what's legal.
- `connection.test.ts` — the WebSocket hook's session persistence,
  reconnect-with-backoff behavior (via a scriptable fake WebSocket + fake
  timers, forcing real close/retry cycles rather than trusting a live
  socket), and message-type handling.
- `ActionBar.test.tsx`, `HandPanel.test.tsx`, `HomeScreen.test.tsx` — phase-
  gated button availability, resource-hand redaction actually rendering
  correctly (not just in the data layer), and form validation/submission.

**Integration tests — `server/__tests__/integration.test.ts`**: the real
production server module (`attachGameServer`, exactly what `server/index.ts`
wires up — not a reimplementation) attached to a real HTTP server on an
ephemeral port, driven by real WebSocket client sockets through lobby →
setup → play. Covers the happy path for 4 and 6 players, and error paths:
malformed JSON, invalid player counts, unknown/full/already-started rooms,
non-host start attempts, too-few-players start attempts, bad reconnect
tokens, and that a rejected action is only ever reported back to the player
who sent it.

## Project layout

- `shared/` — board generation, the rules engine (`applyAction`), and the
  client/server wire protocol. No Node- or browser-specific code; usable
  from both.
- `server/` — the authoritative game host: `gameServer.ts` wires the
  WebSocket protocol onto any HTTP server (used by both `index.ts`'s real
  bootstrap and the integration tests, so tests exercise the exact
  production code path), plus lobby/room management and static file
  serving for the built client.
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

- **5-6 player extension**: tile, number, harbor, bank, and dev-card
  *composition* all match the physical expansion exactly (card-for-card —
  see [`docs/rules-audit.md`](docs/rules-audit.md)), but physical placement
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
