import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/server.js"],
});

const client = new Client(
  { name: "test-client", version: "1.0.0" },
  { capabilities: {} }
);

await client.connect(transport);

// Test get_game_state
console.log("=== get_game_state ===");
const stateResult = await client.callTool({ name: "get_game_state", arguments: {} });
console.log(stateResult.content[0].text.slice(0, 1000));

// Test get_legal_actions
console.log("\n=== get_legal_actions ===");
const legalResult = await client.callTool({ name: "get_legal_actions", arguments: {} });
console.log(legalResult.content[0].text);

// Test start_run
console.log("\n=== start_run ===");
const startResult = await client.callTool({ name: "start_run", arguments: { deck: "RED", stake: "WHITE", seed: "INTEGRATION" } });
const state = JSON.parse(startResult.content[0].text);
console.log("State:", state.state, "| Money:", state.money, "| Ante:", state.ante);

// Test select_blind
console.log("\n=== select_blind ===");
const selectResult = await client.callTool({ name: "select_blind", arguments: {} });
const selectState = JSON.parse(selectResult.content[0].text);
console.log("State after select:", selectState.state);
console.log("Hand cards count:", selectState.hand_cards?.length);

// Play a hand
if (selectState.hand_cards?.length > 0) {
  const indices = selectState.hand_cards.slice(0, 3).map((c: any) => c.index);
  console.log("\n=== play_hand ===", indices);
  const playResult = await client.callTool({ name: "play_hand", arguments: { cards: indices } });
  const playState = JSON.parse(playResult.content[0].text);
  console.log("State after play:", playState.state);
  console.log("Chips:", playState.score?.chips);
}

await client.close();
console.log("\n✅ All MCP tests passed!");
