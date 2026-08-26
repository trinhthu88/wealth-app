import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export interface WealthScoreDimensions {
  savingsConsistency: number;
  investmentGrowth: number;
  goalProgress: number;
  debtToAsset: number;
  budgetSurplus: number;
}

export interface WealthScoreRow {
  id: string;
  scoreDate: string;
  overallScore: number;
  details: { weights: Record<string, number>; dimensions: WealthScoreDimensions } | null;
  gated: false;
}

export interface WealthScoreGated {
  gated: true;
  monthsActive: number;
}

export type WealthScoreResponse = WealthScoreRow | WealthScoreGated | null;

export interface WealthScoreHistoryRow {
  id: string;
  scoreDate: string;
  overallScore: number | null;
}

export function useWealthScore() {
  const { user, isLoaded } = useUser();
  const enabled = isLoaded && !!user;

  const scoreQuery = useQuery<WealthScoreResponse>({
    queryKey: ["client-wealth-score"],
    queryFn: () => apiFetch<WealthScoreResponse>("/client/health-score").catch(() => null),
    enabled,
  });

  const historyQuery = useQuery<WealthScoreHistoryRow[]>({
    queryKey: ["client-wealth-score", "history"],
    queryFn: () => apiFetch<WealthScoreHistoryRow[]>("/client/health-score/history").catch(() => []),
    enabled,
  });

  const score = scoreQuery.data;
  const isGated = !!score && "gated" in score && score.gated === true;
  const row = score && !isGated ? (score as WealthScoreRow) : null;

  // History is ordered scoreDate desc — take the most recent 6 and reverse to
  // chronological order for the sparkline.
  const sparklineData = (historyQuery.data ?? [])
    .slice(0, 6)
    .reverse()
    .map(r => ({ scoreDate: r.scoreDate, overallScore: r.overallScore ?? 0 }));

  // Compare the two most recent DISTINCT-day scores for the trend line —
  // history includes today's row (same as `row`), so the "prior" score is the
  // next one down, not necessarily history[1] if there were same-day dupes.
  const history = historyQuery.data ?? [];
  const priorScore = history.length > 1 ? history[1].overallScore : null;
  const trendDelta = row && priorScore != null ? row.overallScore - priorScore : null;

  return {
    isLoading: scoreQuery.isLoading || historyQuery.isLoading,
    isGated,
    monthsActive: isGated ? (score as WealthScoreGated).monthsActive : null,
    row,
    hasData: score !== null,
    sparklineData,
    trendDelta,
  };
}
