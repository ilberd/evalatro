import { BalatroBotClient, GameState } from "../client/balatrobot.js";
import { summarizeState } from "../state/summarizer.js";
import { BalatroTools } from "../tools/balatro-tools.js";
import { globalBus } from "../bus/index.js";
import { getDb, insertRun, modelStats, RunRecord } from "./db.js";
import * as fs from "fs";
import * as path from "path";

const SEEDS = ["BENCH01", "BENCH02", "BENCH03", "BENCH04", "BENCH05"];
const DECKS = ["RED"];
const STAKE = "WHITE";
const RUNS_PER_CELL = 1;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function startGame(balatroPath: string, port: number): Promise<() => void> {
  const lovelyPath = path.join(path.dirname(balatroPath), "version.dll");
  const scriptsDir = path.join(process.env.LOCALAPPDATA ?? "", "Packages", "PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0", "LocalCache", "local-packages", "Python313", "Scripts");
  const userBin = path.join(process.env.USERPROFILE ?? "", ".local", "bin");
  const env = { ...process.env, PATH: `${scriptsDir};${userBin};${process.env.PATH}` };
  const { spawn } = await import("child_process");
  const proc = spawn("balatrobot", ["serve", "--fast", "--port", String(port), "--love-path", balatroPath, "--lovely-path", lovelyPath, "--no-shaders", "--logs-path", "logs"], { stdio: "ignore", shell: true, env });
  await sleep(25_000);
  return () => {
    try { spawn("taskkill", ["/F", "/T", "/PID", String(proc.pid)], { stdio: "ignore" }); } catch {}
  };
}

async function waitForHealth(client: BalatroBotClient) {
  for (let i = 0; i < 30; i++) {
    try { await client.health(); return; } catch { await sleep(2000); }
  }
  throw new Error("Game did not start");
}

async function runOnce(port: number, deck: string, stake: string, seed: string, model: string): Promise<RunRecord> {
  const client = new BalatroBotClient({ port, timeout: 30000, retries: 3, retryDelay: 2000 });
  const tools = new BalatroTools(client);
  const startTs = Date.now();
  const startTime = Date.now();

  await waitForHealth(client);
  const init = await tools.startRun(deck, stake, seed);
  let actions = 0;

  while (Date.now() - startTs < 120_000) {
    const { summarized } = await tools.getGameState();
    actions++;

    globalBus.emit({
      type: "state", gameId: seed, model, seed, ts: Date.now(),
      state: summarized as any,
    });

    if (summarized.state === "GAME_OVER") {
      return {
        model, seed, deck, stake,
        maxAnte: summarized.ante - 1,
        finalRound: summarized.round,
        finalMoney: summarized.money,
        won: summarized.ante >= 8,
        actions, durationMs: Date.now() - startTime,
        error: null, ts: Date.now(),
      };
    }
    if (summarized.state === "MENU") break;

    // Naive decision
    let action: { tool: string; args: Record<string, unknown> } = { tool: "get_game_state", args: {} };

    if (summarized.state === "BLIND_SELECT") {
      action = { tool: "select_blind", args: {} };
    } else if (summarized.state === "SELECTING_HAND") {
      const cards = summarized.hand_cards;
      if (cards.length >= 2) {
        action = { tool: "play_hand", args: { cards: cards.slice(0, Math.min(3, cards.length)).map(c => c.index) } };
      } else if (summarized.discards_left > 0) {
        action = { tool: "discard", args: { cards: cards.slice(0, Math.min(2, cards.length)).map(c => c.index) } };
      }
    } else if (summarized.state === "ROUND_EVAL") {
      action = { tool: "cash_out", args: {} };
    } else if (summarized.state === "SHOP") {
      action = { tool: "next_round", args: {} };
    }

    globalBus.emit({
      type: "decision", gameId: seed, model, seed, ts: Date.now(),
      reasoning: "naive heuristic", action,
      legalActions: summarized.legal_actions,
      state: summarized as any,
    });

    try {
      const t = action.tool;
      if (t === "select_blind") await client.select();
      else if (t === "play_hand") await client.play((action.args as any).cards);
      else if (t === "discard") await client.discard((action.args as any).cards);
      else if (t === "cash_out") await client.cashOut();
      else if (t === "next_round") await client.nextRound();
    } catch { /* ignore */ }
  }

  return {
    model, seed, deck, stake,
    maxAnte: 0, finalRound: 0, finalMoney: 0,
    won: false, actions, durationMs: Date.now() - startTime,
    error: "timeout", ts: Date.now(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const balatroPath = args[0] || "E:\\SteamLibrary\\steamapps\\common\\Balatro\\Balatro.exe";
  const model = args[1] || "naive-heuristic";
  const runs = parseInt(args[2] || "3", 10);

  console.log(`Benchmark: ${model}, ${runs} runs`);
  const db = getDb();
  const results: RunRecord[] = [];

  for (let r = 0; r < runs; r++) {
    const seed = SEEDS[r % SEEDS.length] + `-R${r}`;
    const port = 12346;

    console.log(`\nRun ${r + 1}/${runs} seed=${seed}...`);
    const stop = await startGame(balatroPath, port);
    try {
      const record = await runOnce(port, "RED", "WHITE", seed, model);
      insertRun(db, record);
      results.push(record);
      console.log(`  Ante ${record.maxAnte}, ${record.actions} actions${record.error ? ` ERROR: ${record.error}` : ""}`);
    } catch (e: any) {
      console.log(`  FAILED: ${e.message}`);
    } finally {
      stop();
      await sleep(3000);
    }
  }

  console.log("\n=== LEADERBOARD ===");
  for (const s of modelStats(db)) {
    console.log(`${s.model}: ${s.runs} runs, avgAnte=${s.avgAnte}, winRate=${s.winRate}%, avgActions=${s.avgActions}`);
  }

  fs.writeFileSync("bench/last-results.json", JSON.stringify(results, null, 2));
}

main().catch(console.error);
