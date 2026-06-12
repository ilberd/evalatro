import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface SummarizedState {
  state: string;
  ante: number;
  round: number;
  money: number;
  deck: string;
  stake: string;
  blind: { name: string; type: string; score: number } | null;
  score: { chips: number; target: number };
  hands_left: number;
  discards_left: number;
  hand_cards: { index: number; key: string; label: string }[];
  jokers: { index: number; key: string; label: string }[];
  consumables: { index: number; key: string; label: string }[];
  legal_actions: string[];
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export type DecisionFn = (state: SummarizedState) => Promise<ToolCall>;

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}): Promise<any> {
  const result: any = await client.callTool({ name, arguments: args });
  if (result.isError) {
    throw new Error(`Tool ${name} failed: ${result.content[0]?.text}`);
  }
  return JSON.parse(result.content[0].text);
}

export async function runGameLoop(client: Client, decide: DecisionFn, maxSteps = 500): Promise<void> {
  let steps = 0;
  let state: SummarizedState | null = null;

  while (steps < maxSteps) {
    try {
      state = await callTool(client, "get_game_state");
    } catch (e: any) {
      console.error("Fatal: Cannot get game state:", e.message);
      break;
    }

    if (!state) { console.error("Null state"); break; }

    console.log(`\n[Step ${steps}] State: ${state.state} | Ante ${state.ante}.${state.round} | $${state.money}`);

    if (state.state === "GAME_OVER") {
      console.log("Game Over!");
      break;
    }

    const { tool, args } = await decide(state);
    console.log(`  Action: ${tool}`, args);

    try {
      const result = await callTool(client, tool, args);
      steps++;
    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
      steps++;
    }
  }

  console.log(`\nGame loop finished after ${steps} steps`);
}

// CLI entry point
const args = process.argv.slice(2);
const mcpCommand = args[0] || "node";
const mcpArgs = args.length > 1 ? args.slice(1) : ["dist/server.js"];

async function main() {
  const transport = new StdioClientTransport({ command: mcpCommand, args: mcpArgs });
  const client = new Client({ name: "balatro-agent", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  console.error("Connected to MCP server");

  // Example: naive greedy decision maker
  const naiveDecide: DecisionFn = async (state) => {
    const actions = state.legal_actions;

    if (actions.includes("start")) {
      return { tool: "start_run", args: { deck: "RED", stake: "WHITE" } };
    }
    if (state.state === "BLIND_SELECT") {
      return { tool: "select_blind", args: {} };
    }
    if (state.state === "SELECTING_HAND") {
      if (state.hand_cards.length >= 2 && actions.includes("play")) {
        return { tool: "play_hand", args: { cards: state.hand_cards.slice(0, 3).map(c => c.index) } };
      }
      if (actions.includes("discard")) {
        return { tool: "discard", args: { cards: state.hand_cards.slice(0, 2).map(c => c.index) } };
      }
    }
    if (state.state === "ROUND_EVAL" && actions.includes("cash_out")) {
      return { tool: "cash_out", args: {} };
    }
    if (state.state === "SHOP") {
      if (actions.includes("next_round")) {
        return { tool: "next_round", args: {} };
      }
    }

    return { tool: "get_game_state", args: {} };
  };

  await runGameLoop(client, naiveDecide);
  await client.close();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
