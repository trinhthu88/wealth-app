import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { useGoals } from "./useGoals";

export interface CoastPointResult {
  canCoastNow: boolean;
  coastMonthsFromNow: number | null;
  coastDate: string | null;
  valueAtCoastPoint: number | null;
}

export interface CoastPointResponse {
  available: boolean;
  reason?: string;
  goalId?: string;
  goalTitle?: string;
  blendedAnnualReturnPct?: number;
  portfolioValue?: number;
  base?: CoastPointResult;
  accelerated?: CoastPointResult | null;
  extraMonthly?: number;
}

// Extra monthly amount Sol proposes modeling: a quarter of the client's current
// contribution (floor $100), rounded to the nearest $50 — scaled to what they're
// already contributing, never a fixed constant.
function suggestedExtraMonthly(currentMonthly: number): number {
  const raw = Math.max(100, currentMonthly * 0.25);
  return Math.round(raw / 50) * 50;
}

export function useCoastPoint() {
  const { user, isLoaded } = useUser();
  const { allGoals } = useGoals();
  const enabled = isLoaded && !!user;

  // "retire" matches AddGoalSheet.tsx's GOAL_TYPES id — not the string "retirement".
  const retirementGoal = allGoals.find(g => g.goalType === "retire") ?? null;
  const currentMonthly = retirementGoal ? parseFloat(retirementGoal.monthlyContribution) || 0 : 0;
  const extraMonthly = suggestedExtraMonthly(currentMonthly);

  const query = useQuery<CoastPointResponse>({
    queryKey: ["client-coast-point", extraMonthly],
    queryFn: () => apiFetch<CoastPointResponse>(`/client/plan/coast-point?extraMonthly=${extraMonthly}`),
    enabled: enabled && !!retirementGoal,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    retirementGoal,
    currentMonthly,
    extraMonthly,
  };
}
