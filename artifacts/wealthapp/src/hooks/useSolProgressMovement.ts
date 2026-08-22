import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// Thin fetch over GET /client/goals/:id/progress-movement — the deterministic
// diff (market vs. contribution vs. reallocation) lives entirely in
// api-server/src/lib/goalProgressSnapshot.ts. This hook just hands that data to
// generateSolCopy (see @/lib/sol) for phrasing.
export interface ProgressMovement {
  hasPrior: boolean;
  fromDate: string | null;
  toDate: string | null;
  deltaTotal: number;
  marketDelta: number;
  contributionDelta: number;
  reallocationDelta: number;
}

export function useSolProgressMovement(goalId: string, enabled: boolean) {
  return useQuery<ProgressMovement>({
    queryKey: ["sol-progress-movement", goalId],
    queryFn: () => apiFetch(`/client/goals/${goalId}/progress-movement`),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
