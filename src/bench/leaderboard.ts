import { getDb, modelStats } from "./db.js";

function main() {
  const db = getDb();
  const stats = modelStats(db);

  console.log("=== Balatro Bench Leaderboard ===\n");
  if (stats.length === 0) {
    console.log("No data yet. Run `npx tsx bench/run.ts` first.");
    return;
  }

  console.log(`${"Model".padEnd(22)} ${"Runs".padEnd(6)} ${"AvgAnte".padEnd(9)} ${"MaxAnte".padEnd(9)} ${"WinRate".padEnd(9)} ${"AvgAct".padEnd(7)} ${"AvgDur".padEnd(8)} ${"Err"}`);
  console.log("-".repeat(80));
  for (const s of stats) {
    console.log(
      `${s.model.padEnd(22)} ` +
      `${String(s.runs).padEnd(6)} ` +
      `${String(s.avgAnte).padEnd(9)} ` +
      `${String(s.maxAnte).padEnd(9)} ` +
      `${String(s.winRate) + "%".padEnd(6)} ` +
      `${String(s.avgActions).padEnd(7)} ` +
      `${String(s.avgDuration) + "ms".padEnd(5)} ` +
      `${s.errors}`
    );
  }
}

main();
