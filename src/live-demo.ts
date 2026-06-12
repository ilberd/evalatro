import { BalatroBotClient } from "./client/balatrobot.js";
import { BalatroTools } from "./tools/balatro-tools.js";
import { summarizeState } from "./state/summarizer.js";
import { globalBus } from "./bus/index.js";

async function main() {
  const client = new BalatroBotClient({ timeout: 30000, retries: 3 });
  const tools = new BalatroTools(client);

  // Wait for game
  for (let i = 0; i < 60; i++) {
    try { await client.health(); break; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }

  console.error("=== Live Demo: Starting ===");

  // Go to menu then start
  try { await client.menu(); } catch {}
  await new Promise(r => setTimeout(r, 2000));

  const s1 = await tools.startRun("RED", "WHITE", "LIVEDEMO");
  globalBus.emit({ type: "state", gameId: "live", model: "llm", seed: "LIVEDEMO", ts: Date.now(), state: s1 as any });

  for (let round = 0; round < 10; round++) {
    // Select blind
    const s2 = await tools.selectBlind();
    globalBus.emit({ type: "state", gameId: "live", model: "llm", seed: "LIVEDEMO", ts: Date.now(), state: s2 as any });

    // Play hands
    for (let hand = 0; hand < 5; hand++) {
      const { summarized } = await tools.getGameState();
      if (summarized.state !== "SELECTING_HAND") break;
      const cards = summarized.hand_cards;
      if (cards.length < 2) break;

      const bySuit: Record<string, typeof cards> = {};
      for (const c of cards) (bySuit[c.suit] ??= []).push(c);
      const suit = Object.keys(bySuit).find(s => bySuit[s].length >= 5);
      let toPlay: number[];
      if (suit) {
        toPlay = bySuit[suit].slice(0, 5).map(c => c.index);
      } else {
        toPlay = cards.slice(0, Math.min(3, cards.length)).map(c => c.index);
      }

      const s3 = await tools.playHand(toPlay);
      globalBus.emit({ type: "state", gameId: "live", model: "llm", seed: "LIVEDEMO", ts: Date.now(), state: s3 as any });
    }

    // Cash out
    const { summarized: afterPlay } = await tools.getGameState();
    if (afterPlay.state === "ROUND_EVAL") {
      const s4 = await tools.cashOut();
      globalBus.emit({ type: "state", gameId: "live", model: "llm", seed: "LIVEDEMO", ts: Date.now(), state: s4 as any });
    }

    // Shop
    const { summarized: inShop } = await tools.getGameState();
    if (inShop.state === "SHOP") {
      const s5 = await tools.nextRound();
      globalBus.emit({ type: "state", gameId: "live", model: "llm", seed: "LIVEDEMO", ts: Date.now(), state: s5 as any });
    }

    // Check game over
    const { summarized: check } = await tools.getGameState();
    if (check.state === "GAME_OVER" || check.state === "MENU") {
      globalBus.emit({
        type: "result", gameId: "live", model: "llm", seed: "LIVEDEMO", ts: Date.now(),
        outcome: "game_over", finalAnte: check.ante, finalRound: check.round, dollars: check.money,
      });
      console.error(`Game Over: Ante ${check.ante}`);
      break;
    }
  }

  console.error("=== Live Demo: Done ===");
}

main().catch(console.error);
