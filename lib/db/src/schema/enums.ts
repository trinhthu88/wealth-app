import { z } from "zod/v4";

export const roleValues = ["free_user", "investment_client", "advisor", "super_admin"] as const;
export const roleSchema = z.enum(roleValues);

export const goalLifecycleValues = ["active", "completed", "cancelled"] as const;
export const goalLifecycleSchema = z.enum(goalLifecycleValues);

export const advisedPlanStatusValues = ["scenario", "inforce", "matured", "surrender"] as const;
export const advisedPlanStatusSchema = z.enum(advisedPlanStatusValues);

export const leadStatusValues = ["unassigned", "active", "cold", "churned", "client"] as const;
export const leadStatusSchema = z.enum(leadStatusValues);

export const clientStatusValues = ["active", "paused", "churned"] as const;
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

export const healthScoreTierValues = ["free", "client"] as const;
export const healthScoreTierSchema = z.enum(healthScoreTierValues);
