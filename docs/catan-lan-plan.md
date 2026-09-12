# Implementation Plan: Catan-style LAN Multiplayer Game

> **Scope note:** This plan describes a *separate* project — a browser-based
> Catan clone for local-network play. It is unrelated to the
> interactive-health-tracker app in this repository. It lives here (under
> `docs/`) only because this session's git remote/branch were pre-provisioned
> against this repo; see "Where this should actually live" at the end.

## 1. Goals

- Digital clone of the standard Catan board game.
- Supports the standard **4-player** game and the official **5-6 Player
  Extension** rules (bigger board, 2 extra dev cards of each resource
  amount, Special Building Phase).
- All players connect over the **same LAN/WiFi** — no internet, no cloud
  backend, no accounts. One player's machine hosts the game; everyone else
  joins from a browser on the same network.
- No installation required for non-host players beyond opening a URL in a
  browser (phone, tablet, or laptop all work).

**Non-goals (v1):** internet play across networks, spectator mode, AI bots,
Seafarers/Cities & Knights expansions, mobile native apps, persistence
across host restarts.

**Trademark note:** "Catan"/"Settlers of Catan" and its board/card art are
trademarked (Catan GmbH / Asmodee). Build original tile/card art and avoid
the branded name in any public-facing repo or release; treat this as a
personal/private clone.

## 2. Architecture Overview

**Host-authoritative client-server model over the LAN**, packaged as a
single Node.js process:

```
┌─────────────────────────── Host machine ───────────────────────────┐
│  Node.js process                                                    │
│   ├─ HTTP server → serves the static web client (React SPA)         │
│   ├─ WebSocket server → real-time game protocol                     │
│   └─ Game Engine (authoritative rules, board, turn state machine)   │
│         - one instance per lobby/room                               │
└──────────────────────────────────────────────────────────────────────┘
        ▲ WiFi/LAN (ws://<host-ip>:PORT)          ▲
        │                                          │
   Player 2 (browser)                         Player 3..6 (browser)
   e.g. http://192.168.1.42:3000            same URL, different tab/device
```

Why this shape instead of peer-to-peer or a native game engine:
- A **browser client + one authoritative Node server** means zero installs
  for guests — join by opening a URL, works identically on phone/laptop.
- **Host-authoritative** avoids desync and cheating: clients never mutate
  game state directly, they send intents (`BUILD_ROAD`, `ROLL_DICE`, …) and
  render whatever state the server broadcasts back.
- Avoids needing WebRTC/STUN/TURN or any internet dependency — plain
  WebSockets over the LAN work with zero configuration.

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Server runtime | Node.js + TypeScript | Shares types with client via a common package |
| Realtime transport | `ws` (or Socket.IO if reconnection/rooms ergonomics are worth the extra weight) | Simple, LAN-appropriate, no extra infra |
| Client framework | React + TypeScript, built with Vite | Fast dev loop, serves as static bundle from the Node server |
| Board rendering | SVG (custom hex-grid math) | Crisp at any zoom, easy to hit-test vertices/edges/tiles for building |
| Client state | A small store (Zustand or plain `useReducer` + context) that mirrors server-pushed state | Client is a "dumb" renderer of authoritative state |
| Monorepo layout | npm workspaces: `packages/shared` (types + board/rules logic), `packages/server`, `packages/client` | Rules engine and message types shared, no duplication/drift |
| Discovery | Host prints its LAN IP + QR code (`qrcode` npm pkg) in a terminal/host-only screen; optional `bonjour`/`mdns` broadcast so guests see the game auto-listed | Manual IP entry always works as fallback; mDNS is a nice-to-have |
| Testing | Vitest for unit tests (rules engine), Playwright for a scripted multi-tab integration test | Rules correctness is the highest-risk area |

## 4. Domain Model (packages/shared)

