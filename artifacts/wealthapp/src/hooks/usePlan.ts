import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { useGoals } from "./useGoals";

interface RawPlanMilestone {
  id: string;
  planId: string;
  title: string;
  targetDate: string | null;
  completedDate: string | null;
  linkedGoalId: string | null;
  linkedGoal: { id: string; title: string; goalType: string } | null;
  status: string;
  notes: string | null;
  orderIndex: number;
  createdAt: string;
}

export interface PlanMilestone extends RawPlanMilestone {
  // Joined client-side from useGoals() — the same computed values shown on the
  // Goals page (goal-holding-linked amount + pacing progress). Null when the
  // milestone has no linked goal, or the goal has no target amount set.
  goalProgress: { currentAmount: number; targetAmount: number; progressPct: number } | null;
}

export interface PlanData {
  id: string;
  clientId: string;
  advisorId: string | null;
  title: string;
  status: string;
  planData: string | null;
  nextReviewDate: string | null;
  updatedAt: string;
}

interface RawPlanPayload {
  plan: PlanData;
  milestones: RawPlanMilestone[];
  advisorId: string | null;
  advisorName: string | null;
  nextReviewDate: string | null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function statusGroup(status: string): "completed" | "in_progress" | "upcoming" {
  if (status === "completed") return "completed";
  if (status === "in_progress" || status === "active") return "in_progress";
  return "upcoming";
}

export function usePlan() {
  const { user, isLoaded } = useUser();
  const { allGoals } = useGoals();

  const query = useQuery<RawPlanPayload | null>({
    queryKey: ["client-plan"],
    queryFn: () => apiFetch<RawPlanPayload>("/client/plan").catch(() => null),
    enabled: isLoaded && !!user,
  });

  const payload = query.data ?? null;
  const goalById = new Map(allGoals.map(g => [g.id, g]));

  const milestones: PlanMilestone[] = (payload?.milestones ?? []).map(m => {
    const goal = m.linkedGoalId ? goalById.get(m.linkedGoalId) : undefined;
    const goalProgress = goal && goal.targetAmountNum && goal.targetAmountNum > 0
      ? {
          currentAmount: goal.computedCurrentAmount,
          targetAmount: goal.targetAmountNum,
          progressPct: goal.progressPct ?? 0,
        }
      : null;
    return { ...m, goalProgress };
  });

  const completedCount = milestones.filter(m => statusGroup(m.status) === "completed").length;
  const inProgressCount = milestones.filter(m => statusGroup(m.status) === "in_progress").length;
  const upcomingCount = milestones.filter(m => statusGroup(m.status) === "upcoming").length;
  const totalCount = milestones.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const nextMilestone = milestones.find(m => statusGroup(m.status) !== "completed") ?? null;

  const nextReviewDate = payload?.nextReviewDate ?? null;
  let daysUntilReview: number | null = null;
  let isReviewOverdue = false;
  if (nextReviewDate) {
    const today = new Date();
    const reviewDate = new Date(nextReviewDate);
    daysUntilReview = daysBetween(today, reviewDate);
    isReviewOverdue = daysUntilReview < 0;
  }

  return {
    plan: payload?.plan ?? null,
    milestones,
    completedCount,
    inProgressCount,
    upcomingCount,
    totalCount,
    completionPct,
    nextMilestone,
    daysUntilReview,
    isReviewOverdue,
    advisorName: payload?.advisorName ?? null,
    advisorId: payload?.advisorId ?? null,
    nextReviewDate,
    loading: query.isLoading,
    statusGroup,
  };
}
