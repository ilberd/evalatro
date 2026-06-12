import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getModelGames } from "../api";
import { GameSummaryT } from "../api-types";
import { ScoreBadge, OfficialTag } from "../components/ScoreBadge";
import { fmtDate, fmtMoney, outcomeClass } from "../util";

export function ModelPage() {
  const { name = "" } = useParams();
  const model = decodeURIComponent(name);
  const [games, setGames] = useState<GameSummaryT[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { getModelGames(model).then(g => { setGames(g); setLoaded(true); }).catch(() => setLoaded(true)); }, [model]);

  const scored = games.filter(g => ["won", "lost", "stuck"].includes(g.outcome || ""));
  const avg = scored.length ? scored.reduce((s, g) => s + g.score, 0) / scored.length : 0;
  const best = games.reduce((m, g) => Math.max(m, g.score), 0);
  const wins = games.filter(g => g.won).length;
  const done = games.filter(g => ["won", "lost"].includes(g.outcome || "")).length;

  const bins = new Array(10).fill(0);
  for (const g of scored) bins[Math.min(9, Math.floor(g.score / 10))]++;
  const maxBin = Math.max(...bins, 1);

  return (
    <>
      <header style={{ marginTop: 4 }}>
        <Link className="badge" to="/">← Leaderboard</Link>
        <span className="badge model">model <b>{model}</b></span>
      </header>

      <div className="panel summary">
        <div className="kv">Avg score<b><ScoreBadge score={+avg.toFixed(1)} /></b></div>
        <div className="kv">Best<b><ScoreBadge score={best} /></b></div>
        <div className="kv">Scored games<b>{scored.length}</b></div>
        <div className="kv">Win rate<b>{done ? Math.round((100 * wins) / done) + "%" : "—"}</b></div>
        <div className="kv">Total games<b>{games.length}</b></div>
      </div>

      {scored.length > 0 && (
        <div className="panel">
          <div className="ttl">Score distribution</div>
          <div className="hist">
            {bins.map((n, i) => (
              <div className="col" key={i}>
                <div className="n">{n || ""}</div>
                <div className="b" style={{ height: (n / maxBin) * 100 + "%" }} />
                <div className="x">{i * 10}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        {!games.length ? (
          <div className="empty">{loaded ? "No games for this model yet." : "Loading…"}</div>
        ) : (
          <table>
            <thead><tr>
              <th className="l">When</th><th className="l">Seed</th><th>Outcome</th><th>Score</th><th>Ante</th><th>Moves</th><th>Illegal</th><th>$</th><th></th>
            </tr></thead>
            <tbody>
              {games.map(g => (
                <tr key={g.gameId}>
                  <td className="l muted">{fmtDate(g.ts)}</td>
                  <td className="l">{g.seed} <OfficialTag official={g.official} /></td>
                  <td><span className={"pill " + outcomeClass(g.outcome)}>{g.outcome || "?"}</span></td>
                  <td><ScoreBadge score={g.score} /></td>
                  <td className="num">{g.maxAnte}</td>
                  <td className="num">{g.actions}</td>
                  <td className={"num " + (g.illegalActions ? "red" : "muted")}>{g.illegalActions}</td>
                  <td className="num gold">{fmtMoney(g.finalMoney)}</td>
                  <td><Link className="model" to={"/game/" + encodeURIComponent(g.gameId)}>view →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
