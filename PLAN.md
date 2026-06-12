# Balatro MCP Connector — план реализации для агента (Claude Code)

> Цель: чтобы AI-агент через MCP мог **читать состояние** партии Balatro и **совершать ходы**
> (играть руку, скидывать, выбирать блайнд, покупать/продавать/рероллить в шопе, открывать паки)
> и таким образом играть в игру автономно.
>
> Этот документ — спека для агента-исполнителя. Команды/пути/код — на английском, пояснения — на русском.
> Везде, где я ссылаюсь на конкретные имена функций/полей в коде игры — **проверяй по исходнику**, а не верь на слово
> (Balatro обновляется, имена/энумы могут поехать).

---

## 0. TL;DR архитектуры

```
┌─────────────┐   MCP (stdio    ┌──────────────────┐   HTTP / JSON-RPC 2.0   ┌──────────────────────────┐
│  LLM-агент  │   или SSE)      │   MCP-сервер     │   POST на localhost      │  Balatro + Lovely +      │
│ (Claude /   │ ───────────────▶│   (TypeScript)   │ ───────────────────────▶ │  Steamodded + balatrobot │
│  Code / CLI)│ ◀─────────────── │  wrap'ит tools   │ ◀─────────────────────── │  (Lua-мод внутри игры)   │
└─────────────┘   tools          └──────────────────┘   game state JSON        └──────────────────────────┘
```

**Ключевое решение:** in-game Lua-часть мы НЕ пишем с нуля. Берём готовый `coder/balatrobot`,
который уже отдаёт JSON-RPC 2.0 HTTP API с полным контролем над игрой и сам ждёт, пока игра
«устаканится» после действия. Наша работа — **MCP-обёртка + слой агента**.

Декомпил Balatro нужен для двух вещей:
1. понять схему состояния (`G.GAME`, `G.hand`, `G.jokers`, `G.STATE`), чтобы сделать компактный снапшот для LLM;
2. если у balatrobot не хватает какого-то эндпоинта — дописать его в Lua (там как раз пригодится карта функций ниже).

---

## 1. Что скачать и зачем

| Что | Репо / источник | Зачем |
|---|---|---|
| **Balatro** | Steam (купленная копия) | Сама игра. Исходник лежит прямо внутри `.exe` (см. §2). |
| **Lovely Injector** | `https://github.com/ethangreen-dev/lovely-injector` | Рантайм-инжектор Lua для LÖVE-игр. Обязательная зависимость Steamodded и balatrobot. |
| **Steamodded (smods)** | `https://github.com/Steamodded/smods` | Мод-лоадер. Под него написан balatrobot. Вики: `https://github.com/Steamodded/smods/wiki` |
| **balatrobot (форк coder)** | `https://github.com/coder/balatrobot` | **Главный фундамент.** Lua-мод → JSON-RPC 2.0 HTTP API (карты/шоп/блайнды/стейт) + Python CLI для запуска и инъекции игры. |
| **balatrobot docs** | `https://coder.github.io/balatrobot/` + там есть `llms.txt` | Документация API в llms-friendly формате — **скорми её агенту первой**. |
| **MCP TS SDK** | `https://github.com/modelcontextprotocol/typescript-sdk` (npm: `@modelcontextprotocol/sdk`) | Для MCP-сервера на TS. |
| *(альт.)* MCP Python SDK | `https://github.com/modelcontextprotocol/python-sdk` (FastMCP) | Если хочешь сервер на питоне рядом с balatrobot CLI. |
| *(референс)* старый balatrobot | `https://github.com/besteon/balatrobot` | Оригинал (сокеты, не HTTP). Только для понимания истории, не использовать как базу. |
| *(референс)* read-only MCP | `https://github.com/abdelrahmanelmughrabi/balatro-mcp-server` | Пример MCP, который только советует ходы (экспорт стейта в JSON по F1). Полезно подсмотреть формат снапшота. |
| *(опц.)* awesome-balatro | `https://github.com/jie65535/awesome-balatro` | Каталог модов/тулзов, если понадобятся доп. утилиты (DebugPlus и т.п.). |
| *(опц.)* decompiled mirror | `https://github.com/gladmo/balatro` или `GladdonT/balatro-source-code` | Зеркало исходника на гитхабе, если лень распаковывать самому (юзать как read-only справку). |

