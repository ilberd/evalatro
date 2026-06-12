import { useEffect, useState } from "react";
import { BoardView } from "../components/BoardView";
import { ChainOfThought, Thought } from "../components/ChainOfThought";
import { LiveEvent, StateT } from "../api-types";
import { runDemo } from "../demo";

interface LiveGame {
  id: string; model: string; seed: string; state?: StateT; last?: LiveEvent;
  log: Thought[]; moves: number; illegal: number; tokOut: number; cost: number; result?: LiveEvent;
}

function playedSet(ev?: LiveEvent): Set<number> | undefined {
  if (ev && (ev.action?.tool === "play_hand" || ev.action?.tool === "discard"))
    return new Set<number>((ev.action.args?.cards as number[]) || []);
  return undefined;
}

export function Live() {
  const [games, setGames] = useState<Record<string, LiveGame>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [conn, setConn] = useState("connecting…");

  function handle(ev: LiveEvent) {
    if (!ev || ev.type === "connected") return;
    const id = ev.gameId || "live";
    setGames(prev => {
      const g: LiveGame = { id, model: "—", seed: "—", log: [], moves: 0, illegal: 0, tokOut: 0, cost: 0, ...(prev[id] || {}) };
      if (ev.model) g.model = ev.model;
      if (ev.seed) g.seed = ev.seed;
      if (ev.type === "state") { g.state = ev.state; g.result = undefined; }
      else if (ev.type === "decision") {
        g.state = ev.state || g.state; g.last = ev;
        const bad = !!ev.illegal;
        if (bad) g.illegal++; else g.moves++;
        if (ev.usage) { g.tokOut += ev.usage.tokensOut || 0; g.cost += ev.usage.costUsd || 0; }
        g.log = [...g.log, {
          step: ev.step ?? g.moves + g.illegal, tool: ev.action?.tool || "?",
          args: ev.action?.args && Object.keys(ev.action.args).length ? JSON.stringify(ev.action.args) : "",
          tok: ev.usage?.tokensOut || 0, reasoning: ev.reasoning || "", illegal: ev.illegal,
        }];
      } else if (ev.type === "result") { g.result = ev; }
      return { ...prev, [id]: g };
    });
    setCurrent(id);
  }

  useEffect(() => {
    if (new URLSearchParams(location.search).has("demo")) { setConn("demo"); return runDemo(handle); }
    const es = new EventSource("/events");
    es.onopen = () => setConn("live");
    es.onerror = () => setConn("reconnecting…");
    es.onmessage = e => { try { handle(JSON.parse(e.data)); } catch { /* ignore */ } };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ids = Object.keys(games);
  const g = current ? games[current] : undefined;

  return (
    <>
      <div className="row-controls" style={{ justifyContent: "space-between" }}>
        <div className="nav">
          {ids.length > 1 && ids.map(id => (
            <button key={id} className={"tab-link" + (id === current ? " active" : "")} onClick={() => setCurrent(id)}>{games[id].model} · {id}</button>
          ))}
        </div>
        <span className="badge"><span className={"dot" + (conn === "live" || conn === "demo" ? " live" : "")} /> <b>{conn}</b></span>
      </div>

      {!g || !g.state ? (
        <div className="panel"><div className="empty">No live game. Run <code>npm run live -- &lt;model&gt;</code> on the host, or open <code>/live?demo=1</code> for a sample.</div></div>
      ) : (
        <>
          <div className="row-controls"><span className="badge model">model <b>{g.model}</b></span><span className="badge">seed <b>{g.seed}</b></span></div>
          <div className="grid">
            <BoardView s={g.state} played={playedSet(g.last)} />
            <div className="rail">
              {g.last && (
                <div className="panel act">
                  <div className="now">Current move</div>
                  <div className="tool" style={g.last.illegal ? { color: "var(--mult)" } : undefined}>{g.last.action?.tool || "—"}</div>
                  {g.last.action?.args && Object.keys(g.last.action.args).length > 0 && <div className="args">{JSON.stringify(g.last.action.args)}</div>}
                  <div className={"why" + (g.last.illegal ? " illegal" : "")}>{g.last.illegal ? `⚠ ${g.last.illegal}\n\n` : ""}{g.last.reasoning || "(thinking…)"}</div>
                </div>
              )}
              <div className="totals">
                <div className="cell"><div className="k">Moves</div><div className="v">{g.moves}</div></div>
                <div className="cell"><div className="k">Illegal</div><div className="v red">{g.illegal}</div></div>
                <div className="cell"><div className="k">Tokens out</div><div className="v blue">{g.tokOut.toLocaleString()}</div></div>
                <div className="cell"><div className="k">Est. $</div><div className="v gold">{g.cost ? "$" + g.cost.toFixed(4) : "$0"}</div></div>
              </div>
              <div className="panel"><div className="ttl">Chain of thought ({g.log.length})</div><ChainOfThought items={g.log} /></div>
            </div>
          </div>
          {g.result && (
            <div className="overlay">
              <div className={"result " + (g.result.won === true || g.result.outcome === "won" ? "win" : "lose")}>
                <div className="big">Ante {g.result.finalAnte}</div>
                <div className="lab">{g.result.won === true || g.result.outcome === "won" ? "Victory" : "Game Over"}</div>
                <div className="sub">{g.model} · {g.result.outcome} · ${g.result.dollars}</div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
