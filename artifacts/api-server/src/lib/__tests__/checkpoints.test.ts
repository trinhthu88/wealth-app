import { describe, expect, it } from "vitest";
import { decide, evaluate, isSuppressed, type CheckpointContext, type ExistingCheckpoint } from "@workspace/checkpoints";

const NOW = new Date("2026-06-15T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function ctx(overrides: Partial<CheckpointContext> = {}): CheckpointContext {
  return {
    tier: "free", onboardingComplete: false, signedUpAt: daysAgo(10), hasInforcePlan: false,
    goals: [], holdings: [], budgetMonths: [], scores: [], engagement: null,
    existingCheckpoints: [], leadStatus: null, leadUpdatedAt: null, membership: null, now: NOW,
    ...overrides,
  };
}
const codes = (c: CheckpointContext) => evaluate(c).map((x) => x.code);
const fired = (code: string, at: Partial<ExistingCheckpoint> = {}): ExistingCheckpoint => ({
  id: `id-${code}`, code, firedAt: daysAgo(100), dismissedAt: null, acceptedAt: null, ...at,
});
const months = (...pairs: [number, number][]) => pairs.map(([netSurplus, totalIncome], i) => ({
  month: `2026-0${6 - i}-01`, netSurplus, totalIncome,
}));
const holding = (valueUsd: number, deviationPp: number | null = null) => ({ id: "h1", label: "VWRA", valueUsd, deviationPp });
const goal = (snapshotStatuses: string[], extra = {}) => ({
  id: "g1", title: "House", goalType: "house", status: "active", hasTargetAndDate: true,
  snapshotStatuses, gapUsd: 5000, monthsRemaining: 24, ...extra,
});

describe("C4 surplus: at least 15% of income in 2 of the last 3 months", () => {
  it("fires exactly at 15% in two months", () => {
    expect(codes(ctx({ budgetMonths: months([150, 1000], [150, 1000], [0, 1000]) }))).toContain("C4_surplus");
  });
  it("does not fire just under 15%", () => {
    expect(codes(ctx({ budgetMonths: months([149, 1000], [150, 1000], [0, 1000]) }))).not.toContain("C4_surplus");
  });
  it("needs two qualifying months", () => {
    expect(codes(ctx({ budgetMonths: months([500, 1000]) }))).not.toContain("C4_surplus");
  });
  it("ignores months older than the last three", () => {
    const budgetMonths = months([0, 1000], [0, 1000], [0, 1000], [500, 1000], [500, 1000]);
    expect(codes(ctx({ budgetMonths }))).not.toContain("C4_surplus");
  });
  it("does not count a month with no income", () => {
    expect(codes(ctx({ budgetMonths: months([0, 0], [0, 0], [0, 0]) }))).not.toContain("C4_surplus");
  });
  it("records the surplus in the snapshot", () => {
    const [c] = evaluate(ctx({ budgetMonths: months([300, 1000], [200, 1000]), hasInforcePlan: true }));
    expect(c.snapshot).toMatchObject({ monthlySurplus: 300, savingsRatePct: 30 });
  });
});

describe("C5 investable: 25,000 USD, or -2 points against benchmark", () => {
  it("fires at exactly 25,000", () => {
    expect(codes(ctx({ holdings: [holding(25_000)] }))).toContain("C5_investable");
  });
  it("does not fire at 24,999", () => {
    expect(codes(ctx({ holdings: [holding(24_999)] }))).not.toContain("C5_investable");
  });
  it("sums the holdings", () => {
    expect(codes(ctx({ holdings: [holding(15_000), holding(10_000)] }))).toContain("C5_investable");
  });
  it("fires at exactly -2 points", () => {
    expect(codes(ctx({ holdings: [holding(100, -2)] }))).toContain("C5_investable");
  });
  it("does not fire at -1.9 points, or above benchmark", () => {
    expect(codes(ctx({ holdings: [holding(100, -1.9)] }))).not.toContain("C5_investable");
    expect(codes(ctx({ holdings: [holding(100, 3)] }))).not.toContain("C5_investable");
  });
  it("does not fire for a client, who gets C9 for the deviation instead", () => {
    const c = codes(ctx({ tier: "track_b", holdings: [holding(30_000, -3)] }));
    expect(c).not.toContain("C5_investable");
    expect(c).toContain("C9_under_management");
  });
});

