import http from "http";
import fs from "fs";
import path from "path";
import { BalatroBotClient } from "./client/balatrobot.js";
import { BalatroTools } from "./tools/balatro-tools.js";
import { globalBus, BalatroEvent } from "./bus/index.js";

// ── Config ──
const PORT = parseInt(process.env.RELAY_PORT || "3001", 10);
const WEB_DIR = path.resolve("web");
const BALATRO_PATH = process.env.BALATRO_PATH || "E:\\SteamLibrary\\steamapps\\common\\Balatro\\Balatro.exe";

// ── Event buffer ──
const clients = new Set<http.ServerResponse>();
const eventBuffer: BalatroEvent[] = [];
const MAX_BUFFER = 500;
let latestState: BalatroEvent | null = null;

globalBus.subscribe((event: BalatroEvent) => {
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER) eventBuffer.shift();
  if (event.type === "state" || event.type === "decision") latestState = event;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch { clients.delete(res); }
  }
});

// ── MIME types ──
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

// ── HTTP Server ──
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    for (const ev of eventBuffer) res.write(`data: ${JSON.stringify(ev)}\n\n`);
    res.write("data: {\"type\":\"connected\",\"count\":" + eventBuffer.length + "}\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (req.url === "/api") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", clients: clients.size, events: eventBuffer.length }));
    return;
  }

  let filePath = (req.url === "/" || !req.url ? "/index.html" : req.url).split("?")[0];
  const fullPath = path.join(WEB_DIR, filePath);
  if (!fullPath.startsWith(WEB_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      fs.readFile(path.join(WEB_DIR, "index.html"), (_, d) => {
        if (!d) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(d);
      });
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.error(`🌐 http://localhost:${PORT}`);
  console.error(`📡 SSE: http://localhost:${PORT}/events`);
});

// ── Game loop ──
async function playGame() {
  const client = new BalatroBotClient({ timeout: 30000, retries: 3 });
  const tools = new BalatroTools(client);

  for (let i = 0; i < 60; i++) {
    try { await client.health(); break; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error("Game ready, starting run...");

  try { await client.menu(); } catch {}
  await new Promise(r => setTimeout(r, 2000));

  const s1 = await tools.startRun("RED", "WHITE");
  emitState(s1);

  for (let round = 0; round < 20; round++) {
    const s2 = await tools.selectBlind();
    emitState(s2);

    for (let hand = 0; hand < 5; hand++) {
      const { summarized } = await tools.getGameState();
      if (summarized.state !== "SELECTING_HAND") break;
      const cards = summarized.hand_cards;
      if (cards.length < 2) break;

      const bySuit: Record<string, typeof cards> = {};
      for (const c of cards) (bySuit[c.suit] ??= []).push(c);
      const suit = Object.keys(bySuit).find(s => bySuit[s].length >= 5);
      const toPlay = suit
        ? bySuit[suit].slice(0, 5).map(c => c.index)
        : cards.slice(0, Math.min(3, cards.length)).map(c => c.index);

      const s3 = await tools.playHand(toPlay);
      emitState(s3);
    }

    const { summarized: ap } = await tools.getGameState();
    if (ap.state === "ROUND_EVAL") {
      const s4 = await tools.cashOut();
      emitState(s4);
    }

    const { summarized: is } = await tools.getGameState();
    if (is.state === "SHOP") {
      const s5 = await tools.nextRound();
      emitState(s5);
    }

    const { summarized: ck } = await tools.getGameState();
    if (ck.state === "GAME_OVER" || ck.state === "MENU") {
      globalBus.emit({
        type: "result", gameId: "live", model: "auto", seed: "LIVE", ts: Date.now(),
        outcome: "game_over", finalAnte: ck.ante, finalRound: ck.round, dollars: ck.money,
      });
      console.error(`Game Over: Ante ${ck.ante}`);
      break;
    }
  }

  console.error("Play session ended. Server stays running for replay.");
}

function emitState(state: any) {
  globalBus.emit({
    type: "state", gameId: "live", model: "auto", seed: state?.seed || "LIVE", ts: Date.now(),
    state: state || {},
  });
}

playGame().catch(e => console.error("Game error:", e));
