import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getGame } from "../api";
import { GameDetail, MoveT } from "../api-types";
import { BoardView } from "../components/BoardView";
import { ChainOfThought, Thought } from "../components/ChainOfThought";
import { ScoreBadge } from "../components/ScoreBadge";
import { fmtDate, fmtMoney, outcomeClass } from "../util";

function ctxLine(m: MoveT): string {
  const s: any = m.state || {};
  const b = s.blind || {};
  return [
    s.state,
    s.ante != null ? `ante ${s.ante}.${s.round}` : "",
    b.name ? `${b.name}${s.score?.target ? ` (${s.score.chips || 0}/${s.score.target})` : ""}` : "",
    s.money != null ? `$${s.money}` : "",
  ].filter(Boolean).join(" · ");
}

export function GamePage() {
  const { gameId = "" } = useParams();
  const [data, setData] = useState<GameDetail | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    getGame(decodeURIComponent(gameId))
      .then(d => { setData(d); setIdx(Math.max(0, (d.moves?.length || 1) - 1)); })
      .catch(() => setData({ run: null, moves: [] }));
  }, [gameId]);

  const moves = data?.moves || [];
  const cur = moves[idx];
  const run = data?.run;
  const thoughts: Thought[] = useMemo(
    () => moves.map(m => ({ step: m.step, tool: m.tool, args: m.args && Object.keys(m.args).length ? JSON.stringify(m.args) : "", reasoning: m.reasoning, illegal: m.illegal, tok: m.tokensOut })),
    [moves],
  );
  const played = cur && (cur.tool === "play_hand" || cur.tool === "discard")
    ? new Set<number>((cur.args?.cards as number[]) || []) : undefined;

  return (
    <>
      <header style={{ marginTop: 4 }}>
        <Link className="badge" to={run ? "/model/" + encodeURIComponent(run.model) : "/"}>← {run ? run.model : "Back"}</Link>
        <div className="spacer" />
        {run && <span className="badge">seed <b>{run.seed}</b></span>}
      </header>

      {run && (
        <div className="panel summary">
          <div className="kv">Outcome<b><span className={"pill " + outcomeClass(run.outcome)}>{run.outcome}</span></b></div>
          <div className="kv">Score<b><ScoreBadge score={run.score} /></b></div>
          <div className="kv">Max ante<b>{run.maxAnte}</b></div>
          <div className="kv">Money<b>{fmtMoney(run.finalMoney)}</b></div>
          <div className="kv">Moves<b>{run.actions}</b></div>
          <div className="kv">Illegal<b className={run.illegalActions ? "red" : ""}>{run.illegalActions}</b></div>
          <div className="kv">Tokens out<b>{(run.tokensOut || 0).toLocaleString()}</b></div>
          <div className="kv">When<b style={{ fontSize: 12, fontWeight: 400 }}>{fmtDate(run.ts)}</b></div>
        </div>
      )}

      {!moves.length ? (
        <div className="panel"><div className="empty">{data ? "No moves recorded for this game." : "Loading…"}</div></div>
      ) : (
        <>
          <div className="panel">
            <div className="scrub">
              <button className="btn" disabled={idx <= 0} onClick={() => setIdx(i => Math.max(0, i - 1))}>‹ Prev</button>
              <input type="range" min={0} max={moves.length - 1} value={idx} onChange={e => setIdx(+e.target.value)} />
              <button className="btn" disabled={idx >= moves.length - 1} onClick={() => setIdx(i => Math.min(moves.length - 1, i + 1))}>Next ›</button>
              <span className="muted num">move {idx + 1} / {moves.length}</span>
            </div>
          </div>
          <div className="grid">
            {cur && <BoardView s={cur.state} played={played} />}
            <div className="rail">
              {cur && (
                <div className="panel act">
                  <div className="now">Move {cur.step} · {ctxLine(cur)}</div>
                  <div className="tool" style={cur.illegal ? { color: "var(--mult)" } : undefined}>{cur.tool}</div>
                  {cur.args && Object.keys(cur.args).length > 0 && <div className="args">{JSON.stringify(cur.args)}</div>}
                  <div className={"why" + (cur.illegal ? " illegal" : "")}>{cur.illegal ? `⚠ ${cur.illegal}\n\n` : ""}{cur.reasoning || "(no reasoning)"}</div>
                </div>
              )}
              <div className="panel">
                <div className="ttl">Chain of thought ({moves.length})</div>
                <ChainOfThought items={thoughts} currentStep={cur?.step} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