describe("C3 off track: on the two latest snapshots", () => {
  it("fires on two off_track snapshots", () => {
    const [c] = evaluate(ctx({ goals: [goal(["off_track", "off_track"])] }));
    expect(c).toMatchObject({ code: "C3_off_track", snapshot: { goalId: "g1", gapUsd: 5000, monthsRemaining: 24 } });
  });
  it.each([
    [["off_track"]],
    [["off_track", "at_risk"]],
    [["on_track", "off_track"]],
    [[]],
  ])("does not fire on %j", (statuses) => {
    expect(codes(ctx({ goals: [goal(statuses)] }))).not.toContain("C3_off_track");
  });
  it("ignores a goal that is no longer active", () => {
    expect(codes(ctx({ goals: [goal(["off_track", "off_track"], { status: "completed" })] }))).not.toContain("C3_off_track");
  });
});

describe("C1 score ready: soft, once", () => {
  const scores = [{ overallScore: 60, scoreDate: "2026-06-01", weakest: "savings" }];
  it("fires with onboarding complete and a first score", () => {
    const [c] = evaluate(ctx({ onboardingComplete: true, scores }));
    expect(c).toMatchObject({ code: "C1_score_ready", snapshot: { weakest: "savings" } });
  });
  it("does not fire before onboarding is complete, or without a score", () => {
    expect(codes(ctx({ scores }))).not.toContain("C1_score_ready");
    expect(codes(ctx({ onboardingComplete: true }))).not.toContain("C1_score_ready");
  });
  it("never fires again, however long ago it was dismissed", () => {
    const existingCheckpoints = [fired("C1_score_ready", { dismissedAt: daysAgo(400) })];
    expect(codes(ctx({ onboardingComplete: true, scores, existingCheckpoints }))).not.toContain("C1_score_ready");
  });
  it("does not fire for a client", () => {
    expect(codes(ctx({ tier: "track_b", onboardingComplete: true, scores }))).not.toContain("C1_score_ready");
  });
});

describe("C6 engaged", () => {
  const score = (overallScore: number) => [{ overallScore, scoreDate: "2026-06-01", weakest: null }];
  it("fires at a four-week streak and a score of 70", () => {
    const [c] = evaluate(ctx({ scores: score(70), engagement: { streakWeeks: 4 } }));
    expect(c).toMatchObject({ code: "C6_engaged", snapshot: { variant: "engaged_high" } });
  });
  it("does not fire at three weeks or a score of 69", () => {
    expect(codes(ctx({ scores: score(70), engagement: { streakWeeks: 3 } }))).not.toContain("C6_engaged");
    expect(codes(ctx({ scores: score(69), engagement: { streakWeeks: 4 } }))).not.toContain("C6_engaged");
  });
  it("fires at 90 days with a score under 50", () => {
    const [c] = evaluate(ctx({ scores: score(49), signedUpAt: daysAgo(90) }));
    expect(c).toMatchObject({ code: "C6_engaged", snapshot: { variant: "engaged_low" } });
  });
  it("does not fire at 89 days or a score of 50", () => {
    expect(codes(ctx({ scores: score(49), signedUpAt: daysAgo(89) }))).not.toContain("C6_engaged");
    expect(codes(ctx({ scores: score(50), signedUpAt: daysAgo(90) }))).not.toContain("C6_engaged");
  });
  it("does not fire without a score", () => {
    expect(codes(ctx({ signedUpAt: daysAgo(200), engagement: { streakWeeks: 9 } }))).not.toContain("C6_engaged");
  });
});

