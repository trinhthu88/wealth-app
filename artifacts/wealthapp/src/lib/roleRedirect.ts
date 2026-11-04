import type { Profile } from "@/hooks/useProfile";
import type { OnboardingStage } from "@/hooks/useClientTrack";

/**
 * Single source of truth for where /dashboard sends a signed-in user.
 * Pulled out of the RoleRedirect component so it's unit-testable without
 * rendering React or mocking react-query.
 */
export function resolveRoleRedirectPath(
  role: Profile["role"] | undefined,
  onboardingStage: OnboardingStage,
  pendingPayment = false,
): string {
  if (role === "super_admin") return "/admin/dashboard";
  if (role === "advisor") return "/advisor/dashboard";
  // A promoted client's next sign-in lands on the activation screen. "Not now" goes straight to
  // /client/dashboard, so this doesn't trap them.
  if (pendingPayment) return "/client/activate";
  if (role === "free_user") {
    return onboardingStage === "complete" ? "/free/dashboard" : "/free/onboarding";
  }
  // DECISION: the brief says onboardingTrackComplete, but that column is deprecated;
  // client_profiles.onboarding_stage owns onboarding state, so both tiers read it.
  return onboardingStage === "complete" ? "/client/dashboard" : "/client/onboarding";
}
