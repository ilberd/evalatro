export interface Thought {
  step: number; tool: string; args?: string; ctx?: string;
  reasoning?: string; illegal?: string | null; tok?: number;
}

/** The full move-by-move reasoning stream — shared by Live and the Game replay. */
export function ChainOfThought({ items, currentStep }: { items: Thought[]; currentStep?: number }) {
  if (!items.length) return <div className="empty">No moves yet — waiting for the model to think.</div>;
  return (
    <div className="stream">
      {items.map((e, i) => (
        <div key={i} className={"thought" + (e.illegal ? " bad" : "") + (currentStep === e.step ? " cur" : "")}>
          <div className="step">{e.step}</div>
          <div className="head">
            <span className="tool">{e.tool}</span>
            {e.args && <span className="args">{e.args}</span>}
            {e.ctx && <span className="ctx">{e.ctx}</span>}
            {e.tok != null && e.tok > 0 && <span className="tok">{e.tok} tok</span>}
          </div>
          <div className="why">{e.reasoning || "(no reasoning)"}{e.illegal && <span className="err">⚠ {e.illegal}</span>}</div>
        </div>
      ))}
    </div>
  );
}
