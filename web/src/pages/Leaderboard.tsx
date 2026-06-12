import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLeaderboard } from "../api";
import { LeaderboardRow } from "../api-types";
import { ScoreBadge } from "../components/ScoreBadge";
import { fmtMoney } from "../util";

export function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [officialOnly, setOfficial] = useState(false);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () => getLeaderboard(officialOnly).then(r => { if (live) { setRows(r); setLoaded(true); } }).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { live = false; clearInterval(t); };
  }, [officialOnly]);

  const shown = rows.filter(r => r.model.toLowerCase().includes(q.toLowerCase()));
  const maxScore = Math.max(...shown.map(r => r.avgScore), 1);

  return (
    <>
      <div className="row-controls" style={{ justifyContent: "space-between" }}>
        <div className="row-controls">
          <input className="search" placeholder="filter models…" value={q} onChange={e => setQ(e.target.value)} />
          <label className="toggle"><input type="checkbox" checked={officialOnly} onChange={e => setOfficial(e.target.checked)} /> official only</label>
        </div>
        <span className="badge"><span className="dot live" /> auto-refresh</span>
      </div>

      <div className="panel">
        {!shown.length ? (
          <div className="empty">{loaded ? "No games yet. Run the eval and submit, or run npm run bench." : "Loading…"}</div>
        ) : (
          <table>
            <thead><tr>
              <th>#</th><th className="l">Model</th><th>Score</th><th>Win%</th><th>Avg ante</th><th>Best</th><th>Avg $</th><th>Illegal</th><th>Tok/out</th><th>$/game</th>
            </tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.model} className={i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}>
                  <td className="rank">{i + 1}</td>
                  <td className="l">
                    <Link className="model" to={"/model/" + encodeURIComponent(r.model)}>{r.model} →</Link>
                    <div className="sub">{r.scored} scored · {r.won}W {r.completed - r.won}L{r.incomplete ? ` · ${r.incomplete} excl.` : ""}</div>
                  </td>
                  <td><ScoreBadge score={r.avgScore} stdev={r.stdevScore} /><div className="bar"><span style={{ width: (r.avgScore / maxScore) * 100 + "%" }} /></div></td>
                  <td className="num">{r.completed ? r.winRate + "%" : "—"}</td>
                  <td className="num">{r.avgAnte} <span className="muted" style={{ fontSize: 12 }}>± {r.stdevAnte}</span></td>
                  <td className="num">{r.maxAnte}</td>
                  <td className="num gold">{fmtMoney(r.avgMoney)}</td>
                  <td className={"num " + (r.illegalRate > 10 ? "red" : "muted")}>{r.illegalRate}%</td>
                  <td className="num blue">{r.avgTokensOut.toLocaleString()}</td>
                  <td className="num gold">{r.avgCostUsd ? "$" + r.avgCostUsd : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="note">
        Ranked by the <b>0–100 score</b> (mean ± stdev) over <b>scored games</b> (won / lost / stuck). <b>100</b> = won all 8 antes with zero illegal moves.
        Infra failures (error / cap) are excluded and shown as <b>excl.</b> Every score is recomputed server-side from the run's transcript. <Link to="/about">How it works →</Link>
      </div>
    </>
  );
}
