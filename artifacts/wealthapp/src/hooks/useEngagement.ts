import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export interface Engagement {
  streakWeeks: number;
  lastCheckinAt: string | null;
  milestones: string[];
  lastTipWeek: string | null;
}

const CACHE_KEY = "tala_engagement_cache";

function readCache(userId: string): Engagement | undefined {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as Engagement) : undefined;
  } catch {
    return undefined;
  }
}

/** The server's engagement facts. localStorage is only a cache, so the first paint is instant. */
export function useEngagement() {
  const { user, isLoaded } = useUser();
  return useQuery<Engagement>({
    queryKey: ["engagement"],
    enabled: isLoaded && !!user,
    placeholderData: () => (user ? readCache(user.id) : undefined),
    queryFn: async () => {
      const engagement = await apiFetch<Engagement>("/me/engagement");
      try {
        if (user) localStorage.setItem(`${CACHE_KEY}:${user.id}`, JSON.stringify(engagement));
      } catch {
        // A full or blocked store only costs the instant first paint.
      }
      return engagement;
    },
  });
}