describe("C8, C9 and C10, from the design's catalogue", () => {
  it("C8 fires on a positive latest surplus with no inforce plan", () => {
    expect(codes(ctx({ budgetMonths: months([1, 1000]) }))).toContain("C8_plan_preview");
    expect(codes(ctx({ budgetMonths: months([0, 1000]) }))).not.toContain("C8_plan_preview");
    expect(codes(ctx({ budgetMonths: months([1, 1000]), hasInforcePlan: true }))).not.toContain("C8_plan_preview");
  });
  it("C10 fires for a free user with a complete retirement goal", () => {
    const retire = goal([], { goalType: "retire" });
    expect(codes(ctx({ goals: [retire] }))).toContain("C10_coast_point");
    expect(codes(ctx({ goals: [{ ...retire, hasTargetAndDate: false }] }))).not.toContain("C10_coast_point");
    expect(codes(ctx({ goals: [goal([])] }))).not.toContain("C10_coast_point");
    expect(codes(ctx({ tier: "track_b", goals: [retire] }))).not.toContain("C10_coast_point");
  });
  it("fires nothing for Track A", () => {
    expect(codes(ctx({ tier: "track_a", budgetMonths: months([500, 1000], [500, 1000]), holdings: [holding(99_000, -5)] }))).toEqual([]);
  });
});

describe("priority", () => {
  const order = ["C2_goal_slot", "C5_investable", "C3_off_track", "C4_surplus", "C6_engaged", "C1_score_ready", "C7_direct"] as const;
  it.each(order.slice(0, -1).map((code, i) => [code, order[i + 1]]))("%s beats %s", (high, low) => {
    const { fire } = decide([{ code: low as any, snapshot: {} }, { code: high as any, snapshot: {} }], []);
    expect(fire?.code).toBe(high);
  });
  it("fires nothing with no candidates", () => {
    expect(decide([], [])).toEqual({ fire: null, supersede: null });
  });
});

describe("at most one open", () => {
  it("does not fire a lower or equal priority candidate over an open one", () => {
    const existing = [fired("C5_investable")];
    expect(decide([{ code: "C4_surplus", snapshot: {} }], existing)).toEqual({ fire: null, supersede: null });
  });
  it("a higher priority candidate supersedes the open one", () => {
    const existing = [fired("C1_score_ready")];
    const { fire, supersede } = decide([{ code: "C2_goal_slot", snapshot: {} }], existing);
    expect(fire?.code).toBe("C2_goal_slot");
    expect(supersede?.code).toBe("C1_score_ready");
  });
  it("ignores resolved rows", () => {
    const existing = [fired("C2_goal_slot", { dismissedAt: daysAgo(1) }), fired("C5_investable", { acceptedAt: daysAgo(1) })];
    expect(decide([{ code: "C4_surplus", snapshot: {} }], existing).fire?.code).toBe("C4_surplus");
  });
});

