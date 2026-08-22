import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// Fires POST /leads/from-interest for the currently-authenticated user — the
// server pulls email/name from their own profile and dedupes against any
// existing non-churned lead, so this is safe to call every time an interest
// CTA is clicked, not just the first time.
export function useCreateLeadFromInterest() {
  return useMutation({
    mutationFn: (source: string) => apiFetch("/leads/from-interest", {
      method: "POST",
      body: JSON.stringify({ source }),
    }),
  });
}
