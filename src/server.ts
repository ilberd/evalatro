import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BalatroBotClient } from "./client/balatrobot.js";
import { BalatroTools } from "./tools/balatro-tools.js";
import { globalBus } from "./bus/index.js";

const client = new BalatroBotClient();
const tools = new BalatroTools(client);

const server = new McpServer({ name: "balatro-mcp", version: "1.0.0" });

function emitState(state: Record<string, unknown>) {
  globalBus.emit({
    type: "state", gameId: "mcp-live", model: "llm", seed: (state as any).seed || "?", ts: Date.now(),
    state,
  });
}

function withEmit(fn: (...a: any[]) => Promise<any>): (...a: any[]) => Promise<{ content: { type: "text"; text: string }[] }> {
  return async (...args: any[]) => {
    const state = await fn(...args);
    emitState(state);
    return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
  };
}

server.registerTool("get_game_state", { description: "Get a compact snapshot of the current game state" }, async () => {
  const { summarized } = await tools.getGameState();
  return { content: [{ type: "text", text: JSON.stringify(summarized, null, 2) }] };
});

server.registerTool("get_legal_actions", { description: "Get what actions are legal in the current game state" }, async () => {
  const legal = await tools.getLegalActions();
  return { content: [{ type: "text", text: JSON.stringify(legal, null, 2) }] };
});

server.registerTool("start_run", {
  description: "Start a new Balatro run from the main menu",
  inputSchema: {
    deck: z.string().describe("Deck name (e.g. RED, BLUE, YELLOW, GREEN, BLACK, MAGIC, GHOST, CHECKERED, ERRATIC)"),
    stake: z.string().describe("Stake level (e.g. WHITE, RED, GREEN, BLACK, BLUE, PURPLE, ORANGE, GOLD)"),
    seed: z.string().optional().describe("Optional seed for deterministic runs"),
  },
}, withEmit(async (args: any) => {
  return await tools.startRun(args.deck, args.stake, args.seed);
}));

server.registerTool("select_blind", { description: "Select the current blind and begin the round" }, withEmit(async () => {
  return await tools.selectBlind();
}));

server.registerTool("skip_blind", { description: "Skip the current small or big blind" }, withEmit(async () => {
  return await tools.skipBlind();
}));

server.registerTool("play_hand", {
  description: "Play cards from hand (1-5 cards by index)",
  inputSchema: {
    cards: z.array(z.number()).min(1).max(5).describe("0-based indices of cards to play"),
  },
}, withEmit(async (args: any) => {
  return await tools.playHand(args.cards);
}));

server.registerTool("discard", {
  description: "Discard cards from hand",
  inputSchema: {
    cards: z.array(z.number()).min(1).describe("0-based indices of cards to discard"),
  },
}, withEmit(async (args: any) => {
  return await tools.discardCards(args.cards);
}));

server.registerTool("shop_buy", {
  description: "Buy a card, voucher, or pack from the shop",
  inputSchema: {
    card: z.number().optional().describe("Index of card to buy"),
    voucher: z.number().optional().describe("Index of voucher to buy"),
    pack: z.number().optional().describe("Index of pack to buy"),
  },
}, withEmit(async (args: any) => {
  return await tools.shopBuy({ card: args.card, voucher: args.voucher, pack: args.pack });
}));

server.registerTool("shop_sell", {
  description: "Sell a joker or consumable",
  inputSchema: {
    joker: z.number().optional().describe("Index of joker to sell"),
    consumable: z.number().optional().describe("Index of consumable to sell"),
  },
}, withEmit(async (args: any) => {
  return await tools.shopSell({ joker: args.joker, consumable: args.consumable });
}));

server.registerTool("shop_reroll", { description: "Reroll the shop items (costs money)" }, withEmit(async () => {
  return await tools.shopReroll();
}));

server.registerTool("cash_out", { description: "Cash out round rewards and transition to shop" }, withEmit(async () => {
  return await tools.cashOut();
}));

server.registerTool("next_round", { description: "Leave the shop and advance to blind selection" }, withEmit(async () => {
  return await tools.nextRound();
}));

server.registerTool("use_consumable", {
  description: "Use a consumable card (tarot, planet, spectral)",
  inputSchema: {
    consumable: z.number().describe("0-based index of consumable to use"),
    cards: z.array(z.number()).optional().describe("Target card indices for consumables that need target cards"),
  },
}, withEmit(async (args: any) => {
  return await tools.useConsumable(args.consumable, args.cards);
}));

server.registerTool("pack_pick", {
  description: "Pick a card from an opened booster pack or skip it",
  inputSchema: {
    card: z.number().optional().describe("Index of card to pick from pack"),
    targets: z.array(z.number()).optional().describe("Target card indices for consumables"),
    skip: z.boolean().optional().describe("Skip the pack without picking"),
  },
}, withEmit(async (args: any) => {
  return await tools.openPack({ card: args.card, targets: args.targets, skip: args.skip });
}));

server.registerTool("rearrange_jokers", {
  description: "Change the order of jokers (order affects scoring)",
  inputSchema: {
    order: z.array(z.number()).describe("New order of jokers as index permutation"),
  },
}, withEmit(async (args: any) => {
  return await tools.rearrangeJokers(args.order);
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Balatro MCP server running on stdio");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
