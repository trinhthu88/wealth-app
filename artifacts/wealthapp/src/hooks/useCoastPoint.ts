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
  goalTargetDate?: string;
  monthlyContribution?: number;
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

// Same tiebreak as api-server/src/routes/coastPoint.ts's pickRetirementGoal —
// duplicated (not shared, no code path connects a frontend hook to that backend
// file) but kept in sync by comment: prefer a goal with both a target amount and
// date, furthest-out target date among those. Only used to seed the initial
// extraMonthly guess sent as a query param — the actual goal title and
// monthlyContribution shown to the client always come back from the API
// response below, never from this local guess, so even if this occasionally
// disagrees with the backend's pick, nothing displayed can be wrong — only the
// suggested dollar increment could be slightly off, which just becomes a
// different (still real, still computed) suggestion.
function seedRetirementGoal(goals: Array<{ goalType: string; targetAmount: string | null; targetDate: string | null; monthlyContribution: string }>) {
  const usable = goals.filter(g => (g.goalType === "retire" || g.goalType === "retirement") && g.targetAmount && g.targetDate);
  if (usable.length === 0) return null;
  return usable.reduce((latest, g) => (new Date(g.targetDate!) > new Date(latest.targetDate!) ? g : latest));
}

export function useCoastPoint() {
  const { user, isLoaded } = useUser();
  const { allGoals } = useGoals();
  const enabled = isLoaded && !!user;

  const seedGoal = seedRetirementGoal(allGoals);
  const extraMonthly = suggestedExtraMonthly(seedGoal ? parseFloat(seedGoal.monthlyContribution) || 0 : 0);

  const query = useQuery<CoastPointResponse>({
    queryKey: ["client-coast-point", extraMonthly],
    queryFn: () => apiFetch<CoastPointResponse>(`/client/plan/coast-point?extraMonthly=${extraMonthly}`),
    enabled: enabled && !!seedGoal,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    extraMonthly,
  };
}
