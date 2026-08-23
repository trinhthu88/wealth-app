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
  // True for a pathway entry synthesized from a goal rather than an
  // advisor-authored plan_milestones row — see the note in usePlan() below.
  isGoalDerived: boolean;
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
  plan: PlanData | null;
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
  const { allGoals, loading: goalsLoading } = useGoals();

  const query = useQuery<RawPlanPayload | null>({
    queryKey: ["client-plan"],
    queryFn: () => apiFetch<RawPlanPayload>("/client/plan").catch(() => null),
    enabled: isLoaded && !!user,
  });

  const payload = query.data ?? null;
  const goalById = new Map(allGoals.map(g => [g.id, g]));

  // Advisor-authored milestones (plan_milestones), enriched with the same
  // computed goal progress the Goals page shows. There is currently no
  // advisor-facing UI anywhere that creates these, so in practice this list
  // is empty for every real client — kept so it still works once that UI
  // exists, and so an explicitly-authored milestone always wins over an
  // auto-derived one for the same goal.
  const explicitMilestones: PlanMilestone[] = (payload?.milestones ?? []).map(m => {
    const goal = m.linkedGoalId ? goalById.get(m.linkedGoalId) : undefined;
    const goalProgress = goal && goal.targetAmountNum && goal.targetAmountNum > 0
      ? {
          currentAmount: goal.computedCurrentAmount,
          targetAmount: goal.targetAmountNum,
          progressPct: goal.progressPct ?? 0,
        }
      : null;
    return { ...m, goalProgress, isGoalDerived: false };
  });

  const explicitlyLinkedGoalIds = new Set(
    explicitMilestones.map(m => m.linkedGoalId).filter((id): id is string => !!id)
  );

  // The actual pathway content for every real client today: one entry per
  // active goal that doesn't already have its own advisor-authored milestone.
  // Sol reads this straight off the client's own goals + linked-holding
  // progress — no separate authoring step required.
  const goalDerivedMilestones: PlanMilestone[] = allGoals
    .filter(g => g.status !== "cancelled" && !explicitlyLinkedGoalIds.has(g.id))
    .map(g => {
      const isDone = g.status === "completed" || g.trackStatus === "completed";
      const goalProgress = g.targetAmountNum && g.targetAmountNum > 0
        ? { currentAmount: g.computedCurrentAmount, targetAmount: g.targetAmountNum, progressPct: g.progressPct ?? 0 }
        : null;
      return {
        id: `goal:${g.id}`,
        planId: payload?.plan?.id ?? "",
        title: g.title,
        targetDate: g.targetDate,
        completedDate: isDone ? g.updatedAt : null,
        linkedGoalId: g.id,
        linkedGoal: { id: g.id, title: g.title, goalType: g.goalType },
        // Placeholder — reassigned below once merged with explicit milestones
        // and sorted chronologically, so only the single nearest open goal
        // reads as "in progress" rather than every goal at once.
        status: isDone ? "completed" : "upcoming",
        notes: null,
        orderIndex: 0,
        createdAt: g.createdAt,
        goalProgress,
        isGoalDerived: true,
      };
    });

  const merged = [...explicitMilestones, ...goalDerivedMilestones].sort((a, b) => {
    if (!a.targetDate && !b.targetDate) return 0;
    if (!a.targetDate) return 1;
    if (!b.targetDate) return -1;
    return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
  });

  // Only the nearest not-yet-done goal-derived entry becomes "in progress" —
  // explicit milestones keep whatever status their author set, untouched.
  let markedNext = false;
  const milestones: PlanMilestone[] = merged.map(m => {
    if (!m.isGoalDerived) return m;
    if (statusGroup(m.status) === "completed") return m;
    if (!markedNext) { markedNext = true; return { ...m, status: "in_progress" }; }
    return m;
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
    loading: query.isLoading || goalsLoading,
    statusGroup,
  };
}
