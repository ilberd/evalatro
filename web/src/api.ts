import { LeaderboardRow, GameSummaryT, GameDetail } from "./api-types";

export async function getLeaderboard(officialOnly = false): Promise<LeaderboardRow[]> {
  const r = await fetch("/api" + (officialOnly ? "?official=1" : ""));
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
