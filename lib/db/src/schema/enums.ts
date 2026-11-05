import { z } from "zod/v4";

export const roleValues = ["free_user", "investment_client", "advisor", "super_admin"] as const;
export const roleSchema = z.enum(roleValues);

export const goalLifecycleValues = ["active", "completed", "cancelled", "draft"] as const;
export const goalLifecycleSchema = z.enum(goalLifecycleValues);

export const advisedPlanStatusValues = ["scenario", "inforce", "matured", "surrender"] as const;
export const advisedPlanStatusSchema = z.enum(advisedPlanStatusValues);

export const leadStatusValues = ["unassigned", "active", "cold", "churned", "client"] as const;
export const leadStatusSchema = z.enum(leadStatusValues);

export const clientStatusValues = ["pending_payment", "active", "paused", "churned"] as const;
export const clientStatusSchema = z.enum(clientStatusValues);

export const onboardingStageValues = ["not_started", "profile", "complete"] as const;
export const onboardingStageSchema = z.enum(onboardingStageValues);

export const firstFocusValues = [
  "know_my_money",
  "start_investing",
  "save_for_big",
  "organise_existing",
  "plan_retirement",
] as const;
export const firstFocusSchema = z.enum(firstFocusValues);

export const riskProfileValues = ["conservative", "balanced", "growth"] as const;
export const riskProfileSchema = z.enum(riskProfileValues);
export type RiskProfile = (typeof riskProfileValues)[number];

// Legacy labels (free-tier quiz, older advisor/admin selects) mapped onto the
// one stored vocabulary. Returns null for anything that is not a risk profile.
const legacyRiskProfileMap: Record<string, RiskProfile> = { moderate: "balanced", aggressive: "growth", "growth-oriented": "growth" };
export function normalizeRiskProfile(value: unknown): RiskProfile | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  const parsed = riskProfileSchema.safeParse(key);
  if (parsed.success) return parsed.data;
  return legacyRiskProfileMap[key] ?? null;
}

export const riskProfileSourceValues = ["self", "advisor"] as const;
export const riskProfileSourceSchema = z.enum(riskProfileSourceValues);

export const healthScoreTierValues = ["free", "client"] as const;
export const healthScoreTierSchema = z.enum(healthScoreTierValues);
