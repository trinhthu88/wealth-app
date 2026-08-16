import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { useClientTrack } from "./useClientTrack";
import { useAdvisedPlans } from "./useAdvisedPlans";
import { useClientHoldings } from "./useClientHoldings";
import { usePortfolioTotals } from "./usePortfolioTotals";
import { useProfile } from "./useProfile";
import type { ClientBudgetMonth } from "./useClientBudget";

export interface DashboardGoal {
  id: string;
  title: string;
  goalType: string;
  targetAmount: string | null;
  currentAmount: string;
  targetDate: string | null;
  status: string;
  priority: string;
  currency: string;
  createdAt: string;
}

export interface ScenarioAlert {
  id: string;
  scenarioName: string | null;
  scenarioType: string;
  parameters: Record<string, unknown>;
  alertStatus: string;
  baselineFinalValue: string | null;
  scenarioFinalValue: string | null;
  deltaValue: string | null;
  deltaPct: string | null;
  createdAt: string;
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export function useDashboardData() {
  const { user, isLoaded } = useUser();
  const { profile } = useProfile();
  const { isTrackA, isTrackB, hasPendingAdvisorSetup, loading: trackLoading } = useClientTrack();
  const { plans, totalAdvisedValue, totalNetContribution: advisedContrib, loading: plansLoading } = useAdvisedPlans();
  const { holdings, totalSelfManagedValue, loading: holdingsLoading } = useClientHoldings();
  const totals = usePortfolioTotals();

  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  const enabled = isLoaded && !!user;

  const goalsQuery = useQuery<DashboardGoal[]>({
    queryKey: ["dashboard-goals"],
    queryFn: () => apiFetch("/client/dashboard/goals"),
    enabled,
  });

  const budgetQuery = useQuery<ClientBudgetMonth | null>({
    queryKey: ["client-budget", "current"],
    queryFn: () => apiFetch<ClientBudgetMonth>(`/client/budget/${currentMonth}`).catch(() => null),
    enabled,
  });

  const netWorthQuery = useQuery<NetWorthSummary>({
    queryKey: ["dashboard-networth"],
    queryFn: () => apiFetch("/client/dashboard/networth"),
    enabled,
  });

  const scenarioAlertQuery = useQuery<ScenarioAlert | null>({
    queryKey: ["dashboard-scenario-alert"],
    queryFn: () => apiFetch("/client/dashboard/scenario-alert"),
    enabled,
  });

  const advisorQuery = useQuery<{ id: string; fullName: string | null } | null>({
    queryKey: ["dashboard-advisor"],
    queryFn: () => apiFetch("/client/dashboard/advisor"),
    enabled,
  });

  const isLoading = trackLoading || plansLoading || holdingsLoading || totals.loading ||
    goalsQuery.isLoading || budgetQuery.isLoading || netWorthQuery.isLoading;

  return {
    isLoading,
    isTrackA,
    isTrackB,
    hasPendingAdvisorSetup,
    clientTrack: isTrackA ? "track_a" : "track_b",
    portfolio: {
      totalValue: totals.totalPortfolioValue,
      totalInvested: totals.totalNetContribution,
      gainLoss: totals.totalGainLoss,
      gainLossPct: totals.totalGainLossPct,
      cagr: totals.overallCagr,
    },
    netWorth: netWorthQuery.data ?? null,
    topGoals: goalsQuery.data ?? [],
    currentBudget: budgetQuery.data ?? null,
    scenarioAlert: scenarioAlertQuery.data ?? null,
    advisorName: advisorQuery.data?.fullName ?? null,
    advisorId: advisorQuery.data?.id ?? null,
    preferredCurrency: profile?.preferredCurrency ?? "USD",
    plans,
  };
}
