import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { useAdvisedPlans } from "./useAdvisedPlans";
import { useClientHoldings } from "./useClientHoldings";

export type GoalPacing = "no_target" | "on_track" | "at_risk" | "off_track" | "completed";

export interface GoalFundingBreakdown {
  sourceType: string;
  sourceId: string;
  allocationPct: number;
  sourceValueUsd: number;
  contributionUsd: number;
}

export interface RawGoal {
  id: string;
  userId: string;
  title: string;
  goalType: string;
  targetAmount: string | null;
  currentAmount: string;
  monthlyContribution: string;
  targetDate: string | null;
  currency: string;
  priority: string;
  status: string;
  notes: string | null;
  isAdvisorManaged: boolean;
  createdAt: string;
  updatedAt: string;
  funding: {
    currentAmount: number;
    currency: "USD";
    source: "links" | "manual";
    breakdown: GoalFundingBreakdown[];
  };
  targetAmountUsd: number | null;
  pacing: GoalPacing;
  progressPct: number | null;
  expectedPct: number | null;
  monthsRemaining: number | null;
  projectedCompletionDate: string | null;
}

export interface GoalHoldingLink {
  id: string;
  goalId: string;
  userId: string;
  sourceType: "advised_plan" | "self_holding";
  sourceId: string;
  allocationPct: string;
  createdAt: string;
}

export interface EnrichedGoal extends RawGoal {
  computedCurrentAmount: number;
  targetAmountNum: number | null;
  links: GoalHoldingLink[];
  progressPct: number | null;
  trackStatus: GoalPacing;
  expectedPct: number | null;
  monthsRemaining: number | null;
  projectedCompletionDate: string | null;
}

function priorityToNum(p: string): number {
  if (p === "high" || p === "1") return 1;
  if (p === "medium" || p === "2") return 2;
  if (p === "low" || p === "3") return 3;
  const n = parseInt(p);
  return isNaN(n) ? 2 : n;
}

