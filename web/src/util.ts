export const fmtMoney = (v?: number | null) => (v == null ? "—" : "$" + v);
export const fmtNum = (v?: number | null) => (v == null ? "—" : v.toLocaleString());
export const fmtDate = (ts?: number) => { try { return ts ? new Date(ts).toLocaleString() : ""; } catch { return ""; } };

/** Class for a 0–100 score: green ≥ 60, gold ≥ 25, else red. */
export const scoreClass = (s: number) => (s >= 60 ? "s-hi" : s >= 25 ? "s-mid" : "s-lo");

export const outcomeClass = (o?: string | null) =>
  ["won", "lost", "stuck", "error", "cap"].includes(o || "") ? (o as string) : "cap";
