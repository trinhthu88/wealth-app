import { describe, expect, it } from "vitest";
import { riskProfileFromScore } from "../riskScore";

describe("riskProfileFromScore", () => {
  it.each([
    [3, "conservative"],
    [4, "balanced"],
    [7, "balanced"],
    [8, "growth"],
  ] as const)("scores %i into %s at the band edges", (score, expected) => {
    expect(riskProfileFromScore(score)).toBe(expected);
  });
});
