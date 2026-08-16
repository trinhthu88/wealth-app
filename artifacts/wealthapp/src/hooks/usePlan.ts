import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export interface PlanMilestone {
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

export interface PlanPayload {
  plan: PlanData;
  milestones: PlanMilestone[];
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

  const query = useQuery<PlanPayload | null>({
    queryKey: ["client-plan"],
    queryFn: () => apiFetch<PlanPayload>("/client/plan").catch(() => null),
    enabled: isLoaded && !!user,
  });

  const payload = query.data ?? null;
  const milestones = payload?.milestones ?? [];

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
