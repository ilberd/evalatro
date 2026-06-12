import { LiveEvent } from "./api-types";

/** A scripted sample game so the Live UI is viewable without a running bench (/live?demo=1). */
export function runDemo(handle: (e: LiveEvent) => void): () => void {
  const C = (i: number, key: string, label: string, suit: string, rank: string, extra: any = {}) =>
    ({ index: i, key, label, suit, rank, enhancement: null, edition: null, seal: null, sell_cost: 0, buy_cost: 0, ...extra });
  const hand1 = [
    C(0, "S_A", "A♠", "S", "A"), C(1, "S_K", "K♠", "S", "K"), C(2, "H_5", "5♥", "H", "5"), C(3, "D_2", "2♦", "D", "2"),
    C(4, "S_Q", "Q♠", "S", "Q", { edition: "foil" }), C(5, "S_7", "7♠", "S", "7"), C(6, "S_3", "3♠", "S", "3"), C(7, "C_9", "9♣", "C", "9", { seal: "Red" }),
  ];
  const jok = [
    { index: 0, key: "j_joker", label: "Joker", edition: null, effect: "+4 Mult" },
    { index: 1, key: "j_greedy", label: "Greedy Joker", edition: "holographic", effect: "+3 Mult per Diamond played" },
  ];
  const cons = [{ index: 0, key: "c_fool", label: "The Fool", set: "TAROT", effect: "Creates a copy of the last Tarot/Planet used" }];
  const base: any = {
    ante: 1, round: 1, money: 4, deck: "RED", stake: "WHITE", seed: "DEMO-SEED",
    blind: { name: "Small Blind", type: "SMALL", score: 300, status: "CURRENT", effect: "" },
    hands_left: 4, discards_left: 3, jokers: jok, consumables: cons, poker_hands: [{ name: "Flush", level: 1, chips: 35, mult: 4 }],
  };
  const ev = (o: any): LiveEvent => ({ gameId: "demo", model: "deepseek-v4-flash", seed: "DEMO-SEED", ts: Date.now(), ...o });
  const seq: LiveEvent[] = [
    ev({ type: "state", state: { ...base, state: "SELECTING_HAND", score: { chips: 0, target: 300 }, hand_cards: hand1 } }),
    ev({ type: "decision", step: 1, reasoning: "Five spades in hand — that's a Flush (35×4). Easily clears the 300 target. Playing all five spades.", action: { tool: "play_hand", args: { cards: [0, 1, 4, 5, 6] } }, usage: { tokensIn: 2532, tokensOut: 312, costUsd: 0.0011 }, state: { ...base, state: "SELECTING_HAND", score: { chips: 0, target: 300 }, hand_cards: hand1 } }),
    ev({ type: "state", state: { ...base, state: "ROUND_EVAL", hands_left: 3, score: { chips: 420, target: 300 }, hand_cards: [] } }),
    ev({ type: "decision", step: 2, reasoning: "Blind beaten (420 ≥ 300). Cash out to collect the reward + interest.", action: { tool: "cash_out", args: {} }, usage: { tokensIn: 1980, tokensOut: 120, costUsd: 0.0007 }, state: { ...base, state: "ROUND_EVAL", score: { chips: 420, target: 300 } } }),
    ev({ type: "state", state: { ...base, state: "SHOP", money: 9, hand_cards: [], score: { chips: 0, target: 0 }, shop: { cards: [{ index: 0, key: "j_mult", label: "+12 Mult Joker", buy_cost: 5 }, { index: 1, key: "c_planet", label: "Saturn", set: "PLANET", buy_cost: 3 }], vouchers: [{ index: 0, key: "v_overstock", label: "Overstock", buy_cost: 10 }], packs: [{ index: 0, key: "p_arcana", label: "Arcana Pack", buy_cost: 4 }] } } }),
    ev({ type: "decision", step: 3, reasoning: "Buy the +12 Mult Joker ($5) — flat mult scales with my flush build and I keep enough for interest.", action: { tool: "shop_buy", args: { card: 0 } }, usage: { tokensIn: 2410, tokensOut: 240, costUsd: 0.0010 }, state: { ...base, state: "SHOP", money: 9, shop: { cards: [{ index: 0, key: "j_mult", label: "+12 Mult Joker", buy_cost: 5 }], vouchers: [], packs: [] } } }),
    ev({ type: "state", state: { ...base, state: "BLIND_SELECT", round: 2, money: 4, jokers: [...jok, { index: 2, key: "j_mult", label: "+12 Mult Joker", edition: null, effect: "+12 Mult" }], blind: { name: "Big Blind", type: "BIG", score: 450, status: "CURRENT", effect: "" }, hand_cards: [], score: { chips: 0, target: 450 } } }),
    ev({ type: "decision", step: 4, reasoning: "Select the Big Blind — flush + the mult joker should clear 450 comfortably.", action: { tool: "select_blind", args: {} }, usage: { tokensIn: 2050, tokensOut: 90, costUsd: 0.0006 }, state: { ...base, state: "BLIND_SELECT", round: 2, blind: { name: "Big Blind", type: "BIG", score: 450 } } }),
  ];
  let i = 0, timer: any;
  const tick = () => { if (i < seq.length) { handle(seq[i++]); timer = setTimeout(tick, 1500); } };
  tick();
  return () => clearTimeout(timer);
}
