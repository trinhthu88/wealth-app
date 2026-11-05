import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import type { Capability, Entitlements, MembershipSummary } from "@workspace/tier-policy";
import { apiFetch } from "@/lib/api";

export const ENTITLEMENTS_QUERY_KEY = ["entitlements"] as const;

export type EntitlementsResponse = Entitlements & {
  advisor: { id: string; name: string | null } | null;
  leadSource: string | null;
  membership: MembershipSummary;
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
  // The open checkpoint is part of the answer, so its cached detail goes with it.
  qc.invalidateQueries({ queryKey: ["checkpoint"] });
  return qc.invalidateQueries({ queryKey: ENTITLEMENTS_QUERY_KEY });
}

export function useCapability(capability: Capability) {
  const { entitlements } = useEntitlements();
  const atCap = entitlements && (capability === "goals" || capability === "holdings" || capability === "sol")
    ? entitlements.atCap[capability]
    : false;
  return { gate: entitlements?.gates[capability] ?? null, atCap, limits: entitlements?.limits ?? null };
}

/**
 * DECISION: a capped Add button looks disabled and shows the checkpoint message, as the
 * brief asks, but it still reports the click. C2 and the sixth-holding path of C5 fire from
 * the refused attempt, so a natively disabled button would mean they could never fire.
 * The empty body cannot create anything: the guard refuses at the cap, and if usage was
 * stale the route rejects the body as invalid.
 */
export function useCapAttempt(path: "/goals" | "/client/holdings") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(path, { method: "POST", body: "{}" }),
    onSettled: () => invalidateEntitlements(qc),
  });
}
