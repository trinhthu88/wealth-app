import { describe, expect, it } from "vitest";
import {
  detectUnallocatedSources, detectOffTrackGoals, buildOverAllocationObservation, pickNextSuggestion,
  UNALLOCATED_SOURCE_MIN_USD, NEWLY_ADDED_WINDOW_DAYS,
} from "../solObservations";
import type { EnrichedGoal, GoalHoldingLink } from "@/hooks/useGoals";
import type { AdvisedPlan } from "@/hooks/useAdvisedPlans";
import type { ClientHolding } from "@/hooks/useClientHoldings";

function goal(overrides: Partial<EnrichedGoal>): EnrichedGoal {
  return {
    id: "goal-1", title: "House deposit", status: "active", trackStatus: "on_track",
    ...overrides,
  } as EnrichedGoal;
}

function holding(overrides: Partial<ClientHolding>): ClientHolding {
  const daysAgo = (overrides as any).__daysAgo ?? 100;
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "holding-1", isActive: true, holdingType: "stock_etf", currentValue: 1000,
    label: "Vanguard S&P 500", ticker: "VOO", createdAt,
    ...overrides,
  } as ClientHolding;
}

function plan(overrides: Partial<AdvisedPlan>): AdvisedPlan {
  const daysAgo = (overrides as any).__daysAgo ?? 100;
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "plan-1", status: "inforce", isVisibleToClient: true, latestAccountValue: "3000",
    nickname: "My plan", productName: "Endowment", createdAt,
    ...overrides,
  } as AdvisedPlan;
}

function link(overrides: Partial<GoalHoldingLink>): GoalHoldingLink {
  return { id: "link-1", goalId: "goal-1", sourceType: "self_holding", sourceId: "holding-1", allocationPct: "100", ...overrides } as GoalHoldingLink;
}

describe("detectUnallocatedSources", () => {
  it("returns nothing when there are no active goals to link toward", () => {
    const result = detectUnallocatedSources({ goals: [], holdings: [holding({})], plans: [], allLinks: [] });
    expect(result).toEqual([]);
  });

  it("flags a holding above the threshold with nothing linked", () => {
    const result = detectUnallocatedSources({
      goals: [goal({})], holdings: [holding({ currentValue: UNALLOCATED_SOURCE_MIN_USD + 1 })], plans: [], allLinks: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe("self_holding");
    expect(result[0].observation.type).toBe("unallocated_holding");
  });

  it("ignores a holding below the minimum value", () => {
    const result = detectUnallocatedSources({
      goals: [goal({})], holdings: [holding({ currentValue: UNALLOCATED_SOURCE_MIN_USD - 1 })], plans: [], allLinks: [],
    });
    expect(result).toHaveLength(0);
  });

  it("ignores a holding that already has any link, even a partial one", () => {
    const result = detectUnallocatedSources({
      goals: [goal({})], holdings: [holding({ id: "h1", currentValue: 1000 })], plans: [],
      allLinks: [link({ sourceId: "h1", allocationPct: "30" })],
    });
    expect(result).toHaveLength(0);
  });

  it("ignores an inactive holding or one of a non-investable type", () => {
    const result = detectUnallocatedSources({
      goals: [goal({})],
      holdings: [holding({ id: "h1", isActive: false }), holding({ id: "h2", holdingType: "cash_flow_other" })],
      plans: [], allLinks: [],
    });
    expect(result).toHaveLength(0);
  });

  it("classifies a source created within the window as newly_added, not unallocated", () => {
    const result = detectUnallocatedSources({
      goals: [goal({})],
      holdings: [holding({ currentValue: 1000, createdAt: new Date().toISOString() })],
      plans: [], allLinks: [],
    });
    expect(result[0].isNew).toBe(true);
    expect(result[0].observation.type).toBe("newly_added_holding");
  });

  it("classifies a source older than the window as unallocated, not newly_added", () => {
    const old = new Date(Date.now() - (NEWLY_ADDED_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    const result = detectUnallocatedSources({
      goals: [goal({})], holdings: [holding({ currentValue: 1000, createdAt: old })], plans: [], allLinks: [],
    });
    expect(result[0].isNew).toBe(false);
    expect(result[0].observation.type).toBe("unallocated_holding");
  });

  it("skips advised plans that aren't in-force and visible to the client", () => {
    const result = detectUnallocatedSources({
      goals: [goal({})], holdings: [], allLinks: [],
      plans: [plan({ status: "draft" }), plan({ id: "p2", isVisibleToClient: false })],
    });
    expect(result).toHaveLength(0);
  });
});

describe("detectOffTrackGoals", () => {
  it("flags only active goals currently off pace", () => {
    const result = detectOffTrackGoals([
      goal({ id: "g1", trackStatus: "off_track" }),
      goal({ id: "g2", trackStatus: "on_track" }),
      goal({ id: "g3", trackStatus: "off_track", status: "completed" }),
    ]);
    expect(result).toHaveLength(1);
    expect((result[0] as any).goalTitle).toBe(goal({}).title);
  });
});

describe("pickNextSuggestion", () => {
  it("advances to the next-ranked source once the top one is dismissed", () => {
    const sources = detectUnallocatedSources({
      goals: [goal({})],
      holdings: [
        holding({ id: "h1", currentValue: 5000, ticker: "AAA" }),
        holding({ id: "h2", currentValue: 1000, ticker: "BBB" }),
      ],
      plans: [], allLinks: [],
    });
    expect(pickNextSuggestion(sources, () => false)?.sourceId).toBe("h1");
    expect(pickNextSuggestion(sources, (_t, id) => id === "h1")?.sourceId).toBe("h2");
  });

  it("returns null once every candidate has been dismissed, instead of stalling on the first one", () => {
    const sources = detectUnallocatedSources({
      goals: [goal({})],
      holdings: [holding({ id: "h1", currentValue: 1000 })],
      plans: [], allLinks: [],
    });
    expect(pickNextSuggestion(sources, () => true)).toBeNull();
  });
});

describe("buildOverAllocationObservation", () => {
  it("names the other goals already holding this source, excluding the one being edited", () => {
    const goals = [goal({ id: "g1", title: "House deposit" }), goal({ id: "g2", title: "Retirement" })];
    const allLinks = [
      link({ goalId: "g1", sourceId: "h1", allocationPct: "60" }),
      link({ goalId: "g2", sourceId: "h1", allocationPct: "40" }),
    ];
    const obs = buildOverAllocationObservation(
      { goals, allLinks },
      { sourceType: "self_holding", sourceId: "h1", holdingLabel: "Cash savings", remainingPct: 0, excludeGoalId: "g2" },
    );
    expect(obs).toMatchObject({ type: "over_allocation_blocked", otherGoalNames: ["House deposit"] });
  });
});
