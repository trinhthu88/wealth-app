import { describe, expect, it } from "vitest";
import {
  ALL_SCENARIO_TYPES, TIER_LIMITS, checkAllowance, earliestBudgetMonth, earliestTrendDate,
  entitlementsFor, resolveTier, type Usage,
  ANNUAL_MONTHS_FREE, GRACE_DAYS, TRIAL_DAYS, TRIAL_ENDING_NOTICE_DAYS, isMembershipActive, membershipGraceUntil,
} from "@workspace/tier-policy";

const noUsage: Usage = { goals: 0, holdings: 0, solMessagesToday: 0 };

describe("resolveTier", () => {
  it.each([
    ["free_user", "track_b", false, "free"],
    ["free_user", "track_a", true, "free"],
    ["investment_client", "track_b", false, "track_b"],
    ["investment_client", null, false, "track_b"],
    // clientTrack is deprecated and unwritten: the inforce plan decides.
    ["investment_client", "track_a", false, "track_b"],
    ["investment_client", "track_b", true, "track_a"],
    ["investment_client", "track_a", true, "track_a"],
    ["advisor", null, false, "track_a"],
    ["super_admin", null, false, "track_a"],
    ["", null, false, "free"],
    ["unknown_role", "track_a", true, "free"],
  ] as const)("role %s, track %s, inforce %s resolves to %s", (role, track, inforce, tier) => {
    expect(resolveTier(role, track, inforce, "active", null)).toBe(tier);
  });

  const NOW = new Date("2026-06-15T12:00:00Z");
  const DAY = 86_400_000;
  const insideGrace = membershipGraceUntil(new Date(NOW.getTime() - 3 * DAY));
  const pastGrace = membershipGraceUntil(new Date(NOW.getTime() - 8 * DAY));
  const STATUSES = [
    ["none", null, false],
    ["trialing", null, true],
    ["active", null, true],
    ["past_due", insideGrace, true],
    ["past_due", pastGrace, false],
    ["past_due", null, false],
    ["canceled", insideGrace, false],
    [null, null, false],
  ] as const;

  describe.each(STATUSES)("membership %s, grace until %s", (status, grace, active) => {
    it.each([null, "track_a", "track_b"])("clientTrack %s never changes the answer", (track) => {
      expect(resolveTier("investment_client", track, false, status, grace, NOW)).toBe(active ? "track_b" : "free");
      expect(resolveTier("investment_client", track, true, status, grace, NOW)).toBe(active ? "track_a" : "free");
    });
    it("a free user stays free, whatever the membership says", () => {
      expect(resolveTier("free_user", null, false, status, grace, NOW)).toBe("free");
      expect(resolveTier("free_user", null, true, status, grace, NOW)).toBe("free");
    });
    it("staff keep track_a, whatever the membership says", () => {
      expect(resolveTier("advisor", null, false, status, grace, NOW)).toBe("track_a");
      expect(resolveTier("super_admin", null, false, status, grace, NOW)).toBe("track_a");
    });
    it("an unknown role is free", () => {
      expect(resolveTier("unknown", null, true, status, grace, NOW)).toBe("free");
    });
  });

  it("canceled runs to the paid-through date, with no grace on top", () => {
    const until = (days: number) => membershipGraceUntil(new Date(NOW.getTime() + days * DAY));
    expect(resolveTier("investment_client", null, false, "canceled", until(3), NOW)).toBe("track_b");
    expect(resolveTier("investment_client", null, true, "canceled", until(3), NOW)).toBe("track_a");
    expect(resolveTier("investment_client", null, false, "canceled", until(-1), NOW)).toBe("free");
    expect(resolveTier("investment_client", null, false, "canceled", null, NOW)).toBe("free");
    // Where past_due would still be in its grace window, canceled is over.
    expect(isMembershipActive("past_due", until(-1), NOW)).toBe(true);
    expect(isMembershipActive("canceled", until(-1), NOW)).toBe(false);
  });

  it("past_due holds until exactly currentPeriodEnd + 7 days", () => {
    const end = new Date(NOW.getTime() - GRACE_DAYS * DAY);
    const grace = membershipGraceUntil(end);
    expect(isMembershipActive("past_due", grace, NOW)).toBe(true);
    expect(isMembershipActive("past_due", grace, new Date(NOW.getTime() + 1))).toBe(false);
  });

  it("holds the product owner's final values", () => {
    expect({ TRIAL_DAYS, GRACE_DAYS, ANNUAL_MONTHS_FREE, TRIAL_ENDING_NOTICE_DAYS })
      .toEqual({ TRIAL_DAYS: 7, GRACE_DAYS: 7, ANNUAL_MONTHS_FREE: 2, TRIAL_ENDING_NOTICE_DAYS: 2 });
  });
});

describe("TIER_LIMITS", () => {
  it("holds the numbers from the entitlement matrix", () => {
    expect(TIER_LIMITS.free).toMatchObject({
      goals: 1, holdings: 5, budgetMonths: 3, trendMonths: 3, solPerDay: 10,
      coastPoint: "preview", advisedPlans: "preview", messages: "after_assign", documents: "after_assign", plan: "locked",
    });
    expect(TIER_LIMITS.free.scenarioTypes).toEqual(["increase_monthly"]);
    expect(TIER_LIMITS.track_b).toMatchObject({
      goals: Infinity, holdings: Infinity, budgetMonths: 12, trendMonths: 24, solPerDay: 100,
      coastPoint: "full", advisedPlans: "preview", messages: "after_assign", documents: "after_assign", plan: "after_assign",
    });
    expect(TIER_LIMITS.track_b.scenarioTypes).toEqual(ALL_SCENARIO_TYPES);
    expect(TIER_LIMITS.track_a).toEqual({ ...TIER_LIMITS.track_b, advisedPlans: "full", messages: "full", documents: "full", plan: "full" });
  });
});

