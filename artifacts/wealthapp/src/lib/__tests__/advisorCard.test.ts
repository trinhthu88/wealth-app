import { describe, expect, it } from "vitest";
import { acceptedCheckpointCopy, advisorCardState } from "../advisorCard";

describe("advisorCardState", () => {
  it.each([
    [null, false, "none"],
    ["unassigned", false, "matching"],
    ["active", true, "assigned"],
    ["active", false, "matching"],
    ["client", true, "client"],
    ["cold", false, "none"],
    ["cold", true, "none"],
    ["churned", false, "none"],
  ] as const)("free user with lead %s, advisor=%s shows %s", (status, hasAdvisor, state) => {
    expect(advisorCardState("free", status, hasAdvisor)).toBe(state);
  });

  it("shows clients their advisor regardless of any lead status", () => {
    expect(advisorCardState("track_b", null, true)).toBe("client");
    expect(advisorCardState("track_a", "churned", true)).toBe("client");
    expect(advisorCardState("track_b", null, false)).toBe("none");
  });
});

describe("acceptedCheckpointCopy", () => {
  it("names the checkpoint the user accepted", () => {
    expect(acceptedCheckpointCopy("C2_goal_slot")).toContain("more than one goal");
  });
  it("says nothing for a source that is not a checkpoint", () => {
    expect(acceptedCheckpointCopy("quiz")).toBeNull();
    expect(acceptedCheckpointCopy(null)).toBeNull();
  });
});
