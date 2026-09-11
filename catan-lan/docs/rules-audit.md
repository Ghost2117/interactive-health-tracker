# Catan Rules Audit

A complete checklist of the official Catan ruleset (base 4-player game +
5-6 Player Extension), compiled from the official rulebooks, cross-referenced
against this implementation. Sources:

- *Catan: Game Rules & Almanac* (5th English edition, Catan GmbH / Catan
  Studio, © 2015) — the base game rulebook.
- *Catan: 5-6 Player Extension* rulebook (Catan Studio, © 2020).

Status legend: ✅ implemented correctly · 🔧 bug found and fixed in this pass ·
⚠️ intentional/documented simplification (see `README.md`).

## Components & board

| Rule | Status |
|---|---|
| 19 land hexes: 1 desert, 4 hills(brick), 4 forest(lumber), 3 mountains(ore), 4 fields(grain), 4 pasture(wool) | ✅ |
| 18 number tokens 2-12, one each of 2 and 12, two each of the rest, no 7 | ✅ |
| Board shape: rows of 3-4-5-4-3 hexes | ✅ |
| Robber starts on the desert | ✅ |
| Fairness option: no two 6/8 tokens adjacent | ✅ (`fairLayout`) |
| 9 harbors: 4 generic 3:1 + one 2:1 per resource (5) | ✅ |
| 5-6p: 30 land hexes total = 2 desert, 5 hills, 6 forest, 5 mountains, 6 fields, 6 pasture | ✅ |
| 5-6p: 28 number tokens (no 7, one extra 2 and 12 vs. doubling, three of most others) | ✅ (approximated distribution) |
| 5-6p: 11 harbors total = base 9 **+ 1 more generic 3:1 + 1 more wool 2:1** (i.e. 5 generic + 6 resource-specific, with wool appearing twice) | 🔧 was 6 generic + 5 resource-specific (missing the second wool harbor) |
| Bank: 19 of each resource (base); 5-6p adds 24 more (4 of each non-desert resource) | ✅ (documented as an approximation — see README) |
| Dev card deck: 14 knight, 5 VP, 2 each of Road Building/Year of Plenty/Monopoly (25 total, base) | ✅ |
| 5-6p dev cards: +9 (6 knight, 1 monopoly, 1 Year of Plenty, 1 Road Building) | ✅ |
| Piece limits: 5 settlements, 4 cities, 15 roads per player (same at every player count) | ✅ |

## Setup phase

| Rule | Status |
|---|---|
| Each player places settlement + adjacent road, in turn order, twice (snake draft: forward then reverse) | ✅ |
| Distance rule applies during setup too | ✅ |
| Second settlement's road may point in any of its 3 directions | ✅ (any unoccupied edge on that vertex) |
| Second settlement grants 1 resource per adjacent non-desert hex; first settlement grants nothing | ✅ |
| Starting player determined randomly (physically: highest dice roll) | ✅ (digital equivalent: random seat shuffle) |

## Turn structure

| Rule | Status |
|---|---|
| Roll dice → trade → build, in that order; dev card may be played "at any time during your turn" (i.e. before or after rolling) | 🔧 dev cards were locked to post-roll only; fixed to allow the 'roll' phase too |
| Rolling a 7: no production; players with >7 cards discard half (rounded down); active player moves robber then steals | ✅ |
| Robber must move to a *different* hex; cannot stay put | ✅ |

## Resource production

| Rule | Status |
|---|---|
| Each settlement on a producing hex = 1 card; each city = 2 cards | ✅ |
| Hex under the robber produces nothing | ✅ |
| If the bank can't cover every entitled player's production for a resource, **no one** gets that resource this roll | ✅ |
| **Exception**: if the shortage affects only a single entitled player, that player gets whatever's left in the bank (not zero) | 🔧 was treated the same as the multi-player case (zero); fixed |
| A shortage in one resource doesn't affect production of other resources that roll | ✅ |

## Building