describe("cool-down and lead rules", () => {
  const rules = (existingCheckpoints: ExistingCheckpoint[], leadStatus: string | null = null, leadUpdatedAt: Date | null = null) =>
    ({ existingCheckpoints, leadStatus, leadUpdatedAt, now: NOW });

  it("a code does not re-fire 29 days after dismissal, and may at 30", () => {
    expect(isSuppressed("C4_surplus", rules([fired("C4_surplus", { dismissedAt: daysAgo(29) })]))).toBe(true);
    expect(isSuppressed("C4_surplus", rules([fired("C4_surplus", { dismissedAt: daysAgo(30) })]))).toBe(false);
  });
  it("uses the latest dismissal", () => {
    const history = [fired("C4_surplus", { dismissedAt: daysAgo(200) }), fired("C4_surplus", { dismissedAt: daysAgo(5) })];
    expect(isSuppressed("C4_surplus", rules(history))).toBe(true);
  });
  it("a dismissal of another code does not count", () => {
    expect(isSuppressed("C4_surplus", rules([fired("C5_investable", { dismissedAt: daysAgo(1) })]))).toBe(false);
  });
  it("does not re-fire the code already open", () => {
    expect(isSuppressed("C4_surplus", rules([fired("C4_surplus")]))).toBe(true);
  });
  it.each(["unassigned", "active"])("nothing fires while the lead is %s", (status) => {
    expect(isSuppressed("C2_goal_slot", rules([], status, daysAgo(400)))).toBe(true);
    expect(codes(ctx({ leadStatus: status, holdings: [holding(99_000)], budgetMonths: months([500, 1000], [500, 1000]) }))).toEqual([]);
  });
  it.each(["cold", "churned"])("a %s lead re-arms after 90 days", (status) => {
    expect(isSuppressed("C4_surplus", rules([], status, daysAgo(89)))).toBe(true);
    expect(isSuppressed("C4_surplus", rules([], status, daysAgo(90)))).toBe(false);
  });
  it("a client's lead status does not suppress", () => {
    expect(isSuppressed("C4_surplus", rules([], "client", daysAgo(1)))).toBe(false);
  });
});

describe("membership checkpoints", () => {
  const trial = (days: number, cancelAtPeriodEnd = false) => ({
    membership: { status: "trialing", trialEndsAt: new Date(NOW.getTime() + days * 86_400_000), cancelAtPeriodEnd },
  });
  const codes = (c: CheckpointContext) => evaluate(c).map((x) => x.code);

  it("C11 fires two days before the trial's end, not three", () => {
    expect(codes(ctx({ tier: "track_b", ...trial(3) }))).not.toContain("C11_trial_ending");
    expect(codes(ctx({ tier: "track_b", ...trial(2) }))).toContain("C11_trial_ending");
    expect(codes(ctx({ tier: "track_b", ...trial(-1) }))).not.toContain("C11_trial_ending");
  });

  it("C11 reaches Track A, the one thing that fires there", () => {
    expect(codes(ctx({ tier: "track_a", ...trial(1) }))).toEqual(["C11_trial_ending"]);
    expect(codes(ctx({ tier: "track_a" }))).toEqual([]);
  });

  it("C11 skips a member who has already chosen to cancel", () => {
    expect(codes(ctx({ tier: "track_b", ...trial(1, true) }))).not.toContain("C11_trial_ending");
  });

  it("the lead rules don't silence C11 and C12, but do silence the rest", () => {
    const base = { existingCheckpoints: [], leadStatus: "unassigned", leadUpdatedAt: null, now: NOW };
    expect(isSuppressed("C11_trial_ending", base)).toBe(false);
    expect(isSuppressed("C12_lapsed", base)).toBe(false);
    expect(isSuppressed("C2_goal_slot", base)).toBe(true);
  });

  it("C12 cools down for 30 days after it is dismissed", () => {
    const history = (ago: number): ExistingCheckpoint[] => [{ id: "1", code: "C12_lapsed", firedAt: daysAgo(ago + 1), dismissedAt: daysAgo(ago), acceptedAt: null }];
    const rest = { leadStatus: null, leadUpdatedAt: null, now: NOW };
    expect(isSuppressed("C12_lapsed", { ...rest, existingCheckpoints: history(29) })).toBe(true);
    expect(isSuppressed("C12_lapsed", { ...rest, existingCheckpoints: history(31) })).toBe(false);
  });

  it("a membership checkpoint replaces an open conversion prompt, and not the other way round", () => {
    const open = (code: string): ExistingCheckpoint[] => [{ id: "1", code, firedAt: daysAgo(1), dismissedAt: null, acceptedAt: null }];
    expect(decide([{ code: "C11_trial_ending", snapshot: {} }], open("C4_surplus")).fire?.code).toBe("C11_trial_ending");
    expect(decide([{ code: "C2_goal_slot", snapshot: {} }], open("C12_lapsed")).fire).toBeNull();
  });
});