- **Board**: axial-coordinate hex tiles (19 tiles standard / 30 tiles for
  5-6p extension), each with a resource type + number token (or desert);
  vertices (settlement/city spots) and edges (road spots) derived from tile
  adjacency; ports placed on designated coastal edges.
- **Board generation**: shuffle-and-place algorithm respecting the fixed
  layout shape per player count, with a "no adjacent 6/8" fairness rule
  configurable on/off.
- **Player**: id, name, color, resource hand (private), dev card hand
  (private, tracks the turn bought to enforce "can't play the same turn"),
  victory points, pieces remaining (5 settlements/15 roads/4 cities is
  standard; 6p extension adds pieces).
- **GameState**: board, players, current turn index, phase enum
  (`SETUP_ROUND_1`, `SETUP_ROUND_2`, `ROLL`, `MAIN`, `ROBBER_DISCARD`,
  `ROBBER_MOVE`, `SPECIAL_BUILDING` [5-6p only], `GAME_OVER`), dev card
  deck, longest-road/largest-army holders, bank resource pool.
- **Actions (client → server intents)**: `ROLL_DICE`, `PLACE_SETUP_PIECE`,
  `BUILD_ROAD`, `BUILD_SETTLEMENT`, `BUILD_CITY`, `BUY_DEV_CARD`,
  `PLAY_DEV_CARD` (knight/road-building/year-of-plenty/monopoly),
  `MOVE_ROBBER`, `STEAL_FROM`, `DISCARD_RESOURCES`, `OFFER_TRADE`,
  `RESPOND_TRADE`, `BANK_TRADE`/`PORT_TRADE`, `END_TURN`,
  `START_SPECIAL_BUILDING` (5-6p).
- **Rules engine**: pure functions `applyAction(state, playerId, action) ->
  state | error`, fully unit-testable without any networking, so this is
  the piece to build and test first.

## 5. Networking Protocol

