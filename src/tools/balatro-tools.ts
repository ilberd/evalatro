import {
  BalatroBotClient,
  GameState,
} from "../client/balatrobot.js";
import { summarizeState, SummarizedState, computeLegalActions } from "../state/summarizer.js";

export class BalatroTools {
  private client: BalatroBotClient;
  private lastState: GameState | null = null;

  constructor(client: BalatroBotClient) {
    this.client = client;
  }

  async getGameState(): Promise<{ raw: GameState; summarized: SummarizedState }> {
    const raw = await this.client.gamestate();
    this.lastState = raw;
    const summarized = summarizeState(raw);
    return { raw, summarized };
  }

  async getLegalActions(): Promise<{ state: string; actions: string[] }> {
    if (!this.lastState) {
      await this.getGameState();
    }
    return computeLegalActions(this.lastState!.state);
  }

  async startRun(deck: string, stake: string, seed?: string): Promise<SummarizedState> {
    const raw = await this.client.start(deck, stake, seed);
    this.lastState = raw;
    return summarizeState(raw);
  }

  async selectBlind(): Promise<SummarizedState> {
    const raw = await this.client.select();
    this.lastState = raw;
    return summarizeState(raw);
  }

  async skipBlind(): Promise<SummarizedState> {
    const raw = await this.client.skip();
    this.lastState = raw;
    return summarizeState(raw);
  }

  async playHand(cards: number[]): Promise<SummarizedState> {
    const raw = await this.client.play(cards);
    this.lastState = raw;
    return summarizeState(raw);
  }

  async discardCards(cards: number[]): Promise<SummarizedState> {
    const raw = await this.client.discard(cards);
    this.lastState = raw;
    return summarizeState(raw);
  }

  async shopBuy(params: { card?: number; voucher?: number; pack?: number }): Promise<SummarizedState> {
    const raw = await this.client.buy(params);
    this.lastState = raw;
    return summarizeState(raw);
  }

  async shopSell(params: { joker?: number; consumable?: number }): Promise<SummarizedState> {
    const raw = await this.client.sell(params);
    this.lastState = raw;
    return summarizeState(raw);
  }

  async shopReroll(): Promise<SummarizedState> {
    const raw = await this.client.reroll();
    this.lastState = raw;
    return summarizeState(raw);
  }

  async cashOut(): Promise<SummarizedState> {
    const raw = await this.client.cashOut();
    this.lastState = raw;
    return summarizeState(raw);
  }

  async nextRound(): Promise<SummarizedState> {
    const raw = await this.client.nextRound();
    this.lastState = raw;
    return summarizeState(raw);
  }

  async useConsumable(consumable: number, cards?: number[]): Promise<SummarizedState> {
    const raw = await this.client.use(consumable, cards);
    this.lastState = raw;
    return summarizeState(raw);
  }

  async openPack(params: { card?: number; targets?: number[]; skip?: boolean }): Promise<SummarizedState> {
    const raw = await this.client.pack(params);
    this.lastState = raw;
    return summarizeState(raw);
  }

  async rearrangeJokers(order: number[]): Promise<SummarizedState> {
    const raw = await this.client.rearrange({ jokers: order });
    this.lastState = raw;
    return summarizeState(raw);
  }

  async rearrangeHand(order: number[]): Promise<SummarizedState> {
    const raw = await this.client.rearrange({ hand: order });
    this.lastState = raw;
    return summarizeState(raw);
  }

  async menu(): Promise<SummarizedState> {
    const raw = await this.client.menu();
    this.lastState = raw;
    return summarizeState(raw);
  }
}
