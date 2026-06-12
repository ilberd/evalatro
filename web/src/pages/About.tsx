import { Link } from "react-router-dom";

export function About() {
  return (
    <div className="panel prose">
      <h2>What this is</h2>
      <p>An open-source benchmark where LLMs play <b>real Balatro</b> (via balatrobot) from the raw game state — no strategy hints, no comprehension aids. Each game gets a single <b>0–100 score</b>; this site is the shared leaderboard.</p>

      <h2>The score</h2>
      <p>A standard run is 8 antes × 3 blinds (Small/Big/Boss) = a 24-blind ladder; winning means beating the Ante 8 Boss.</p>
      <ul>
        <li><b>progress</b> = how far up the ladder you got (+ partial credit for chips on the blind you died on).</li>
        <li><b>legality</b> = 1 − (illegal moves ÷ total moves).</li>
        <li><b>score</b> = progress × legality × 100. A flawless ante-8 win = <b>100</b>; only a real win can show 100.</li>
      </ul>
      <p>The leaderboard averages the score over <b>scored games</b> (won / lost / stuck). Runs cut short by infrastructure (provider error) are excluded. Endless mode (ante 9+) is out of scope.</p>

      <h2>Running it &amp; submitting</h2>
      <p>Clone the repo, point it at any OpenAI-compatible model (cloud or local) via <code>.env</code>, and run <code>npm run bench -- &lt;model&gt;</code> or <code>npm run live</code>. When a game finishes, the runner submits the full transcript here so it appears on the leaderboard.</p>
      <ul>
        <li><b>Opt out</b> entirely: set <code>SUBMIT=false</code> (or pass <code>--no-submit</code>). Nothing leaves your machine.</li>
        <li>What's sent: the move-by-move transcript (state + the model's reasoning), token/cost totals, your model id and provider <i>host</i>, and an optional handle. <b>Never</b> your API key or full endpoint URL.</li>
      </ul>

      <h2>Trust model</h2>
      <p>This is best-effort and trust-based (no accounts). Two things keep it honest:</p>
      <ul>
        <li>The server <b>recomputes the score from the transcript</b> — it never trusts a client-reported number — and rejects transcripts that fail consistency checks (non-monotonic antes, illegal moves marked legal, impossible wins).</li>
        <li>Runs from an unmodified release are tagged <b>official</b> (a hash of the gameplay/scoring code matches a known release); modified or local builds show as <b>community</b>.</li>
      </ul>
      <p>None of this makes an open-source client tamper-proof — it can't be. Treat <b>community</b> runs as unverified, and <b>official</b> as "plausibly produced by the unmodified eval."</p>

      <p style={{ marginTop: 18 }}><Link to="/">← Back to the leaderboard</Link></p>
    </div>
  );
}
