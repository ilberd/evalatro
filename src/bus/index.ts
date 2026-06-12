export interface GameEvent {
  type: "state" | "decision" | "result";
  gameId: string;
  model: string;
  seed: string;
  ts: number;
}

export interface StateEvent extends GameEvent {
  type: "state";
  state: Record<string, unknown>;
}

export interface DecisionEvent extends GameEvent {
  type: "decision";
  reasoning: string;
  action: { tool: string; args: Record<string, unknown> };
  legalActions: string[];
  state: Record<string, unknown>;
}

export interface ResultEvent extends GameEvent {
  type: "result";
  outcome: "ante_cleared" | "game_over";
  finalAnte: number;
  finalRound: number;
  dollars: number;
}

export type BalatroEvent = StateEvent | DecisionEvent | ResultEvent;

export type EventHandler = (event: BalatroEvent) => void;

export class EventBus {
  private handlers: Set<EventHandler> = new Set();
  private buffer: BalatroEvent[] = [];

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(event: BalatroEvent): void {
    this.buffer.push(event);
    for (const h of this.handlers) h(event);
  }

  flush(): BalatroEvent[] {
    const b = this.buffer;
    this.buffer = [];
    return b;
  }
}

export const globalBus = new EventBus();