- Single WebSocket connection per client to `/ws?room=<code>&name=<name>`.
- Server → client messages are either a full `STATE_SYNC` (on join/reconnect)
  or small `STATE_PATCH` diffs after each validated action, plus
  player-private views (each player only ever receives their own resource
  hand in full; others' hands are counts only).
- Client → server messages are the `Action` union above, always
  acknowledged with either an updated state patch or an `ACTION_REJECTED`
  with a reason (so the UI can show "not your turn", "insufficient
  resources", etc.).
- **Reconnection**: client stores `{roomCode, playerToken}` in
  `localStorage`; on reload it reconnects and receives a fresh
  `STATE_SYNC`, replacing its socket in the room without ending the game.
- **Heartbeat/timeout**: ping/pong every ~10s; a disconnected player's seat
  is marked "away" but not removed, so a dropped WiFi connection doesn't
  end the game.

## 6. Lobby / Session Flow

1. Host runs `npm start` (or launches a packaged binary — see §9); server
   boots, prints `Host this game at: http://192.168.x.x:3000` plus a QR
   code.
2. Host's browser auto-opens to a "Create Game" screen: choose player count
   (4, 5, or 6) and house rules (fair board on/off, victory points target).
3. Other players open that URL on their own devices, enter a name, pick an
   available color, and see a shared waiting-room list.
4. Host clicks "Start Game" once 4-6 players are present (allow starting
   with fewer than the chosen max if host confirms, to support playing
   with e.g. 3).
5. Server generates the board for the chosen player count and transitions
   all clients into `SETUP_ROUND_1`.

## 7. Client UI Components

- `BoardView`: SVG hex board, click/tap targets for tiles (robber),
  vertices (settlements/cities), edges (roads); highlights only the
  currently-legal targets for the active action.
- `PlayerDock`: per-player summary strip (name, color, VP, resource/dev
  card counts) around the board edge.
- `HandPanel`: the local player's own resource + dev cards, always fully
  visible only to them.
- `ActionBar`: contextual buttons (Roll, Build Road/Settlement/City, Buy
  Dev Card, Play Dev Card, Trade, End Turn), disabled/enabled based on
  current phase and whose turn it is.
- `TradePanel`: bank/port trade calculator + player-to-player trade offer
  builder with accept/reject from other clients.
- `EventLog`: scrolling human-readable log ("Alice rolled 8", "Bob built a
  settlement") built from the same state patches, for shared awareness.

## 8. Player Count Variants (4 vs 5-6)

Handle this as **data, not branching game logic**: a `BoardLayout` config
per player count (tile counts/shape, port placement) and a `RuleSet` config
(piece counts, dev card deck composition, VP target, whether Special
Building Phase is enabled). The rules engine reads these configs so the
core turn/action logic is identical; only setup and the extra
`SPECIAL_BUILDING` phase (5-6p: players between the active player and the
next player may build out of turn after a roll) differ.

## 9. Packaging & Running on LAN

- Ship as a normal Node app (`npm run build && npm start`) — works
  cross-platform (Windows/Mac/Linux) as long as Node is installed on the
  host.
- Stretch goal: package the host process with `pkg`/`nexe` (or Electron if
  a native host window is preferred) into a double-clickable executable so
  non-technical hosts don't need Node installed.
- Document firewall guidance: host OS may prompt to allow inbound
  connections on the chosen port the first time it runs; note this in the
  README.
- Bind the HTTP/WS server to `0.0.0.0` (not `localhost`) so LAN peers can
  reach it.

## 10. Testing Strategy

- **Unit tests** (Vitest) on the rules engine: board generation validity,
  every action's legal/illegal transitions, dev card effects, longest
  road/largest army recalculation, win condition.
- **Simulation tests**: scripted full games driven entirely through the
  action API (no UI) to catch state-machine dead-ends.
- **Integration test**: Playwright script opening 4-6 browser tabs against
  a locally started server, playing a scripted opening (setup phase +
  a few turns) to catch protocol/UI wiring bugs.
- **Manual LAN test pass**: before calling a milestone done, actually run
  the host on one machine and join from ≥2 other physical devices on WiFi.

## 11. Milestone Roadmap

| Phase | Deliverable |
|---|---|
| 0 | Repo scaffold: npm workspaces, TS config, lint/test tooling, CI |
| 1 | Rules engine + board generation for 4p, fully unit-tested, no UI/network |
| 2 | Static board renderer (SVG) driven by a local mock state, no server yet |
| 3 | WebSocket server + lobby/join flow; 4 clients can connect and see a shared waiting room |
| 4 | Setup phase + core turn loop (roll, build, end turn) working end-to-end over the network |
| 5 | Trading (bank/port/player), dev cards, robber flow |
| 6 | Longest road / largest army tracking, win condition, game-over screen |
| 7 | 5-6 player extension: board/rule configs, Special Building Phase |
| 8 | LAN polish: QR join, reconnect handling, disconnect/away state, packaging |
| 9 | Playtesting pass + bug fixing with real groups over real WiFi |

## 12. Open Decisions (need input before/while building)

- Exact house rules to default to (fair board shuffle, victory point
  target, whether to allow the 5-6p extension's harbor/port variant).
- Whether to build a from-scratch monorepo now, or scaffold with
  `create-vite` + a plain `ws` server first and extract `shared` once the
  rules engine stabilizes.
- Art: hand-drawn/SVG tile art vs. plain flat-color hexes for v1 (flat
  color is far faster to ship and sidesteps trademark-art concerns).

## Where this should actually live

This plan was written into `interactive-health-tracker` only because that
was the repo/branch already wired up for this session, and repo creation
via the connected GitHub App isn't permitted here (403 on `create
repository`). Recommended next step: create a new empty GitHub repo by
hand (e.g. `catan-lan`) and either move this file there as the first
commit, or ask for it to be re-added to a Claude Code session so the actual
implementation (Phase 0 onward) happens in its own repo rather than inside
the health tracker project.
