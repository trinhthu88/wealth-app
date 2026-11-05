import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "sonner";
import type { CheckpointCode } from "@workspace/tier-policy";
import { apiFetch } from "@/lib/api";
import { invalidateEntitlements, useEntitlements } from "@/hooks/useEntitlements";

export interface OpenCheckpoint {
  id: string;
  code: CheckpointCode;
  copyKey: CheckpointCode;
  firedAt: string;
  snapshot: Record<string, any>;
}

export const CHECKPOINT_QUERY_KEY = ["checkpoint"] as const;

/**
 * The open checkpoint when it is one of these codes, for a component to render instead
 * of deciding its own condition. Fetching it is what records the checkpoint as shown, so
 * it happens only while a matching component is on screen.
 */
export function useCheckpoint(codes: readonly CheckpointCode[]) {
  const { entitlements } = useEntitlements();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const openCode = entitlements?.openCheckpoint?.code;
  const matches = !!openCode && codes.includes(openCode);

  const query = useQuery<OpenCheckpoint | null>({
    queryKey: CHECKPOINT_QUERY_KEY,
    queryFn: () => apiFetch<OpenCheckpoint | null>("/me/checkpoint"),
    enabled: matches,
  });
  const checkpoint = matches && query.data && codes.includes(query.data.code) ? query.data : null;
  const isFree = entitlements?.tier === "free";

  const accept = useMutation({
    mutationFn: () => apiFetch(`/me/checkpoint/${checkpoint!.id}/accept`, { method: "POST" }),
    onSuccess: () => {
      invalidateEntitlements(queryClient);
      if (isFree) toast.success("Thanks. We're matching you with an advisor.");
      else navigate("/client/advisor/messages");
    },
    onError: () => toast.error("We couldn't send that just yet. Please try again."),
  });

  const dismiss = useMutation({
    mutationFn: () => apiFetch(`/me/checkpoint/${checkpoint!.id}/dismiss`, { method: "POST" }),
    onSuccess: () => invalidateEntitlements(queryClient),
  });

  return { checkpoint, isFree, accept, dismiss };
}
