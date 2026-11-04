import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CheckpointCode } from "@workspace/tier-policy";
import { apiFetch } from "@/lib/api";
import { invalidateEntitlements } from "@/hooks/useEntitlements";

// The one interest action. The server takes the person from their own profile and
// keeps one live lead per user, so this is safe to call from every control.
export function useCreateLeadFromInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: CheckpointCode) => apiFetch("/leads/from-interest", {
      method: "POST",
      body: JSON.stringify({ source }),
    }),
    onSuccess: () => invalidateEntitlements(queryClient),
  });
}
