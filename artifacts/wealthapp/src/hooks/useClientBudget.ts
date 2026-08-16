import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface InvestmentContribution {
  label: string;
  amount: number;
  source_id: string;
  source_type: string;
  currency?: string;
}

export interface ClientBudgetMonth {
  id: string;
  userId: string;
  month: string;
  currency: string;
  primaryIncome: string;
  secondaryIncome: string;
  rentalIncome: string;
  otherIncome: string;
  housing: string;
  utilities: string;
  transport: string;
  insurance: string;
  foodDining: string;
  entertainment: string;
  shopping: string;
  health: string;
  education: string;
  otherExpenses: string;
  investmentContributions: InvestmentContribution[];
  totalIncome: string;
  totalExpenses: string;
  totalInvestments: string;
  netSurplus: string;
  savingsRatePct: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function computeTotals(data: Partial<ClientBudgetMonth>): Partial<ClientBudgetMonth> {
  const n = (v: string | undefined | null) => parseFloat(v ?? "0") || 0;

  const totalIncome = n(data.primaryIncome) + n(data.secondaryIncome) + n(data.rentalIncome) + n(data.otherIncome);
  const totalExpenses = n(data.housing) + n(data.utilities) + n(data.transport) + n(data.insurance)
    + n(data.foodDining) + n(data.entertainment) + n(data.shopping) + n(data.health) + n(data.education) + n(data.otherExpenses);
  const contributions = (data.investmentContributions as InvestmentContribution[]) ?? [];
  const totalInvestments = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const netSurplus = totalIncome - totalExpenses - totalInvestments;
  const savingsRatePct = totalIncome > 0 ? (netSurplus / totalIncome) * 100 : 0;

  return {
    ...data,
    totalIncome: String(totalIncome),
    totalExpenses: String(totalExpenses),
    totalInvestments: String(totalInvestments),
    netSurplus: String(netSurplus),
    savingsRatePct: String(savingsRatePct),
  };
}

export function useClientBudget(selectedMonth?: string) {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const enabled = isLoaded && !!user;

  const currentMonthStr = new Date().toISOString().slice(0, 7) + "-01";
  const targetMonth = selectedMonth ?? currentMonthStr;

  const currentQuery = useQuery<ClientBudgetMonth | null>({
    queryKey: ["client-budget", targetMonth],
    queryFn: () => apiFetch<ClientBudgetMonth>(`/client/budget/${targetMonth}`).catch(() => null),
    enabled,
  });

  const historyQuery = useQuery<ClientBudgetMonth[]>({
    queryKey: ["client-budget", "history"],
    queryFn: () => apiFetch<ClientBudgetMonth[]>("/client/budget?limit=12"),
    enabled,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<ClientBudgetMonth>) => {
      const withTotals = computeTotals(data);
      return apiFetch("/client/budget", { method: "POST", body: JSON.stringify(withTotals) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-budget"] });
      qc.invalidateQueries({ queryKey: ["dashboard-networth"] });
      toast.success("Budget saved ✓");
    },
    onError: () => toast.error("Failed to save budget"),
  });

  const syncMutation = useMutation({
    mutationFn: () => apiFetch("/client/budget/sync-contributions", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-budget"] }),
  });

  const months = (historyQuery.data ?? []).slice().reverse(); // ASC for chart
  const currentMonth = currentQuery.data ?? null;

  // Derived values
  const contributions = (currentMonth?.investmentContributions as InvestmentContribution[]) ?? [];
  const rspContributions = contributions.filter(c => c.source_type === "advised_plan");
  const monthlyRspTotal = rspContributions.reduce((s, c) => s + c.amount, 0);
  const hasRspContributions = rspContributions.length > 0;

  const netSurplus = parseFloat(currentMonth?.netSurplus ?? "0") || 0;
  const investableSurplus = Math.max(0, netSurplus);
  const savingsRatePct = parseFloat(currentMonth?.savingsRatePct ?? "0") || 0;

  return {
    currentMonth,
    months,
    loading: currentQuery.isLoading,
    saving: saveMutation.isPending,
    saveMonth: (data: Partial<ClientBudgetMonth>) => saveMutation.mutateAsync(data),
    syncInvestmentContributions: () => syncMutation.mutateAsync(),
    investableSurplus,
    savingsRatePct,
    monthlyRspTotal,
    hasRspContributions,
    currentMonthStr,
  };
}
