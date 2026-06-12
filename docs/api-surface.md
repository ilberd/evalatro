# BalatroBot API Surface

> Inventory of all JSON-RPC 2.0 endpoints provided by `coder/balatrobot` v1.5.1.
> Protocol: HTTP/1.1, Content-Type: `application/json`
> Default endpoint: `http://127.0.0.1:12346`

## Request / Response Format

```json
// Request
{"jsonrpc":"2.0","method":"method_name","params":{...},"id":1}

// Success
{"jsonrpc":"2.0","result":{...},"id":1}

// Error
{"jsonrpc":"2.0","error":{"code":-32001,"message":"...","data":{"name":"BAD_REQUEST"}},"id":1}
```

## Methods

### Health — `health`
No params. Returns `{"status":"ok"}`.

### Game State — `gamestate`
No params. Returns full [GameState](#gamestate-schema).

### OpenRPC Spec — `rpc.discover`
No params. Returns OpenRPC schema document.

### Start Run — `start`
**Params:** `deck` (string, req), `stake` (string, req), `seed` (string, opt)
**State:** `MENU` → `BLIND_SELECT`
**Returns:** GameState

### Return to Menu — `menu`
No params. Returns GameState (state=`MENU`).

### Save / Load — `save` / `load`
**Params:** `path` (string, req)

### Select Blind — `select`
No params. State: `BLIND_SELECT` → `SELECTING_HAND`

### Skip Blind — `skip`
No params. State: `BLIND_SELECT` → next state (Small/Big only)

### Buy — `buy`
**Params (exactly one):** `card` (int), `voucher` (int), `pack` (int)
**State:** `SHOP` → updated state

### Pack Select — `pack`
**Params (exactly one):** `card` (int), `targets` (int[]), `skip` (bool)
**State:** `SMODS_BOOSTER_OPENED`

### Sell — `sell`
**Params (exactly one):** `joker` (int), `consumable` (int)
**State:** Any (SHOP/SELECTING_HAND)

### Reroll — `reroll`
No params. State: `SHOP`. Costs money.

### Cash Out — `cash_out`
No params. State: `ROUND_EVAL` → `SHOP`

### Next Round — `next_round`
No params. State: `SHOP` → `BLIND_SELECT`

### Play Hand — `play`
**Params:** `cards` (int[], req, 1-5 cards)
**State:** `SELECTING_HAND`

### Discard — `discard`
**Params:** `cards` (int[], req)
**State:** `SELECTING_HAND`

### Rearrange — `rearrange`
**Params (exactly one):** `hand` (int[]), `jokers` (int[]), `consumables` (int[])
**State:** Varies by target

### Use Consumable — `use`
**Params:** `consumable` (int, req), `cards` (int[], opt)
**State:** Any

### Add Card — `add`
**Params:** `key` (string, req), `seal`/`edition`/`enhancement`/`eternal`/`perishable`/`rental` (opt)

### Screenshot — `screenshot`
**Params:** `path` (string, req)

### Set Values — `set`
**Params:** `money`/`chips`/`ante`/`round`/`hands`/`discards`/`shop`

## Game States

| State | Description |
|---|---|
| `MENU` | Main menu |
| `BLIND_SELECT` | Choosing blind to play/skip |
| `SELECTING_HAND` | Selecting cards to play/discard |
| `ROUND_EVAL` | Round complete, ready to cash out |
| `SHOP` | Shopping phase |
| `SMODS_BOOSTER_OPENED` | Booster pack opened |
| `GAME_OVER` | Game ended |
