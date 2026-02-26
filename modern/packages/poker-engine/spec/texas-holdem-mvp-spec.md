# Texas Hold'em MVP Spec (Draft)

## Scope

This spec defines the first playable ruleset for the modern poker engine.

## Table Rules

- Seats: 2 to 9 players (MVP target supports at least 2 to 6 in UI)
- Deck: standard 52-card deck
- Blinds: required each hand (`smallBlind`, `bigBlind` from config)
- Antes: not required in MVP

## Hand Lifecycle

1. Start hand
2. Post blinds
3. Deal two hole cards to each active player
4. Pre-flop betting round
5. Burn + flop (3 community cards)
6. Flop betting round
7. Burn + turn (1 card)
8. Turn betting round
9. Burn + river (1 card)
10. River betting round
11. Showdown
12. Payout and hand complete

## Betting Rules (MVP)

- Legal actions depend on amount to call and player stack.
- Minimum raise equals previous full raise size (or big blind preflop baseline).
- All-in under-raise is allowed but does not always reopen raising.
- Side pots are required when all-ins occur with unequal stacks.

## Showdown Rules

- Best 5-card hand from 7 cards (2 hole + 5 board).
- Category ranking order:
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
- Ties split pot(s) evenly with odd-chip policy documented separately.

## Determinism Requirements

- Hand setup uses injected RNG seed.
- Reducer is pure: same state + command => same output.
- Domain emits ordered events to drive rendering/audio.

## Deferred (Post-MVP)

- Tournament blind levels
- Run-it-twice
- Straddles / button ante
- Insurance and rabbit hunting