| Rule | Status |
|---|---|
| Road: brick + lumber; must connect to the player's own road/settlement/city | ✅ |
| Settlement: brick + lumber + wool + grain; distance rule (all 3 neighboring intersections vacant); must connect to the player's own road | ✅ |
| City: 3 ore + 2 grain; upgrades an existing settlement in place, returning the settlement piece to supply | ✅ |
| Dev card: ore + wool + grain; drawn from the shuffled deck; errors if deck empty | ✅ |
| Can't build past piece limits (5 settlements/4 cities/15 roads); must free up a settlement via a city upgrade to build a 6th "settlement" | ✅ (enforced via the `roadsLeft`/`settlementsLeft`/`citiesLeft` counters) |

## Trading

| Rule | Status |
|---|---|
| Domestic trade only with the active player; other players can't trade among themselves | ✅ |
| Maritime (bank) trade: 4:1 always available | ✅ |
| Generic harbor: 3:1 any resource | ✅ |
| Resource-specific harbor: 2:1 for that exact resource only, no better rate for anything else | ✅ |
| Can't trade a resource for itself | 🔧 added explicit guard |
| Can't trade with the bank on another player's turn | ✅ (enforced by the turn/phase gate) |
| Can't give cards away for nothing, or trade development cards | ✅ (trade always exchanges named resource amounts; dev cards have no trade action at all) |

## Development cards

| Rule | Status |
|---|---|
| One dev card played per turn max, playable any time during your turn (before or after rolling) | 🔧 timing fixed (see Turn structure) |
| Can't play a card bought the same turn (exception: victory point cards, which are never "played" as an action) | ✅ |
| **Knight**: move the robber + steal, same as a rolled 7's robber step; first to 3 face-up knights takes Largest Army (2 VP), transfers if strictly exceeded | ✅ |
| **Road Building**: place 2 free roads "according to normal building rules" (i.e. they must still connect to your network) | 🔧 previously had no connectivity check at all; fixed (also allows the two new roads to chain off each other) |
| **Year of Plenty**: take any 2 resources from the bank (same or different types) | ✅ |
| **Monopoly**: name a resource; every other player must give up all of that resource (nothing owed if they have none) | ✅ |
| **Victory Point**: hidden, worth 1 VP, counts immediately toward winning (no separate "play" action) | ✅ |

## Longest Road / Largest Army

| Rule | Status |
|---|---|
| Longest Road: first to a continuous run of ≥5 road segments (branches don't add up, only the longest branch counts) | ✅ |
| An opponent's settlement/city breaks a road's continuity for counting purposes | ✅ |
| Holder keeps the card while tied for the new maximum | ✅ |
| If the holder no longer has the (sole) longest road: transfers to the new sole leader; if multiple players tie for the new max, the card is set aside until one player has a strictly longest ≥5 road again | ✅ |
| Largest Army: same transfer logic, threshold 3 knights | ✅ |

## Victory

| Rule | Status |
|---|---|
| 10 VP to win; can only win on your own turn | ✅ (checked after every VP-affecting action, all of which only occur on the acting/current player's turn) |
| Settlement 1 VP, city 2 VP, Longest Road 2 VP, Largest Army 2 VP, each VP card 1 VP | ✅ |

## 5-6 Player Extension: Special Building Phase

| Rule | Status |
|---|---|
| Runs after the active player's normal turn, once per turn, for every other player in turn order | ✅ |
| Allowed: build roads/settlements/cities, buy development cards, using only resources already in hand | ✅ |
| **Not allowed**: playing development cards | ✅ |
| **Not allowed**: domestic trade (with other players) | 🔧 was allowed; fixed |
| **Not allowed**: maritime trade (bank or harbors) | 🔧 was allowed; fixed |

## Known intentional simplifications (documented in README, not "gaps")

- 5-6p bank/dev-card totals approximate the official expansion rather than
  reproducing exact physical card counts card-for-card.
- Harbor tiles are placed algorithmically around the coastline in the
  correct ratios, not at the exact physical board positions.
- Board art is original/abstracted rather than reproducing Catan's
  trademarked illustrations.
