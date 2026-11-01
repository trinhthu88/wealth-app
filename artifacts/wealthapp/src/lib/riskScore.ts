export type SelfAssessedRiskProfile = "conservative" | "balanced" | "growth";

export function riskProfileFromScore(score: number): SelfAssessedRiskProfile {
  if (score <= 3) return "conservative";
  if (score <= 7) return "balanced";
  return "growth";
}
