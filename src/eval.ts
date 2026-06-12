import { BalatroBotClient } from "./client/balatrobot.js";
import { summarizeState, SummarizedState } from "./state/summarizer.js";
import * as fs from "fs";
import * as path from "path";
import { spawn, execSync, ChildProcess } from "child_process";

interface RunResult {
  seed: string;
  deck: string;
  stake: string;
  maxAnte: number;
  finalRound: number;
  finalMoney: number;
  won: boolean;
  actions: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForHealth(client: BalatroBotClient, maxWait = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      await client.health();
      return;
    } catch { await sleep(2000); }
  }
  throw new Error("Game did not start within timeout");
}

async function waitForStable(client: BalatroBotClient): Promise<void> {
  await sleep(1000);
}

function startGame(balatroPath: string, port: number): ChildProcess {
  const lovelyPath = path.join(path.dirname(balatroPath), "version.dll");
  const scriptsDir = path.join(process.env.LOCALAPPDATA ?? "", "Packages", "PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0", "LocalCache", "local-packages", "Python313", "Scripts");
  const userBin = path.join(process.env.USERPROFILE ?? "", ".local", "bin");
  const env = { ...process.env, PATH: `${scriptsDir};${userBin};${process.env.PATH}` };
  const proc = spawn("balatrobot", [
    "serve", "--fast",
    "--port", String(port),
    "--love-path", balatroPath,
    "--lovely-path", lovelyPath,
    "--no-shaders",
    "--logs-path", "logs",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env,
  });
  proc.stdout?.on("data", () => {});
  proc.stderr?.on("data", () => {});
  return proc;
}

// Simple heuristic agent for eval
async function naiveRun(client: BalatroBotClient, logFile: string): Promise<RunResult> {
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  client.setLogStream(logStream);

  const startTime = Date.now();
  const result: RunResult = { seed: "", deck: "RED", stake: "WHITE", maxAnte: 0, finalRound: 0, finalMoney: 0, won: false, actions: 0 };
  let steps = 0;

  try {
    await waitForHealth(client);

    // Read menu state
    const initState = summarizeState(await client.gamestate());
    result.seed = initState.seed;

    // Start run
    const startState = summarizeState(await client.start("RED", "WHITE"));
    steps++;

    while (steps < 200) {
      const raw = await client.gamestate();
      const state = summarizeState(raw);
      logStream.write(JSON.stringify({ ts: Date.now(), type: "state", state }) + "\n");
      steps++;

      if (state.state === "GAME_OVER") {
        result.maxAnte = state.ante - 1;
        result.finalRound = state.round;
        result.finalMoney = state.money;
        result.won = state.ante >= 8;
        break;
      }

      if (state.state === "MENU") { break; }

      if (state.state === "BLIND_SELECT") {
        if (state.blind?.status === "SELECT") {
          await client.select();
          steps++;
          await waitForStable(client);
          continue;
        }
      }

      if (state.state === "SELECTING_HAND") {
        const cards = state.hand_cards;
        if (cards.length >= 2) {
          // Look for flushes or straights — play remaining cards
          const best = pickBestHand(cards);
          if (best.length >= 2) {
            await client.play(best);
          } else {
            await client.play(cards.slice(0, Math.min(3, cards.length)).map(c => c.index));
          }
          steps++;
          await waitForStable(client);
          continue;
        }
        if (state.discards_left > 0 && cards.length > 2) {
          // Discard low cards
          const toDiscard = cards
            .sort((a, b) => rankValue(a.rank) - rankValue(b.rank))
            .slice(0, Math.min(3, cards.length))
            .map(c => c.index);
          await client.discard(toDiscard);
          steps++;
          await waitForStable(client);
          continue;
        }
      }

      if (state.state === "ROUND_EVAL") {
        await client.cashOut();
        steps++;
        await waitForStable(client);
        continue;
      }

      if (state.state === "SHOP") {
        // Buy cheapest joker or consumable if we have money
        if (state.shop?.cards && state.shop.cards.length > 0 && state.money >= (state.shop.cards[0]?.buy_cost ?? 99)) {
          const cheapItem = state.shop.cards.find(c => c.buy_cost <= state.money);
          if (cheapItem) {
            await client.buy({ card: cheapItem.index });
            steps++;
            await waitForStable(client);
            continue;
          }
        }
        await client.nextRound();
        steps++;
        await waitForStable(client);
        continue;
      }

      if (state.state === "SMODS_BOOSTER_OPENED") {
        await client.pack({ skip: true });
        steps++;
        await waitForStable(client);
        continue;
      }

      // Safety: if nothing matches, advance
      await sleep(500);
    }
  } catch (e: any) {
    result.error = e.message;
  }

  logStream.end();
  return { ...result, actions: steps };
}

