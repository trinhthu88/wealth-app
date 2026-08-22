import { describe, expect, it } from "vitest";
import { generateSolCopy, isProgressMovementNoteworthy } from "../sol";

describe("generateSolCopy — unallocated_holding", () => {
  it("names the single goal it could count toward", () => {
    const msg = generateSolCopy({
      type: "unallocated_holding", holdingLabel: "Vanguard S&P 500", amountUsd: 12000,
      goalNames: ["House deposit"],
    });
    expect(msg.body).toContain("Vanguard S&P 500");
    expect(msg.body).toContain("$12,000");
    expect(msg.body).toContain("House deposit");
    expect(msg.body).not.toMatch(/move|sell|buy/i);
    // Must not read as Sol deciding the whole holding belongs to this goal —
    // partial linking is always on the table, and the copy should say so.
    expect(msg.body).toMatch(/some or all/i);
  });

  it("lists multiple goals with an 'or'", () => {
    const msg = generateSolCopy({
      type: "unallocated_holding", holdingLabel: "Cash savings", amountUsd: 5000,
      goalNames: ["House deposit", "Retirement"],
    });
    expect(msg.body).toContain("House deposit or Retirement");
  });
});

describe("generateSolCopy — newly_added_holding", () => {
  it("frames it as a fresh addition", () => {
    const msg = generateSolCopy({
      type: "newly_added_holding", holdingLabel: "BTC", amountUsd: 2000, daysAgo: 1,
      goalNames: ["Retirement"],
    });
    expect(msg.body).toMatch(/just added/i);
    expect(msg.body).toMatch(/some or all/i);
  });
});

describe("generateSolCopy — over_allocation_blocked", () => {
  it("explains the split and offers the remaining %, never a raw error string", () => {
    const msg = generateSolCopy({
      type: "over_allocation_blocked", holdingLabel: "Cash savings", remainingPct: 40,
      otherGoalNames: ["House deposit"],
    });
    expect(msg.body).toContain("60%");
    expect(msg.body).toContain("House deposit");
    expect(msg.body).toContain("40%");
    expect(msg.actionLabel).toBe("Link 40%");
  });

  it("handles the fully-allocated (0% remaining) case distinctly", () => {
    const msg = generateSolCopy({
      type: "over_allocation_blocked", holdingLabel: "Cash savings", remainingPct: 0,
      otherGoalNames: ["House deposit", "Retirement"],
    });
    expect(msg.body).toMatch(/fully allocated/i);
    expect(msg.actionLabel).toBeUndefined();
  });
});

describe("generateSolCopy — progress_movement", () => {
  const oneWeekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const sixWeeksAgo = new Date(Date.now() - 42 * 86_400_000).toISOString().slice(0, 10);

  it("attributes the move to whichever driver is largest", () => {
    const msg = generateSolCopy({
      type: "progress_movement", goalTitle: "Retirement", deltaTotal: 500,
      marketDelta: 500, contributionDelta: 0, reallocationDelta: 0,
      fromDate: oneWeekAgo, toDate: today,
    });
    expect(msg.body).toMatch(/market movement/i);
    expect(msg.body).toContain("$500");
  });

  it("credits a new link over market movement when it's the bigger driver", () => {
    const msg = generateSolCopy({
      type: "progress_movement", goalTitle: "Retirement", deltaTotal: 1000,
      marketDelta: 50, contributionDelta: 950, reallocationDelta: 0,
      fromDate: oneWeekAgo, toDate: today,
    });
    expect(msg.body).toMatch(/new investment you linked/i);
  });

  it("describes a drop with 'dropped' not 'grew'", () => {
    const msg = generateSolCopy({
      type: "progress_movement", goalTitle: "Retirement", deltaTotal: -300,
      marketDelta: -300, contributionDelta: 0, reallocationDelta: 0,
      fromDate: oneWeekAgo, toDate: today,
    });
    expect(msg.body).toMatch(/dropped/i);
  });

  it("never says 'recently' regardless of the actual gap — it names the span", () => {
    const msg = generateSolCopy({
      type: "progress_movement", goalTitle: "Retirement", deltaTotal: 500,
      marketDelta: 500, contributionDelta: 0, reallocationDelta: 0,
      fromDate: oneWeekAgo, toDate: today,
    });
    expect(msg.body).not.toMatch(/recently/i);
  });

  it("names a short gap in days, not as if it were a single recent moment", () => {
    const msg = generateSolCopy({
      type: "progress_movement", goalTitle: "Retirement", deltaTotal: 500,
      marketDelta: 500, contributionDelta: 0, reallocationDelta: 0,
      fromDate: oneWeekAgo, toDate: today,
    });
    expect(msg.body).toMatch(/past 7 days/);
  });

  it("names a multi-week gap in weeks, not understating a long unwatched span", () => {
    const msg = generateSolCopy({
      type: "progress_movement", goalTitle: "Retirement", deltaTotal: 500,
      marketDelta: 500, contributionDelta: 0, reallocationDelta: 0,
      fromDate: sixWeeksAgo, toDate: today,
    });
    expect(msg.body).toMatch(/past 6 weeks/);
  });
});

describe("generateSolCopy — off_track", () => {
  it("never states a directive action, only offers the scenario tool", () => {
    const msg = generateSolCopy({ type: "off_track", goalTitle: "House deposit" });
    expect(msg.body).not.toMatch(/you should|move \$/i);
    expect(msg.actionLabel).toBe("Run a scenario");
  });
});

describe("generateSolCopy — coast_point_acceleration", () => {
  it("names the real dollar amount and both real dates, never a directive", () => {
    const msg = generateSolCopy({
      type: "coast_point_acceleration", goalTitle: "Retirement",
      extraMonthly: 300, currentCoastDate: "2038-04", newCoastDate: "2034-11",
    });
    expect(msg.body).toContain("$300");
    expect(msg.body).toContain("April 2038");
    expect(msg.body).toContain("November 2034");
    expect(msg.body).not.toMatch(/you should|move \$/i);
    expect(msg.actionLabel).toBe("Model it");
  });

  it("names the timeline gap in words when a coast date isn't reached, never a null/undefined date", () => {
    const msg = generateSolCopy({
      type: "coast_point_acceleration", goalTitle: "Retirement",
      extraMonthly: 200, currentCoastDate: null, newCoastDate: "2040-01",
    });
    expect(msg.body).not.toMatch(/null|undefined|NaN/);
    expect(msg.body).toContain("January 2040");
  });
});

describe("isProgressMovementNoteworthy", () => {
  it("is false for negligible moves", () => {
    expect(isProgressMovementNoteworthy({ deltaTotal: 5 })).toBe(false);
  });

  it("is true once the move clears the threshold", () => {
    expect(isProgressMovementNoteworthy({ deltaTotal: 25 })).toBe(true);
    expect(isProgressMovementNoteworthy({ deltaTotal: -30 })).toBe(true);
  });
});
