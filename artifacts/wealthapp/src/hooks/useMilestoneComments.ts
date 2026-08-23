import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export interface MilestoneComment {
  id: string;
  milestoneId: string;
  userId: string;
  authorRole: string;
  authorName: string | null;
  content: string;
  createdAt: string;
}

export function useMilestoneComments(milestoneId: string, enabled: boolean = true) {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();

  const query = useQuery<MilestoneComment[]>({
    queryKey: ["milestone-comments", milestoneId],
    queryFn: () =>
      apiFetch<MilestoneComment[]>(`/client/plan/milestones/${milestoneId}/comments`).catch(() => []),
    enabled: isLoaded && !!user && !!milestoneId && enabled,
    refetchInterval: 30_000, // poll every 30s (simple realtime substitute)
  });

  const addMutation = useMutation({
    mutationFn: (content: string) =>
      apiFetch(`/client/plan/milestones/${milestoneId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: ["milestone-comments", milestoneId] });
      const prev = qc.getQueryData<MilestoneComment[]>(["milestone-comments", milestoneId]) ?? [];
      const optimistic: MilestoneComment = {
        id: `temp-${Date.now()}`,
        milestoneId,
        userId: user?.id ?? "",
        authorRole: "client",
        authorName: user?.fullName ?? "You",
        content,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData(["milestone-comments", milestoneId], [...prev, optimistic]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["milestone-comments", milestoneId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["milestone-comments", milestoneId] }),
  });

  return {
    comments: query.data ?? [],
    loading: query.isLoading,
    adding: addMutation.isPending,
    addComment: (content: string) => addMutation.mutateAsync(content),
    error: addMutation.isError ? "Failed to send — try again." : null,
  };
}
