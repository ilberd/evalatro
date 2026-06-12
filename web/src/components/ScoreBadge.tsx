import { scoreClass } from "../util";

export function ScoreBadge({ score, stdev }: { score: number; stdev?: number }) {
  return (
    <span className="scorebadge">
      <span className={"v " + scoreClass(score)}>{score.toFixed(1)}</span>
      {stdev != null && stdev > 0 && <span className="pm">± {stdev.toFixed(1)}</span>}
    </span>
  );
}

export function OfficialTag({ official }: { official: number | boolean }) {
  return official ? <span className="tag official">official</span> : <span className="tag unofficial">community</span>;
}
