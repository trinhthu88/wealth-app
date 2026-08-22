import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// Passive-on-view trigger for api-server/src/lib/offTrackTasks.ts — the server
// re-derives off_track status itself and dedupes against any already-open
// advisor task for this goal, so calling this more than once (e.g. on every
// mount of an off-track goal card) is harmless.
export function useEnsureOffTrackTask() {
  return useMutation({
    mutationFn: (goalId: string) => apiFetch<{ created: boolean; status: string }>(
      `/client/goals/${goalId}/ensure-off-track-task`, { method: "POST" },
    ),
  });
}
