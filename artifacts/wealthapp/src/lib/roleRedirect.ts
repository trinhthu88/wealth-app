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
): string {
  if (role === "super_admin") return "/admin/dashboard";
  if (role === "advisor") return "/advisor/dashboard";
  if (role === "investment_client") {
    return onboardingStage === "complete" ? "/client/dashboard" : "/client/onboarding";
  }
  return "/free/dashboard";
}
