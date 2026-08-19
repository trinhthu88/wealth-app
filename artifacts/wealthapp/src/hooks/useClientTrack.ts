import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { useAdvisedPlans } from "./useAdvisedPlans";

interface ClientProfileTrack {
  clientTrack: string;
  onboardingTrackComplete: boolean;
}

/** Shared query for /client/profile/track — the single source of truth for onboarding-track state. */
function useClientProfileTrackQuery(enabled = true) {
  const { user, isLoaded } = useUser();

  return useQuery<ClientProfileTrack>({
    queryKey: ["client-track"],
    queryFn: () => apiFetch("/client/profile/track"),
    enabled: isLoaded && !!user && enabled,
  });
}

export function useClientTrack() {
  const profileQuery = useClientProfileTrackQuery();
  const { plans, loading: plansLoading } = useAdvisedPlans();

  const track = profileQuery.data?.clientTrack ?? "track_b";
  const onboardingComplete = profileQuery.data?.onboardingTrackComplete ?? false;
  const hasPlans = plans.length > 0;

  const isTrackA = track === "track_a" && hasPlans;
  const isTrackB = track === "track_b" || !hasPlans;
  const hasPendingAdvisorSetup = track === "track_a" && !hasPlans;

  return {
    isTrackA,
    isTrackB,
    hasPendingAdvisorSetup,
    onboardingTrackComplete: onboardingComplete,
    loading: profileQuery.isLoading || plansLoading,
  };
}

/**
 * Lightweight variant of useClientTrack for callers that only need onboarding-completion
 * status (e.g. the post-sign-in redirect) and shouldn't pay for the advised-plans fetch.
 */
export function useOnboardingTrackComplete(enabled = true) {
  const profileQuery = useClientProfileTrackQuery(enabled);

  return {
    onboardingTrackComplete: profileQuery.data?.onboardingTrackComplete ?? false,
    isLoading: enabled && profileQuery.isLoading,
  };
}
