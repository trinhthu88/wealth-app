/**
 * The single source of truth for every tier gate. The API guard (requireAllowance)
 * and GET /api/me/entitlements both read this file; the browser only renders what
 * the endpoint returns. Changing a number here changes it everywhere.
 */

export type Tier = "free" | "track_b" | "track_a";
export type Gate = "full" | "limited" | "preview" | "locked" | "after_assign";

export const ALL_SCENARIO_TYPES = [
  "increase_monthly",
  "add_lump_sum",
  "reduce_monthly",
  "pause_contributions",
  "market_drop",
  "retire_earlier",
] as const;
export type ScenarioType = (typeof ALL_SCENARIO_TYPES)[number];

const TRACK_B = {
  goals: Infinity,
  holdings: Infinity,
  budgetMonths: 12,
  trendMonths: 24,
  scenarioTypes: ALL_SCENARIO_TYPES as readonly string[],
  solPerDay: 100,
  coastPoint: "full" as Gate,
  advisedPlans: "preview" as Gate,
  messages: "full" as Gate,
  documents: "full" as Gate,
  plan: "full" as Gate,
};

export const TIER_LIMITS: Record<Tier, typeof TRACK_B> = {
  free: {
    goals: 1,
    holdings: 5,
    budgetMonths: 3,
    trendMonths: 3,
    scenarioTypes: ["increase_monthly"],
    solPerDay: 10,
    coastPoint: "preview",
    advisedPlans: "preview",
    messages: "after_assign",
    documents: "after_assign",
    plan: "locked",
  },
  track_b: TRACK_B,
  track_a: { ...TRACK_B, advisedPlans: "full" },
};

export const CHECKPOINT_CODES = [
  "C1_score_ready",
  "C2_goal_slot",
  "C3_off_track",
  "C4_surplus",
  "C5_investable",
  "C6_engaged",
  "C7_direct",
  "C8_plan_preview",
  "C9_under_management",
  "C10_coast_point",
] as const;
export type CheckpointCode = (typeof CHECKPOINT_CODES)[number];