export function useGoals() {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const enabled = isLoaded && !!user;

  const { plans } = useAdvisedPlans();
  const { holdings } = useClientHoldings();

  const goalsQuery = useQuery<RawGoal[]>({
    queryKey: ["client-goals"],
    queryFn: () => apiFetch("/goals"),
    enabled,
  });

  const linksQuery = useQuery<GoalHoldingLink[]>({
    queryKey: ["client-goal-links"],
    queryFn: async () => {
      const goals = goalsQuery.data ?? [];
      if (goals.length === 0) return [];
      try {
        const allLinks = await Promise.all(
          goals.map(g =>
            apiFetch<GoalHoldingLink[]>(`/client/goals/${g.id}/links`).catch(() => [] as GoalHoldingLink[])
          )
        );
        return allLinks.flat();
      } catch {
        return [];
      }
    },
    enabled: enabled && (goalsQuery.data?.length ?? 0) > 0,
  });

  const rawGoals = goalsQuery.data ?? [];
  const allLinks = linksQuery.data ?? [];

  // Build a plan/holding lookup map
  const enrichGoal = (g: RawGoal): EnrichedGoal => {
    const links = allLinks.filter(l => l.goalId === g.id);
    return {
      ...g,
      computedCurrentAmount: g.funding.currentAmount,
      targetAmountNum: g.targetAmountUsd,
      links,
      trackStatus: g.pacing,
    };
  };

  const enrichedGoals = rawGoals.map(enrichGoal);

  const activeGoals = enrichedGoals
    .filter(g => g.status !== "completed" && g.status !== "cancelled")
    .sort((a, b) => {
      const pa = priorityToNum(a.priority);
      const pb = priorityToNum(b.priority);
      if (pa !== pb) return pa - pb;
      // Within same priority: off_track first, then at_risk, then on_track
      const statusOrder = { off_track: 0, at_risk: 1, on_track: 2, no_target: 3, completed: 4 };
      return (statusOrder[a.trackStatus] ?? 3) - (statusOrder[b.trackStatus] ?? 3);
    });

  const completedGoals = enrichedGoals.filter(g => g.status === "completed");

  const goalsOnTrack = activeGoals.filter(g => g.trackStatus === "on_track").length;
  const goalsAtRisk = activeGoals.filter(g => g.trackStatus === "at_risk").length;
  const goalsOffTrack = activeGoals.filter(g => g.trackStatus === "off_track").length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["client-goals"] });
    qc.invalidateQueries({ queryKey: ["client-goal-links"] });
    qc.invalidateQueries({ queryKey: ["dashboard-goals"] });
  };

  const addGoalMut = useMutation({
    mutationFn: (data: {
      title: string; goalType: string; targetAmount?: number | null;
      targetDate?: string | null; priority?: string; notes?: string | null;
    }) => apiFetch("/goals", {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        goalType: data.goalType,
        targetAmount: data.targetAmount != null && data.targetAmount > 0 ? String(data.targetAmount) : null,
        targetDate: data.targetDate ?? null,
        priority: data.priority ?? "medium",
        status: "active",
        notes: data.notes ?? null,
      }),
    }),
    onSuccess: (_data, variables) => {
      invalidate();
      track("goal_created", { goalType: variables.goalType });
      toast.success("Goal added");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to add goal"),
  });

  const updateGoalMut = useMutation({
    mutationFn: ({ id, data }: {
      id: string; data: {
        title: string; goalType: string; targetAmount?: number | null;
        targetDate?: string | null; priority?: string; notes?: string | null;
        currentAmount?: number | null;
        currency?: string;
      };
    }) => apiFetch(`/goals/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: data.title,
        goalType: data.goalType,
        targetAmount: data.targetAmount != null && data.targetAmount > 0 ? String(data.targetAmount) : null,
        targetDate: data.targetDate ?? null,
        priority: data.priority ?? "medium",
        notes: data.notes ?? null,
        ...(data.currentAmount != null ? { currentAmount: String(data.currentAmount) } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
      }),
    }),
    onSuccess: () => { invalidate(); toast.success("Goal updated"); },
    onError: () => toast.error("Failed to update goal"),
  });

  const patchStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/goals/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_, vars) => {
      invalidate();
      if (vars.status === "completed") toast.success("Goal marked complete");
      else if (vars.status === "cancelled") toast.success("Goal removed.");
      else toast.success("Goal updated.");
    },
  });

  const addLinkMut = useMutation({
    mutationFn: ({ goalId, sourceType, sourceId, allocationPct }: {
      goalId: string; sourceType: string; sourceId: string; allocationPct: number;
    }) => apiFetch(`/client/goals/${goalId}/links`, {
      method: "POST",
      body: JSON.stringify({ sourceType, sourceId, allocationPct }),
    }),
    onSuccess: () => { invalidate(); toast.success("Investment linked"); },
    onError: (e: Error) => {
      // Over-allocation (409, carries remainingPct) is explained inline by Sol
      // instead — see GoalHoldingLinks.tsx's handleLink catch block.
      if ((e as any).remainingPct !== undefined) return;
      if (e.message?.includes("already linked")) {
        toast.error("This investment is already linked to this goal.");
      } else {
        toast.error(e.message || "Failed to link investment");
      }
    },
  });

  const removeLinkMut = useMutation({
    mutationFn: (linkId: string) => apiFetch(`/client/goals/links/${linkId}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast.success("Link removed."); },
  });

  return {
    activeGoals,
    completedGoals,
    allGoals: enrichedGoals,
    goalsOnTrack,
    goalsAtRisk,
    goalsOffTrack,
    loading: goalsQuery.isLoading,
    plans,
    holdings,
    allLinks,
    addGoal: addGoalMut.mutateAsync,
    updateGoal: (id: string, data: Parameters<typeof updateGoalMut.mutateAsync>[0]["data"]) =>
      updateGoalMut.mutateAsync({ id, data }),
    deleteGoal: (id: string) => patchStatusMut.mutateAsync({ id, status: "cancelled" }),
    markComplete: (id: string) => patchStatusMut.mutateAsync({ id, status: "completed" }),
    reopenGoal: (id: string) => patchStatusMut.mutateAsync({ id, status: "active" }),
    addHoldingLink: addLinkMut.mutateAsync,
    removeHoldingLink: removeLinkMut.mutateAsync,
  };
}
