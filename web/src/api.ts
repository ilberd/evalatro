import { LeaderboardRow, GameSummaryT, GameDetail } from "./api-types";

export async function getLeaderboard(officialOnly = false, source?: string): Promise<LeaderboardRow[]> {
  const params = new URLSearchParams();
  if (officialOnly) params.set("official", "1");
  if (source) params.set("source", source);
  const qs = params.toString();
  const r = await fetch("/api" + (qs ? "?" + qs : ""));
  const j = await r.json();
  return j.leaderboard || [];
}
export async function getModelGames(model: string): Promise<GameSummaryT[]> {
  const r = await fetch("/api/games?model=" + encodeURIComponent(model));
  const j = await r.json();
  return j.games || [];
}
export async function getGame(gameId: string): Promise<GameDetail> {
  const r = await fetch("/api/game?game=" + encodeURIComponent(gameId));
  return r.json();
}