export const CAPABILITIES = [
  "goals",
  "holdings",
  "scenarios",
  "sol",
  "coastPoint",
  "advisedPlans",
  "messages",
  "documents",
  "plan",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** The checkpoint a free user is offered when this capability stops them. */
const CAPABILITY_CHECKPOINT: Record<Capability, CheckpointCode> = {
  goals: "C2_goal_slot",
  holdings: "C5_investable",
  scenarios: "C3_off_track",
  sol: "C7_direct",
  coastPoint: "C10_coast_point",
  advisedPlans: "C8_plan_preview",
  messages: "C7_direct",
  documents: "C7_direct",
  plan: "C7_direct",
};

/** Lead statuses at which an advisor relationship exists, opening after_assign gates. */
const ASSIGNED_LEAD_STATUSES = ["active", "client"];

export interface Usage {
  goals: number;
  holdings: number;
  solMessagesToday: number;
}

export interface Checkpoint {
  id: string;
  code: CheckpointCode;
  firedAt: string;
  snapshot: unknown;
}

/** TIER_LIMITS for one tier as JSON-safe values: null means unlimited. */
export interface SerializedLimits extends Omit<typeof TRACK_B, "goals" | "holdings"> {
  goals: number | null;
  holdings: number | null;
}

export interface Entitlements {
  tier: Tier;
  limits: SerializedLimits;
  usage: Usage;
  gates: Record<Capability, Gate>;
  atCap: Record<"goals" | "holdings" | "sol", boolean>;
  leadStatus: string | null;
  openCheckpoint: Checkpoint | null;
}

export type AllowanceResult =
  | { allowed: true; gate: Gate }
  | { allowed: false; gate: Gate; limit: number | null; checkpoint: CheckpointCode | null };

/**
 * Tier is derived from the role and the user's plans, never stored.
 *
 * DECISION: clientTrack is accepted but does not decide the tier. The brief names
 * client_profiles.clientTrack as a source, but that column is deprecated and no
 * longer written (track is derived from advised plans, see lib/db/src/schema/clients.ts),
 * so requiring it would leave every newly advised client on track_b. An inforce
 * advised plan is the record the design says makes someone Track A.
 *
 * DECISION: advisors and super admins resolve to track_a so no cap applies to staff,
 * who share the /conversations and /documents routes with clients. An unknown role or
 * a missing profile resolves to free, the strictest tier.
 */
export function resolveTier(role: string, _clientTrack: string | null, hasInforcePlan: boolean): Tier {
  if (role === "advisor" || role === "super_admin") return "track_a";
  if (role === "investment_client") return hasInforcePlan ? "track_a" : "track_b";
  return "free";
}

function capLimit(tier: Tier, capability: Capability): number | null {
  const limits = TIER_LIMITS[tier];
  if (capability === "goals") return limits.goals;
  if (capability === "holdings") return limits.holdings;
  if (capability === "sol") return limits.solPerDay;
  return null;
}

function capUsage(usage: Usage, capability: Capability): number {
  if (capability === "goals") return usage.goals;
  if (capability === "holdings") return usage.holdings;
  if (capability === "sol") return usage.solMessagesToday;
  return 0;
}

function gateFor(tier: Tier, capability: Capability, leadStatus: string | null): Gate {
  const limits = TIER_LIMITS[tier];
  if (capability === "scenarios") return limits.scenarioTypes.length < ALL_SCENARIO_TYPES.length ? "limited" : "full";
  if (capability === "goals" || capability === "holdings" || capability === "sol") {
    return tier === "free" ? "limited" : "full";
  }
  const gate = limits[capability];
  if (gate === "after_assign" && leadStatus && ASSIGNED_LEAD_STATUSES.includes(leadStatus)) return "full";
  return gate;
}

/** Whether this tier may use this capability right now. Pure; the guard's only decision. */
export function checkAllowance(
  tier: Tier,
  capability: Capability,
  usage: Usage,
  leadStatus: string | null,
  options: { scenarioType?: string } = {},
): AllowanceResult {
  const gate = gateFor(tier, capability, leadStatus);
  const checkpoint = tier === "free" ? CAPABILITY_CHECKPOINT[capability] : null;

  if (gate === "locked" || gate === "after_assign") {
    return { allowed: false, gate, limit: null, checkpoint };
  }
  if (capability === "scenarios") {
    const allowedTypes = TIER_LIMITS[tier].scenarioTypes;
    return options.scenarioType !== undefined && !allowedTypes.includes(options.scenarioType)
      ? { allowed: false, gate, limit: allowedTypes.length, checkpoint }
      : { allowed: true, gate };
  }
  const limit = capLimit(tier, capability);
  if (limit !== null && capUsage(usage, capability) >= limit) {
    return { allowed: false, gate, limit, checkpoint };
  }
  return { allowed: true, gate };
}

/** Everything a screen needs to render its gates. Infinity becomes null to survive JSON. */
export function entitlementsFor(
  tier: Tier,
  usage: Usage,
  leadStatus: string | null,
  openCheckpoint: Checkpoint | null,
): Entitlements {
  const limits = TIER_LIMITS[tier];
  const finite = (n: number) => (Number.isFinite(n) ? n : null);
  const gates = Object.fromEntries(
    CAPABILITIES.map((capability) => [capability, gateFor(tier, capability, leadStatus)]),
  ) as Record<Capability, Gate>;
  return {
    tier,
    limits: { ...limits, goals: finite(limits.goals), holdings: finite(limits.holdings) },
    usage,
    gates,
    atCap: {
      goals: usage.goals >= limits.goals,
      holdings: usage.holdings >= limits.holdings,
      sol: usage.solMessagesToday >= limits.solPerDay,
    },
    leadStatus,
    openCheckpoint,
  };
}

/**
 * The oldest budget month (YYYY-MM-01) this tier may read.
 *
 * DECISION: the window is the current month plus budgetMonths earlier months, as the
 * design matrix says ("current + 3 months"), so free reads four months in total. Entry
 * is never gated; only reads are windowed.
 */
export function earliestBudgetMonth(tier: Tier, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - TIER_LIMITS[tier].budgetMonths, 1));
  return d.toISOString().slice(0, 10);
}

/** The oldest net worth snapshot date (YYYY-MM-DD) this tier may read. */
export function earliestTrendDate(tier: Tier, now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - TIER_LIMITS[tier].trendMonths, now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** The message shown when a gate stops someone. Calm and specific; see SOL_PERSONA.md. */
export function gateMessage(capability: Capability, limit: number | null): string {
  switch (capability) {
    case "goals":
      return `The free plan covers ${limit} active goal. An advisor can plan every goal with you.`;
    case "holdings":
      return `The free plan tracks ${limit} holdings. An advisor can look at your whole portfolio with you.`;
    case "scenarios":
      return "The free plan includes the increase monthly scenario. An advisor can model the others with you.";
    case "sol":
      return `You've used today's ${limit} messages with Sol. They reset tomorrow.`;
    case "coastPoint":
      return "Your coast point is something an advisor can walk through with you.";
    case "advisedPlans":
      return "Advised plans start with a conversation with an advisor.";
    case "messages":
    case "documents":
      return "This opens once an advisor is assigned to you.";
    case "plan":
      return "Your advisor builds this plan with you, so it opens once you have one.";
  }
}