> ⚠️ Версии: balatrobot чувствителен к версии Balatro/Steamodded/Lovely. Перед стартом сверь требования
> в README/CHANGELOG `coder/balatrobot` и поставь совместимые версии Steamodded и Lovely. Если падает —
> почти всегда это рассинхрон версий (см. besteon issue #2 как пример классического краша).

---

## 2. Как получить исходник Balatro и где что смотреть

Balatro — это Lua на LÖVE; **исходник читается без декомпиляции**, он лежит plaintext'ом внутри дистрибутива (~30k строк).

**Распаковка из своей копии:**
1. Найди `Balatro.exe` (Steam → ПКМ по игре → Manage → Browse local files).
2. Скопируй `.exe` в отдельную папку, переименуй в `Balatro.zip` (или открой 7-Zip'ом «Extract»).
3. Распакуй → получишь дерево исходника. Открой в VS Code.

> Это только для образовательного использования/моддинга — код не open-source, в репозиторий проекта его не коммить.

**Карта файлов (где что искать).** Имена могут отличаться по версии — это ориентир:

| Файл / папка | Что внутри | Зачем тебе |
|---|---|---|
| `main.lua` | Точка входа, `love.update`/`love.draw`, главный цикл. | Понять, где крутится игровой луп (туда хукается balatrobot). |
| `globals.lua` | Глобальный объект `G`, **энумы `G.STATES`** (SELECTING_HAND, SHOP, BLIND_SELECT, ROUND_EVAL, GAME_OVER, паки и т.д.). | **Источник правды по стейт-машине.** Сними точные значения отсюда. |
| `game.lua` | Инициализация `G.GAME`, структура раунда, деньги, анте, ставки, hand levels. | Схема `G.GAME.*` для снапшота состояния. |
| `functions/button_callbacks.lua` | Колбэки кнопок UI — то, что вызывается при кликах. Ищи: `play_cards_from_highlighted`, `discard_cards_from_highlighted`, `select_blind`, `skip_blind`, `buy_from_shop`, `reroll_shop`, `cash_out` / next-round, `use_card`, `sell_card`. | **Реестр действий.** Именно эти `G.FUNCS.*` дёргает мод, чтобы «нажать кнопку» программно. |
| `functions/common_events.lua` | Логика раунда, скоринг, level_up_hand и пр. | Понять, когда раунд считается завершённым. |
| `functions/state_events.lua` | Переходы стейт-машины. | Понять, в каком `G.STATE` какие действия легальны. |
| `engine/event.lua` | `Event` и `G.E_MANAGER:add_event(...)` — очередь анимаций/таймингов. | Ключ к «устаканиванию»: действие легально, только когда очередь событий пуста. |
| `engine/controller.lua` | Ввод/highlight карт, `card.highlighted`. | Как помечать карты выбранными перед игрой руки. |
| `card.lua`, `cardarea.lua` | `Card` и `CardArea` (`G.hand`, `G.jokers`, `G.shop_jokers`, `G.consumeables`, `G.play`). | Откуда читать руку/джокеры/шоп. `card.ability`, `card.base.suit/value`. |
| `blind.lua`, `tag.lua` | Блайнды и теги (skip-награды). | Схема выбора блайнда / скип-тегов. |

**Где живёт состояние в рантайме (для снапшота):**
- `G.STATE` — текущий режим (сверь с `G.STATES` из globals.lua).
- `G.GAME.dollars` — деньги; `G.GAME.round_resets.ante` — анте; `G.GAME.round` — номер раунда.
- `G.GAME.current_round.hands_left` / `discards_left` — остаток рук/сбросов.
- `G.GAME.blind` — текущий блайнд (требование по очкам, эффект).
- `G.hand.cards` — карты в руке (`.base.suit`, `.base.value`, `.ability`, enhancement/edition/seal).
- `G.jokers.cards` — джокеры (порядок важен!).
- `G.consumeables.cards` — таро/планеты/спектры.
- `G.shop_jokers.cards`, `G.shop_booster.cards`, `G.shop_vouchers.cards` — содержимое шопа.
- `G.GAME.hands` — уровни покерных рук (levels/chips/mult).

> ⚠️ **Не дампи весь `G`** — он огромный и с циклическими ссылками. Делай curated snapshot строго из полей выше.

---

## 3. Фазы реализации (с критериями приёмки)

### Фаза 0 — окружение и проверка готового API ✅
**Задачи:**
1. ✅ Установить Lovely Injector + Steamodded
2. ✅ Установить `coder/balatrobot` (Lua-мод в Mods + Python CLI)
3. ✅ Запустить игру через balatrobot CLI
4. ✅ Проверить health-эндпоинт и gamestate

**Приёмка:** ✅ `{"result":{"status":"ok"}}` — health работает, gamestate возвращает полное состояние игры.

---

### Фаза 1 — инвентаризация API balatrobot ✅
**Задачи:**
1. ✅ Изучена документация `coder.github.io/balatrobot/` + `llms-full.txt`
2. ✅ Составлена полная таблица 21 эндпоинта с параметрами и состояниями
3. ✅ Сняты реальные примеры запросов/ответов с живой игры
4. ✅ Задокументирована схема GameState

**Приёмка:** ✅ `docs/api-surface.md` + `docs/state-schema.md`.

---

### Фаза 2 — MCP-сервер (TypeScript), обёртка над HTTP ✅
**Задачи:**
1. ✅ Проект на `@modelcontextprotocol/sdk` (stdio transport)
2. ✅ HTTP-клиент к balatrobot на undici с host/port/config
3. ✅ **15 MCP-tools**, 1:1 на эндпоинты balatrobot:
   - `get_game_state`, `get_legal_actions`
   - `play_hand`, `discard`, `rearrange_jokers`
   - `select_blind`, `skip_blind`
   - `shop_buy`, `shop_sell`, `shop_reroll`, `next_round`
   - `use_consumable`, `pack_pick`
   - `cash_out`, `start_run`
4. ✅ Каждый tool возвращает обновлённое состояние
5. ✅ Человекочитаемые ошибки (например, `INVALID_STATE - требуется SHOP`)

**Приёмка:** ✅ все tools протестированы на живой партии через MCP Inspector

---

### Фаза 3 — слой состояния для LLM (summarizer + легальные ходы) ✅
**Задачи:**
1. ✅ `summarizeState(raw)` — сырой ~14KB → компактный ~2KB
2. ✅ `computeLegalActions(state)` по `G.STATE` — покрыты все состояния
3. ✅ JSON-вью для LLM (compact snapshot без циклических ссылок)
4. ❌ (не сделано) Подсказки покерных комбинаций

**Приёмка:** ✅ `get_game_state` ~2KB; `get_legal_actions` не предлагает нелегальных ходов

---

### Фаза 4 — агент и подключение ✅
**Задачи:**
1. ✅ MCP-сервер прописан в `opencode.jsonc` (stdio, `node dist/server.js`)
2. ✅ Системный промпт: `src/agent/SYSTEM_PROMPT.md`
3. ✅ Игровой луп: `src/agent/player.ts` — `runGameLoop(client, decideFn)`

**Приёмка:** ✅ агент (через opencode) прошёл Small Blind + Big Blind Ante 1 и дошёл до The Needle Ante 2

---

### Фаза 5 — харденинг и эвал ✅
**Задачи:**
1. ✅ Ретрансы (3 попытки), таймауты (10s), AbortController в HTTP-клиенте
2. ✅ JSONL-логирование каждого хода (`logs/eval-run-N.jsonl`)
3. ✅ `src/eval.ts` — spawn игры, прогон N партий, сбор метрик
4. ✅ Headless/fast-режим (`--fast`)

**Приёмка:** ✅ `node dist/eval.js N` — гоняет N партий, пишет JSONL + сводку (`logs/eval-summary.json`)

---

### Фаза 6 (стретч) — расширение Lua, если чего-то не хватает
Если у balatrobot нет нужного действия (например, тонкий контроль reorder/конкретный пак):
1. По карте из §2 найди нужный `G.FUNCS.*` в `functions/button_callbacks.lua`.
2. Добавь endpoint в Lua-часть мода (`src/lua/`), который ставит `card.highlighted`/готовит аргументы и зовёт этот FUNC через `G.E_MANAGER:add_event(...)`.
3. Добавь соответствующий MCP-tool в обёртку.

**Приёмка:** новый эндпоинт работает на живой партии и не ломает устаканивание.

---

### Фаза 7 — LLM-бенчмарк + live-трансляция (одна event-шина)

Расширяем эвал из Фазы 5 до полноценного бенчмарка моделей и параллельно стримим партии в веб.
**Ключ:** и бенчмарк, и трансляция питаются из **одной шины событий**, которую агентский луп эмитит на каждом ходу.

```
agent loop ──emit event──▶ event bus ──┬─▶ SQLite   (персист → лидерборд/стата)
   (state, reasoning,                   └─▶ SSE/WS   (broadcast → схематичный сайт)
    action, result)
```

Тапить поток нужно **на уровне агента** (Фаза 4), а не balatrobot'а — только там есть И стейт игры, И reasoning модели
(reasoning — самое ценное и для разбора, и для зрителя).

**Схема события (JSONL / по WS):**
```jsonc
{ "type": "state",    "gameId": "...", "model": "...", "seed": 12345, "ts": 0, "state": { /* summarized snapshot из Фазы 3 */ } }
{ "type": "decision", "gameId": "...", "model": "...", "ts": 1, "reasoning": "...", "action": { /* tool+args */ }, "legalActions": [ ... ] }
{ "type": "result",   "gameId": "...", "model": "...", "ts": 2, "outcome": "ante_cleared|game_over", "finalAnte": 5, "dollars": 23 }
```

#### 7a. Бенчмарк-харнесс
**Задачи:**
1. **Детерминизм:** прогоны на фиксированном наборе сидов (Balatro сид-детерминирован → честное сравнение моделей на идентичных раскладах). Параметризовать stake (white→gold) и деку.
2. **Заморозить скаффолд:** один системный промпт, один набор tools, одно представление состояния из Фазы 3. Меняется ТОЛЬКО `model`. Иначе меришь промпт, а не модель.
3. **Метрики** в SQLite: max анте (primary), win-rate (добил анте 8 / endless), средние деньги, распределение «доживания» по анте, доля нелегальных попыток ходов (= понимание правил), токены и $ на партию.
4. **Дисперсия:** N сидов × K прогонов, репорт mean ± CI, не одиночный ран.
5. **Лидерборд:** агрегирующий запрос по SQLite + простая страница/JSON-эндпоинт с таблицей моделей.

**Приёмка:** `bench/run.ts --models a,b,c --seeds <set> --runs K` гоняет матрицу, пишет в SQLite; `bench/leaderboard` отдаёт сводку с mean ± CI по каждой модели.

#### 7b. Live-трансляция (без OBS, стримим стейт, а не пиксели)
**Задачи:**
1. **Релей/хаб** (Node/TS): держит последний стейт по каждой комнате `gameId`, рассылает апдейты подписчикам. Для чистого «смотреть» — **SSE** (односторонний, автореконнект из коробки); **WS** — если захочешь интерактив (зрители голосуют за ход). Агентский луп просто POST'ит события в хаб.
2. **Фронт** (React + SVG): схематичная доска — рука (suit/rank/enhancement/edition/seal), джокеры по порядку, требование блайнда, счёт, остаток рук/сбросов, шоп; сбоку — живая панель reasoning. Снапшот ~2–4 КБ, пуш раз в несколько секунд → near-realtime бесплатно, сотни зрителей с копеечного VPS.
3. **Мультиигры:** комнаты по `gameId` → можно показывать несколько моделей сразу и тут же лидерборд из 7a.
4. **Реплеи бесплатно:** тот же фронт проигрывает прошлую партию, стримя JSONL-лог (Фаза 5) через хаб. Live и replay — один компонент.

**Приёмка:** открываешь сайт → видишь живую партию агента в схематичном виде с обновлением near-realtime и панелью reasoning; переключение между активными `gameId`; реплей записанной партии из лога.

---

## 4. Грабли (прочитать до старта)

- **Single-thread 60fps.** Игра — один поток. Нельзя блокировать луп. (balatrobot это уже решает; если будешь трогать Lua — сетевое только не блокирующе, на отдельном `love.thread` + Channel.)
- **Асинхронность скоринга.** После действия состояние меняется не сразу — крутятся анимации через `G.E_MANAGER`. Читать новый стейт можно только когда очередь событий пуста и `G.STATE` стабилен. Tool = `execute → wait until settled → return`.
- **Действия = вызовы `G.FUNCS.*`, не «клики».** Сыграть руку = пометить `card.highlighted` нужным картам + вызвать `play_cards_from_highlighted`. Не пытайся эмулировать мышь.
- **`G.STATE` определяет легальность.** Покупка в SELECTING_HAND, игра руки в SHOP — крашнет или проигнорится. Всегда сверяйся с состоянием.
- **Порядок джокеров = часть стратегии.** В снапшоте сохраняй порядок, дай агенту tool на reorder.
- **Не сериализуй весь `G`** — циклы и мегабайты. Только curated поля.
- **Индексы карт.** Чётко определи, что значит `card_indices` (позиция в `G.hand.cards` слева-направо) и зафиксируй в доке tool'а, иначе агент будет промахиваться.
- **Версии.** Несовместимость Balatro/Steamodded/Lovely/balatrobot — причина №1 крашей. Сначала собери стек, потом код.

---

## 5. Что агенту прочитать ПЕРВЫМ делом

1. `https://coder.github.io/balatrobot/` + `llms.txt` — API и протокол.
2. `coder/balatrobot` → `src/lua/` (как мод цепляется к игре) и `src/balatrobot/` (CLI/launch).
3. `coder/balatrobot` → `CLAUDE.md` (там уже есть гайд по проекту для агентов).
4. Декомпил: `globals.lua` (энумы `G.STATES`) и `functions/button_callbacks.lua` (`G.FUNCS`).
5. Steamodded wiki: страницы `G` (All About G) и `Guide ‐ Event Manager`.
6. MCP TS SDK README — паттерн объявления tools и stdio-transport.

---

## 6. Текущая структура проекта

```
D:\code\balatro-mod\
├── PLAN.md                    # План реализации (этот файл)
├── package.json               # npm-проект (MCP SDK + undici + zod)
├── tsconfig.json
├── run_server.ps1             # Скрипт запуска игры
├── docs/                      # Фаза 1 ✅
│   ├── api-surface.md         #   карта 21 эндпоинта
│   └── state-schema.md        #   схема GameState
├── src/                       # Основной код
│   ├── server.ts              #   MCP server (stdio) — 15 tools
│   ├── eval.ts                #   Фаза 5: eval-харнесс
│   ├── client/
│   │   └── balatrobot.ts      #   HTTP-клиент (retry/timeout/log)
│   ├── state/
│   │   └── summarizer.ts      #   Фаза 3: снапшот + легальные ходы
│   ├── tools/
│   │   └── balatro-tools.ts   #   Фаза 2: обёртка tools
│   └── agent/
│       ├── player.ts          #   Фаза 4: игровой луп
│       └── SYSTEM_PROMPT.md   #   Фаза 4: промпт для LLM
├── dist/                      # Скомпилированный JS
├── logs/                      # JSONL логи + сырые логи игры
├── bench/                     # Скелет Фазы 7a (пусто)
├── stream/                    # Скелет Фазы 7b (пусто)
└── web/                       # Скелет Фазы 7b (пусто)
```