describe("checkAllowance", () => {
  it.each([
    ["goals", { goals: 0 }, true],
    ["goals", { goals: 1 }, false],
    ["goals", { goals: 2 }, false],
    ["holdings", { holdings: 4 }, true],
    ["holdings", { holdings: 5 }, false],
    ["holdings", { holdings: 6 }, false],
    ["sol", { solMessagesToday: 9 }, true],
    ["sol", { solMessagesToday: 10 }, false],
  ] as const)("free %s at %o: allowed=%s", (capability, usage, allowed) => {
    expect(checkAllowance("free", capability, { ...noUsage, ...usage }, null).allowed).toBe(allowed);
  });

  it("names the checkpoint on a free user's refusal", () => {
    expect(checkAllowance("free", "goals", { ...noUsage, goals: 1 }, null))
      .toEqual({ allowed: false, gate: "limited", limit: 1, checkpoint: "C2_goal_slot" });
    expect(checkAllowance("free", "holdings", { ...noUsage, holdings: 5 }, null))
      .toEqual({ allowed: false, gate: "limited", limit: 5, checkpoint: "C5_investable" });
  });

  it("gives a client no goal or holding cap, and caps Sol at 100 without a checkpoint", () => {
    const heavy = { goals: 500, holdings: 500, solMessagesToday: 99 };
    expect(checkAllowance("track_b", "goals", heavy, null).allowed).toBe(true);
    expect(checkAllowance("track_b", "holdings", heavy, null).allowed).toBe(true);
    expect(checkAllowance("track_b", "sol", heavy, null).allowed).toBe(true);
    expect(checkAllowance("track_b", "sol", { ...heavy, solMessagesToday: 100 }, null))
      .toEqual({ allowed: false, gate: "full", limit: 100, checkpoint: null });
  });

  it("allows only the policy's scenario types", () => {
    expect(checkAllowance("free", "scenarios", noUsage, null, { scenarioType: "increase_monthly" }).allowed).toBe(true);
    expect(checkAllowance("free", "scenarios", noUsage, null, { scenarioType: "add_lump_sum" }).allowed).toBe(false);
    for (const scenarioType of ALL_SCENARIO_TYPES) {
      expect(checkAllowance("track_b", "scenarios", noUsage, null, { scenarioType }).allowed).toBe(true);
    }
    expect(checkAllowance("track_b", "scenarios", noUsage, null, { scenarioType: "invented" }).allowed).toBe(false);
  });

  it.each([
    [null, false], ["unassigned", false], ["cold", false], ["churned", false], ["active", true], ["client", true],
  ])("free after_assign gate at lead status %s: allowed=%s", (status, allowed) => {
    expect(checkAllowance("free", "messages", noUsage, status).allowed).toBe(allowed);
    expect(checkAllowance("free", "documents", noUsage, status).allowed).toBe(allowed);
  });

  it("locks the plan for free regardless of lead status, and previews the coast point", () => {
    expect(checkAllowance("free", "plan", noUsage, "active")).toMatchObject({ allowed: false, gate: "locked" });
    expect(checkAllowance("track_b", "plan", noUsage, "client")).toEqual({ allowed: true, gate: "full" });
    // A self-serve member has limits lifted, but the plan waits for an advisor.
    expect(checkAllowance("track_b", "plan", noUsage, "unassigned")).toMatchObject({ allowed: false, gate: "after_assign", checkpoint: null });
    expect(checkAllowance("free", "coastPoint", noUsage, null)).toEqual({ allowed: true, gate: "preview" });
    expect(checkAllowance("track_b", "coastPoint", noUsage, null)).toEqual({ allowed: true, gate: "full" });
  });
});

describe("entitlementsFor", () => {
  it("serialises unlimited as null so it survives JSON", () => {
    const parsed = JSON.parse(JSON.stringify(entitlementsFor("track_b", noUsage, null, null)));
    expect(parsed.limits.goals).toBeNull();
    expect(parsed.limits.holdings).toBeNull();
    expect(parsed.atCap).toEqual({ goals: false, holdings: false, sol: false });
  });

  it("reports the cap as reached", () => {
    const e = entitlementsFor("free", { goals: 1, holdings: 5, solMessagesToday: 10 }, null, null);
    expect(e.atCap).toEqual({ goals: true, holdings: true, sol: true });
  });
});

describe("read windows", () => {
  const now = new Date("2026-03-15T12:00:00Z");
  it("gives free the current month plus three earlier months", () => {
    expect(earliestBudgetMonth("free", now)).toBe("2025-12-01");
    expect(earliestBudgetMonth("track_b", now)).toBe("2025-03-01");
  });
  it("gives free a three-month trend and clients twenty-four", () => {
    expect(earliestTrendDate("free", now)).toBe("2025-12-15");
    expect(earliestTrendDate("track_a", now)).toBe("2024-03-15");
  });
});
