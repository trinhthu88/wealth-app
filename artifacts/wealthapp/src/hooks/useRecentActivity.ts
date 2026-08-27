import { useQueries } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import type { AdvisedPlan, AdvisedPlanTransaction } from "./useAdvisedPlans";

export interface RecentActivityItem extends AdvisedPlanTransaction {
  planName: string;
}

/** Most recent transactions across all of a client's advised plans, merged and sorted by date. */
export function useRecentActivity(plans: AdvisedPlan[], limit = 3) {
  const { user, isLoaded } = useUser();
  const enabled = isLoaded && !!user && plans.length > 0;

  const results = useQueries({
    queries: plans.map(p => ({
      queryKey: ["advised-plan-transactions", p.id],
      queryFn: () => apiFetch<AdvisedPlanTransaction[]>(`/client/advised-plans/${p.id}/transactions`),
      enabled,
    })),
  });

  const loading = enabled && results.some(r => r.isLoading);

  const activity: RecentActivityItem[] = results
    .flatMap((r, i) => (r.data ?? []).map(t => ({ ...t, planName: plans[i].nickname || plans[i].productName })))
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    .slice(0, limit);

  return { activity, loading };
}
