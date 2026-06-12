import { GameState, Card, CardArea } from "../client/balatrobot.js";

const LEGAL_STATES: Record<string, { state: string; actions: string[] }> = {
  MENU: { state: "Main menu. Can start a new run.", actions: ["start"] },
  BLIND_SELECT: { state: "Choosing a blind to play or skip.", actions: ["select", "skip"] },
  SELECTING_HAND: { state: "Selecting cards to play or discard.", actions: ["play", "discard", "rearrange_hand", "rearrange_jokers", "rearrange_consumables", "use"] },
  ROUND_EVAL: { state: "Round complete. Ready to cash out.", actions: ["cash_out"] },
  SHOP: { state: "Shopping phase.", actions: ["buy_card", "buy_voucher", "buy_pack", "sell_joker", "sell_consumable", "reroll", "use", "rearrange_jokers", "rearrange_consumables", "next_round"] },
  SMODS_BOOSTER_OPENED: { state: "Booster pack opened. Pick a card or skip.", actions: ["pack_pick", "pack_skip", "pack_pick_targets", "use"] },
  GAME_OVER: { state: "Game over. Return to menu.", actions: ["menu"] },
};

export function computeLegalActions(state: string): { state: string; actions: string[] } {
  return LEGAL_STATES[state] ?? { state: `Unknown state: ${state}`, actions: [] };
}

export interface SummarizedState {
  state: string;
  ante: number;
  round: number;
  money: number;
  deck: string;
  stake: string;
  seed: string;
  blind: { name: string; type: string; score: number; status: string } | null;
  score: { chips: number; target: number };
  hands_left: number;
  discards_left: number;
  hand_cards: CardSummary[];
  jokers: CardSummary[];
  consumables: CardSummary[];
  shop?: { cards: CardSummary[]; vouchers: CardSummary[]; packs: CardSummary[] };
  poker_hands: { name: string; level: number; chips: number; mult: number }[];
  legal_actions: string[];
}

export interface CardSummary {
  index: number;
  key: string;
  label: string;
  suit: string;
  rank: string;
  enhancement: string | null;
  edition: string | null;
  seal: string | null;
  sell_cost: number;
  buy_cost: number;
}

function summarizeCards(area: CardArea): CardSummary[] {
  return (area?.cards ?? []).map((c: Card, i: number) => ({
    index: i,
    key: c.key,
    label: c.label,
    suit: c.value?.suit ?? "",
    rank: c.value?.rank ?? "",
    enhancement: c.modifier?.enhancement ?? null,
    edition: c.modifier?.edition ?? null,
    seal: c.modifier?.seal ?? null,
    sell_cost: c.cost?.sell ?? 0,
    buy_cost: c.cost?.buy ?? 0,
  }));
}

export function summarizeState(raw: GameState): SummarizedState {
  const legal = computeLegalActions(raw.state);
  const blind = raw.state === "BLIND_SELECT" ? raw.blinds.small : raw.blinds.boss;
  return {
    state: raw.state,
    ante: raw.ante_num,
    round: raw.round_num,
    money: raw.money,
    deck: raw.deck,
    stake: raw.stake,
    seed: raw.seed,
    blind: blind ? { name: blind.name, type: blind.type, score: blind.score, status: blind.status } : null,
    score: { chips: raw.round?.chips ?? 0, target: blind?.score ?? 0 },
    hands_left: raw.round?.hands_left ?? 0,
    discards_left: raw.round?.discards_left ?? 0,
    hand_cards: summarizeCards(raw.hand),
    jokers: summarizeCards(raw.jokers),
    consumables: summarizeCards(raw.consumables),
    shop: raw.shop ? {
      cards: summarizeCards(raw.shop),
      vouchers: summarizeCards(raw.vouchers),
      packs: summarizeCards(raw.packs),
    } : undefined,
    poker_hands: Object.entries(raw.hands ?? {}).map(([name, info]) => ({
      name, level: info.level, chips: info.chips, mult: info.mult,
    })),
    legal_actions: legal.actions,
  };
}
