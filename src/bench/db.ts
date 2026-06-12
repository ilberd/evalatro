import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

const DB_PATH = path.join("bench", "bench.db");

export interface RunRecord {
  id?: number;
  model: string;
  seed: string;
  deck: string;
  stake: string;
  maxAnte: number;
  finalRound: number;
  finalMoney: number;
  won: boolean;
  actions: number;
  durationMs: number;
  error: string | null;
  ts: number;
}

export function getDb(): Database.Database {
  fs.mkdirSync("bench", { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT NOT NULL,
      seed TEXT NOT NULL,
      deck TEXT NOT NULL DEFAULT 'RED',
      stake TEXT NOT NULL DEFAULT 'WHITE',
      maxAnte INTEGER NOT NULL DEFAULT 0,
      finalRound INTEGER NOT NULL DEFAULT 0,
      finalMoney INTEGER NOT NULL DEFAULT 0,
      won INTEGER NOT NULL DEFAULT 0,
      actions INTEGER NOT NULL DEFAULT 0,
      durationMs INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runs_model ON runs(model);
    CREATE INDEX IF NOT EXISTS idx_runs_seed ON runs(seed);
  `);
  return db;
}

export function insertRun(db: Database.Database, r: RunRecord): number {
  const stmt = db.prepare(`
    INSERT INTO runs (model, seed, deck, stake, maxAnte, finalRound, finalMoney, won, actions, durationMs, error, ts)
    VALUES (@model, @seed, @deck, @stake, @maxAnte, @finalRound, @finalMoney, @won, @actions, @durationMs, @error, @ts)
  `);
  return stmt.run({ ...r, won: r.won ? 1 : 0, ts: r.ts || Date.now() }).lastInsertRowid as number;
}

export interface ModelStats {
  model: string;
  runs: number;
  avgAnte: number;
  maxAnte: number;
  winRate: number;
  avgActions: number;
  avgDuration: number;
  errors: number;
}

export function modelStats(db: Database.Database): ModelStats[] {
  const rows = db.prepare(`
    SELECT
      model,
      COUNT(*) as runs,
      AVG(maxAnte) as avgAnte,
      MAX(maxAnte) as maxAnte,
      AVG(CAST(won AS REAL)) as winRate,
      AVG(actions) as avgActions,
      AVG(durationMs) as avgDuration,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as errors
    FROM runs
    GROUP BY model
    ORDER BY avgAnte DESC
  `).all() as any[];
  return rows.map(r => ({
    model: r.model,
    runs: r.runs,
    avgAnte: Math.round(r.avgAnte * 100) / 100,
    maxAnte: r.maxAnte,
    winRate: Math.round(r.winRate * 10000) / 100,
    avgActions: Math.round(r.avgActions * 10) / 10,
    avgDuration: Math.round(r.avgDuration),
    errors: r.errors,
  }));
}