function rankValue(rank: string): number {
  const map: Record<string, number> = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "T": 10, "J": 11, "Q": 12, "K": 13, "A": 14 };
  return map[rank] ?? 0;
}

function pickBestHand(cards: { index: number; suit: string; rank: string }[]): number[] {
  if (cards.length < 2) return [];
  // Find flushes
  const bySuit: Record<string, typeof cards> = {};
  for (const c of cards) {
    (bySuit[c.suit] ??= []).push(c);
  }
  for (const suit of Object.keys(bySuit)) {
    if (bySuit[suit].length >= 5) {
      return bySuit[suit].slice(0, 5).map(c => c.index);
    }
  }
  // Find pairs
  const byRank: Record<string, typeof cards> = {};
  for (const c of cards) {
    (byRank[c.rank] ??= []).push(c);
  }
  const pairs = Object.values(byRank).filter(g => g.length >= 2);
  if (pairs.length > 0) {
    const bestPair = pairs.sort((a, b) => rankValue(b[0].rank) - rankValue(a[0].rank))[0];
    return bestPair.map(c => c.index);
  }
  return cards.slice(0, 3).map(c => c.index);
}

async function main() {
  const args = process.argv.slice(2);
  const runs = parseInt(args[0] || "5", 10);
  const balatroPath = args[1] || "E:\\SteamLibrary\\steamapps\\common\\Balatro\\Balatro.exe";

  console.log(`Eval: ${runs} runs, Balatro: ${balatroPath}`);
  const results: RunResult[] = [];

  for (let i = 0; i < runs; i++) {
    const port = 12346 + i;
    const logFile = `logs/eval-run-${i}.jsonl`;
    console.log(`\nRun ${i + 1}/${runs} (port ${port})...`);

    const proc = startGame(balatroPath, port);
    await sleep(30_000);

    const client = new BalatroBotClient({ port, timeout: 15000, retries: 3 });
    try {
      const result = await naiveRun(client, logFile);
      result.seed = result.seed || `auto-${i}`;
      results.push(result);
      console.log(`  Result: Ante ${result.maxAnte}, Round ${result.finalRound}, $${result.finalMoney}, Actions: ${result.actions}${result.error ? ` Error: ${result.error}` : ""}`);
    } catch (e: any) {
      results.push({ seed: `failed-${i}`, deck: "RED", stake: "WHITE", maxAnte: 0, finalRound: 0, finalMoney: 0, won: false, actions: 0, error: e.message });
      console.log(`  FAILED: ${e.message}`);
    } finally {
      // Kill the process tree
      try { execSync(`taskkill /F /T /PID ${proc.pid} 2>nul`, { stdio: "ignore" }); } catch {}
    }

    // Write summary after each run
    fs.writeFileSync("logs/eval-summary.json", JSON.stringify(results, null, 2));
  }

  // Final summary
  const succeeded = results.filter(r => !r.error);
  const won = results.filter(r => r.won);
  const avgAnte = succeeded.reduce((s, r) => s + r.maxAnte, 0) / (succeeded.length || 1);
  const avgActions = succeeded.reduce((s, r) => s + r.actions, 0) / (succeeded.length || 1);

  console.log("\n=== EVAL SUMMARY ===");
  console.log(`Total runs: ${runs}`);
  console.log(`Completed: ${succeeded.length}`);
  console.log(`Won (Ante≥8): ${won.length} (${((won.length / runs) * 100).toFixed(1)}%)`);
  console.log(`Avg max ante: ${avgAnte.toFixed(2)}`);
  console.log(`Avg actions/run: ${avgActions.toFixed(0)}`);
  if (results.some(r => r.error)) {
    console.log(`Errors: ${results.filter(r => r.error).map(r => r.error).join(", ")}`);
  }
}

main().catch(console.error);
