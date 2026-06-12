import http from "http";
import fs from "fs";
import path from "path";
import { globalBus, BalatroEvent } from "../bus/index.js";

const PORT = parseInt(process.env.RELAY_PORT || "3001", 10);
const WEB_DIR = path.resolve("web");

const clients = new Set<http.ServerResponse>();
const eventBuffer: BalatroEvent[] = [];
const MAX_BUFFER = 200;
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

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // SSE endpoint
  if (req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Replay buffer on connect
    for (const ev of eventBuffer) {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    }

    // If we have a latest state, also send it
    if (latestState) {
      res.write(`data: ${JSON.stringify({ type: "latest", event: latestState })}\n\n`);
    }

    res.write("data: {\"type\":\"connected\"}\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  // API status
  if (req.url === "/api") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", clients: clients.size, port: PORT }));
    return;
  }

  // Static files
  let filePath = req.url === "/" || !req.url ? "/index.html" : req.url;
  // Strip query params
  filePath = filePath.split("?")[0];
  const fullPath = path.join(WEB_DIR, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(WEB_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // Fallback to index.html for SPA-like routing
      fs.readFile(path.join(WEB_DIR, "index.html"), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.error(`Balatro Live: http://localhost:${PORT}`);
  console.error(`SSE stream: http://localhost:${PORT}/events`);
  console.error(`Serving static from: ${WEB_DIR}`);
});
