# Asset Inventory and Reuse Plan

## Inventory Summary

Under `public/Poker/`:

- `cards/`: 60 files (~1.9 MB)
- `chips/`: 8 files (~32 KB)
- `avatars/`: 33 files (~436 KB)
- `sounds/`: 12 files (~168 KB)
- `logos/`: 4 files (~92 KB)

Total `public/Poker/`: ~2.6 MB

## Asset Groups

## Cards

Path: `public/Poker/cards/`

Contains:

- Standard face card SVGs (`2C.svg` ... `AS.svg`)
- Three card backs (`Card_back_01.svg`, `Card_back_02.svg`, `Card_back_06.svg`)
- Extra sheet/file (`Red_52_Faces_v.2.0.svg`)
- Additional `11*.svg` cards likely alternate Jack naming artifacts

Reuse recommendation:

- Keep SVG card faces and selected card back as-is for MVP.
- Normalize naming in build step to strict canonical card code list.
- Keep `Red_52_Faces_v.2.0.svg` as optional atlas source for later optimization.

## Chips

Path: `public/Poker/chips/`

Denominations present and complete:

- `1, 5, 10, 25, 50, 100, 500, 1000`

Reuse recommendation:

- Direct reuse.
- Generate a manifest file in new app to map denomination -> texture URL.

## Avatars

Path: `public/Poker/avatars/`

Contains 33 SVGs (people, robots, pop-culture style icons).

Reuse recommendation:

- Reuse all, but curate defaults for legal/commercial safety depending on launch target.
- Normalize display names and tags in metadata (`id`, `label`, `theme`, `sound`).
- Fix typo mismatch currently present (`traditiona-japanese-man.svg`).

## Sounds

Path: `public/Poker/sounds/`

Includes:

- Card/chip interactions (`card`, `chip`, `chip2`, `chip3`, `shuffle`)
- Character/novelty effects (`im-batman`, `robot-*`, `we_have_losers`, `tada`)

Reuse recommendation:

- Keep interaction sounds for gameplay.
- Move novelty clips into optional/emote/sfx packs.
- Add volume profile defaults and mute categories (`ui`, `table`, `voice`).

## Logos

Path: `public/Poker/logos/`

Contains:

- `poker_logo.svg`
- `poker_logo_main.svg`
- PNG variants

Reuse recommendation:

- Use SVG variants as brand source.
- Keep PNG only for fallback/social cards.

## Packaging Plan for New Build

Create an asset manifest package:

```json
{
  "cards": { "AS": "/assets/cards/AS.svg", "...": "..." },
  "cardBacks": ["/assets/cards/Card_back_06.svg"],
  "chips": { "1": "/assets/chips/1.svg", "1000": "/assets/chips/1000.svg" },
  "avatars": [{"id":"robot-01","src":"/assets/avatars/robot-01.svg"}],
  "sounds": {"card":"/assets/sounds/card.mp3"}
}
```

## Cleanup Tasks Before Import

1. Remove or map duplicate/noncanonical card names (`11*`, typoed/legacy IDs).
2. Add checksums for cache-busting and integrity checks.
3. Add per-asset license/provenance notes.
4. Convert frequently used SVGs to Babylon-friendly texture loading strategy (preload + lazy load tiers).

