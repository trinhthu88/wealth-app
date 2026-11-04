import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import type { Capability, Entitlements } from "@workspace/tier-policy";
import { apiFetch } from "@/lib/api";

export const ENTITLEMENTS_QUERY_KEY = ["entitlements"] as const;

export type EntitlementsResponse = Entitlements & {
  advisor: { id: string; name: string | null } | null;
  leadSource: string | null;
};

/** The server's answer for every gate. Screens render from this and never decide a gate. */
export function useEntitlements() {
  const { user, isLoaded } = useUser();
  const query = useQuery<EntitlementsResponse>({
    queryKey: ENTITLEMENTS_QUERY_KEY,
    queryFn: () => apiFetch<EntitlementsResponse>("/me/entitlements"),
    enabled: isLoaded && !!user,
  });
  return { entitlements: query.data ?? null, isLoading: query.isLoading, isError: query.isError };
}

/** Call after any mutation that changes usage or lead status. */
export function invalidateEntitlements(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
}

export function useCapability(capability: Capability) {
  const { entitlements } = useEntitlements();
  const atCap = entitlements && (capability === "goals" || capability === "holdings" || capability === "sol")
    ? entitlements.atCap[capability]
    : false;
  return { gate: entitlements?.gates[capability] ?? null, atCap, limits: entitlements?.limits ?? null };
}
