import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { useAdvisedPlans } from "./useAdvisedPlans";

interface ClientProfileTrack {
  clientTrack: string;
  onboardingTrackComplete: boolean;
}

export function useClientTrack() {
  const { user, isLoaded } = useUser();

  const profileQuery = useQuery<ClientProfileTrack>({
    queryKey: ["client-track"],
    queryFn: () => apiFetch("/client/profile/track"),
    enabled: isLoaded && !!user,
  });

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
