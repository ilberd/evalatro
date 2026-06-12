import { ReactNode } from "react";
import { CardT } from "../api-types";

const SUIT: Record<string, { s: string; c: string }> = {
  H: { s: "♥", c: "red" }, D: { s: "♦", c: "red" }, S: { s: "♠", c: "black" }, C: { s: "♣", c: "black" },
};
const SEAL: Record<string, string> = { Red: "#e0405a", Blue: "#3aa0e0", Gold: "#ffce5c", Purple: "#b388ff" };
const rankLabel = (r?: string) => (r === "T" ? "10" : r ?? "?");

export function Card({ c, played }: { c: CardT; played?: boolean }) {
  if (c?.hidden) return <div className="pcard back" title="face down" />;
  const su = SUIT[c.suit || ""] || { s: c.suit || "?", c: "black" };
  const ed = (c.edition || "").toLowerCase();
  const edcls = ed.includes("foil") ? "foil" : ed.includes("holo") ? "holo" : ed.includes("poly") ? "poly" : "";
  return (
    <div className={`pcard ${su.c} ${edcls} ${played ? "played" : ""}`} title={c.label || ""}>
      <span className="rank">{rankLabel(c.rank)}</span>
      <span className="pip-sm">{su.s}</span>
      <span className="pip-lg">{su.s}</span>
      {c.seal && <span className="seal" style={{ background: SEAL[c.seal] || "#fff" }} />}
      {c.enhancement && <span className="enh">{String(c.enhancement).replace(/^m_/, "").slice(0, 8)}</span>}
    </div>
  );
}

export function Joker({ c, i }: { c: CardT; i: number }) {
  return (
    <div className="jcard" title={c.effect || ""}>
      <span className="idx">{i + 1}</span>
      <span className="nm">{c.label || c.key || "Joker"}</span>
      {c.edition && <span className="ed">{c.edition}</span>}
    </div>
  );
}

export function Consumable({ c }: { c: CardT }) {
  return (
    <div className="jcard cons" title={c.effect || ""}>
      <span className="nm">{c.label || c.key || "?"}</span>
      {c.set && <span className="ed">{c.set}</span>}
    </div>
  );
}

/** A shop / pack item: a playing card if it looks like one, else a joker/consumable tile. */
export function ItemCard({ c, idx }: { c: CardT; idx?: number }) {
  const isPlaying = !!(c.suit && SUIT[c.suit]);
  if (isPlaying) return <Card c={c} />;
  return (
    <div className="jcard cons" title={c.effect || ""}>
      {idx != null && <span className="idx">{idx}</span>}
      <span className="nm">{c.label || c.key || "?"}</span>
      {c.set && <span className="ed">{c.set}</span>}
    </div>
  );
}

export function Priced({ children, cost }: { children: ReactNode; cost?: number }) {
  return <div className="priced">{children}{cost != null && <span className="cost">${cost}</span>}</div>;
}
