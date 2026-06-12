import { BalatroBotClient } from "./client/balatrobot.js";
import { BalatroTools } from "./tools/balatro-tools.js";
import { globalBus } from "./bus/index.js";
import { summarizeState } from "./state/summarizer.js";

async function main() {
  const client = new BalatroBotClient();
  const tools = new BalatroTools(client);

  // Wait for health
  for (let i = 0; i < 60; i++) {
    try { await client.health(); break; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error("Game ready");

  // Play loop with event bus
  const { summarized: initState } = await tools.getGameState();

  if (initState.state === "MENU") {
    const started = await tools.startRun("RED", "WHITE");
    globalBus.emit({ type: "state", gameId: "live", model: "llm", seed: started.seed, ts: Date.now(), state: started as any });
  }

  const { summarized: blindState } = await tools.getGameState();
  if (blindState.state === "BLIND_SELECT") {
    const s = await tools.selectBlind();
    globalBus.emit({ type: "state", gameId: "live", model: "llm", seed: blindState.seed, ts: Date.now(), state: s as any });
  }

  // Read hand
  const { raw, summarized } = await tools.getGameState();
  console.error(JSON.stringify(summarized.hand_cards.map(c => c.key)));
}

main().catch(console.error);
