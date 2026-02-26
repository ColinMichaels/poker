# Poker Logic Extraction

This document extracts reusable game concepts from the current codebase and restates them as framework-agnostic domain behavior.

## Canonical Concepts to Keep

## `Card`

Fields to preserve:

- `rank`: 2-14 (with `A=14`)
- `suit`: `C|D|H|S`
- `code`: e.g. `AS`, `10D`, `QC`
- `display`: title, icon, asset path

## `Deck`

Behavior:

- Construct standard 52-card deck
- Shuffle with unbiased algorithm
- Draw top N cards
- Track remaining count
- Optional: burn card support for Hold'em rounds

## `Player`

Behavior:

- Hold hole cards
- Track stack/wallet
- Place bet/call/raise/fold/check/all-in
- Optionally hold seat/avatar profile

## `Table/Game`

Behavior:

- Manage seats and dealer button
- Manage betting rounds and pot
- Enforce minimum/maximum buy-in and blinds/antes
- Manage turn order and legal actions
- Produce showdown and payouts

## `Hand Evaluation`

Behavior:

- Evaluate 5-card and 7-card holdings
- Return normalized result:
  - category (e.g. `FULL_HOUSE`)
  - tie-break vector (kickers/ordered ranks)
  - human-readable label

## Hand Categories Observed in Repo

From current UI and evaluator content:

1. Royal Flush
2. Straight Flush
3. Four of a Kind
4. Full House
5. Flush
6. Straight
7. Three of a Kind
8. Two Pair
9. Pair
10. High Card

## State Machine to Use in Rebuild (Texas Hold'em)

1. `LOBBY`
2. `SEATED`
3. `BLINDS_POSTED`
4. `DEAL_HOLE`
5. `BETTING_PRE_FLOP`
6. `DEAL_FLOP`
7. `BETTING_FLOP`
8. `DEAL_TURN`
9. `BETTING_TURN`
10. `DEAL_RIVER`
11. `BETTING_RIVER`
12. `SHOWDOWN`
13. `PAYOUT`
14. `HAND_COMPLETE`

## Reusable Formulas and Utilities

- Chip denomination splitting (`[1,5,10,25,50,100,500,1000]`) is valid and reusable.
- Existing bitmath hand ranker in `legacy/resources/js/plugins/game/GamePlugin.js` can be used as reference test oracle, but should be re-implemented in typed domain code.

## Logic Gaps to Fix During Migration

- One source of truth for deck and hand evaluation (remove duplicates).
- Define explicit action legality rules per phase.
- Replace event-bus side effects with deterministic reducers/state transitions.
- Add full test coverage for evaluator and betting edge cases.

## Suggested New Domain Interfaces

```ts
export type Suit = 'C' | 'D' | 'H' | 'S';

export interface Card {
  rank: 2|3|4|5|6|7|8|9|10|11|12|13|14;
  suit: Suit;
  code: string;
}

export interface HandRank {
  category:
    | 'ROYAL_FLUSH' | 'STRAIGHT_FLUSH' | 'FOUR_KIND' | 'FULL_HOUSE'
    | 'FLUSH' | 'STRAIGHT' | 'THREE_KIND' | 'TWO_PAIR' | 'PAIR' | 'HIGH_CARD';
  label: string;
  tiebreak: number[];
}
```
