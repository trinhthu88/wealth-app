import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";

export type OnboardingStage = "not_started" | "profile" | "complete";

interface ClientProfileTrack {
  /** Derived on the server from advised plans visible to the client. */
  track: "advised" | "self_managed";
  hasPendingAdvisorSetup: boolean;
  onboardingStage: OnboardingStage;
  preferredCurrency: string;
  advisorId: string | null;
}

/** Shared query for /client/profile/track — the single source of truth for track and onboarding stage. */
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
  const isTrackA = profileQuery.data?.track === "advised";

  return {
    isTrackA,
    isTrackB: !isTrackA,
    hasPendingAdvisorSetup: profileQuery.data?.hasPendingAdvisorSetup ?? false,
    onboardingStage: profileQuery.data?.onboardingStage ?? "not_started",
    onboardingTrackComplete: profileQuery.data?.onboardingStage === "complete",
    loading: profileQuery.isLoading,
  };
}

/**
 * Lightweight variant of useClientTrack for callers that only need the
 * onboarding stage (e.g. the post-sign-in redirect).
 */
export function useOnboardingStage(enabled = true) {
  const profileQuery = useClientProfileTrackQuery(enabled);

  return {
    onboardingStage: profileQuery.data?.onboardingStage ?? "not_started",
    isLoading: enabled && profileQuery.isLoading,
  };
}
