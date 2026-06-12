import { request } from "undici";
import * as fs from "fs";

export interface BalatroBotConfig {
  host: string;
  port: number;
  timeout: number;
  retries: number;
  retryDelay: number;
}

export class BalatroBotClient {
  private baseUrl: string;
  private config: BalatroBotConfig;
  private logStream: fs.WriteStream | null = null;

  constructor(config: Partial<BalatroBotConfig> = {}) {
    this.config = {
      host: config.host ?? "127.0.0.1",
      port: config.port ?? 12346,
      timeout: config.timeout ?? 10000,
      retries: config.retries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
    };
    this.baseUrl = `http://${this.config.host}:${this.config.port}`;
  }

  setLogStream(stream: fs.WriteStream | null) {
    this.logStream = stream;
  }

  private logEntry(method: string, params: unknown, result: unknown, error?: string) {
    if (!this.logStream) return;
    this.logStream.write(JSON.stringify({
      ts: Date.now(),
      method,
      params,
      result,
      error,
    }) + "\n");
  }

  private async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout);
        const response = await request(this.baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const body = await response.body.json() as { result?: T; error?: { message: string; data?: { name: string } } };
        if (body.error) {
          const err = new Error(`balatrobot error: ${body.error.data?.name ?? "UNKNOWN"} - ${body.error.message}`);
          this.logEntry(method, params, null, err.message);
          throw err;
        }
        this.logEntry(method, params, body.result);
        return body.result as T;
      } catch (e: any) {
        lastError = e;
        if (attempt < this.config.retries) {
          await new Promise(r => setTimeout(r, this.config.retryDelay * (attempt + 1)));
        }
      }
    }
    this.logEntry(method, params, null, lastError!.message);
    throw lastError!;
  }

  health(): Promise<{ status: string }> { return this.call("health"); }
  gamestate(): Promise<GameState> { return this.call("gamestate"); }
  start(deck: string, stake: string, seed?: string): Promise<GameState> { return this.call("start", { deck, stake, ...(seed ? { seed } : {}) }); }
  menu(): Promise<GameState> { return this.call("menu"); }
  select(): Promise<GameState> { return this.call("select"); }
  skip(): Promise<GameState> { return this.call("skip"); }
  play(cards: number[]): Promise<GameState> { return this.call("play", { cards }); }
  discard(cards: number[]): Promise<GameState> { return this.call("discard", { cards }); }
  buy(params: { card?: number; voucher?: number; pack?: number }): Promise<GameState> { return this.call("buy", params); }
  sell(params: { joker?: number; consumable?: number }): Promise<GameState> { return this.call("sell", params); }
  reroll(): Promise<GameState> { return this.call("reroll"); }
  cashOut(): Promise<GameState> { return this.call("cash_out"); }
  nextRound(): Promise<GameState> { return this.call("next_round"); }
  pack(params: { card?: number; targets?: number[]; skip?: boolean }): Promise<GameState> { return this.call("pack", params); }
  use(consumable: number, cards?: number[]): Promise<GameState> { return this.call("use", { consumable, ...(cards ? { cards } : {}) }); }
  rearrange(params: { hand?: number[]; jokers?: number[]; consumables?: number[] }): Promise<GameState> { return this.call("rearrange", params); }
}

export interface GameState {
  state: string; round_num: number; ante_num: number; money: number;
  deck: string; stake: string; seed: string; won: boolean;
  used_vouchers: string[];
  hands: Record<string, PokerHand>;
  round: RoundInfo; blinds: BlindsInfo;
  jokers: CardArea; consumables: CardArea; cards: CardArea;
  hand: CardArea; shop: CardArea; vouchers: CardArea; packs: CardArea;
  pack: CardArea | null;
}

export interface PokerHand { order: number; level: number; chips: number; mult: number; played: number; played_this_round: number; example: [string, boolean][]; }
export interface RoundInfo { hands_left: number; hands_played: number; discards_left: number; discards_used: number; reroll_cost: number; chips: number; }
export interface BlindsInfo { small: BlindInfo; big: BlindInfo; boss: BlindInfo; }
export interface BlindInfo { type: string; status: string; name: string; effect: string; score: number; tag_name: string; tag_effect: string; }
export interface CardArea { count: number; limit: number; highlighted_limit: number; cards: Card[]; }
export interface Card { id: number; key: string; set: string; label: string; value: { suit: string; rank: string; effect: string }; modifier: { seal: string | null; edition: string | null; enhancement: string | null; eternal: boolean; perishable: number | null; rental: boolean; }; state: { debuff: boolean; hidden: boolean; highlight: boolean; }; cost: { sell: number; buy: number; }; }
