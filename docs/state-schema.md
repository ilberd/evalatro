# BalatroBot GameState Schema

> Schema of the game state object returned by `gamestate` and most action endpoints.

## Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `state` | string | Current game state (see states below) |
| `round_num` | int | Current round number |
| `ante_num` | int | Current ante number |
| `money` | int | Current money |
| `deck` | string | Deck identifier (e.g., `RED`, `BLUE`) |
| `stake` | string | Stake level (e.g., `WHITE`, `RED`) |
| `seed` | string | Run seed |
| `won` | bool | Whether run is won |
| `used_vouchers` | string[] | Used voucher keys |
| `hands` | object | Poker hand levels (keyed by hand name) |
| `round` | object | Round-specific state |
| `blinds` | object | Blind info (small/big/boss) |
| `jokers` | object | Joker card area |
| `consumables` | object | Consumable card area |
| `cards` | object | Full deck (cards remaining) |
| `hand` | object | Hand card area |
| `shop` | object | Shop cards |
| `vouchers` | object | Shop vouchers |
| `packs` | object | Shop booster packs |
| `pack` | object | Opened booster pack |

## Area Schema

```json
{
  "count": 8,
  "limit": 8,
  "highlighted_limit": 5,
  "cards": [Card, ...]
}
```

## Card Schema

```json
{
  "id": 1,
  "key": "H_A",
  "set": "DEFAULT",
  "label": "Ace of Hearts",
  "value": { "suit": "H", "rank": "A", "effect": "..." },
  "modifier": {
    "seal": null, "edition": null, "enhancement": null,
    "eternal": false, "perishable": null, "rental": false
  },
  "state": { "debuff": false, "hidden": false, "highlight": false },
  "cost": { "sell": 1, "buy": 0 }
}
```

## Round Schema

```json
{
  "hands_left": 4, "hands_played": 0,
  "discards_left": 3, "discards_used": 0,
  "reroll_cost": 5, "chips": 0
}
```

## Blind Schema

```json
{
  "type": "SMALL", "status": "SELECT",
  "name": "Small Blind", "effect": "...",
  "score": 300,
  "tag_name": "...", "tag_effect": "..."
}
```

## Hand (Poker Hand Info)

```json
{
  "order": 1, "level": 1, "chips": 10, "mult": 1,
  "played": 0, "played_this_round": 0,
  "example": [["H_A", true], ["H_K", true]]
}
```

## States

- `MENU` — Main menu (can start new run)
- `BLIND_SELECT` — Select/skip a blind
- `SELECTING_HAND` — Play/discard cards
- `ROUND_EVAL` — Cash out round rewards
- `SHOP` — Buy/sell/reroll
- `SMODS_BOOSTER_OPENED` — Pick from booster pack
- `GAME_OVER` — Run ended

## Card Sets

`DEFAULT`, `ENHANCED`, `JOKER`, `TAROT`, `PLANET`, `SPECTRAL`, `VOUCHER`, `BOOSTER`

## Enums

Deck, Stake, Suit (H/D/C/S), Rank (2-9,T,J,Q,K,A), Seal (RED/BLUE/GOLD/PURPLE),
Edition (FOIL/HOLO/POLYCHROME/NEGATIVE), Enhancement (BONUS/MULT/WILD/GLASS/STEEL/STONE/GOLD/LUCKY)
