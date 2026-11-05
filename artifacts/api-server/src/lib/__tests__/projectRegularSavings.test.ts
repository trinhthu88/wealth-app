import { describe, expect, it } from "vitest";
import { projectRegularSavings } from "@workspace/goal-math";

describe("projectRegularSavings", () => {
  it("projects monthly contributions at zero return", () => {
    expect(projectRegularSavings(500, 0, 10)).toBe(60_000);
    expect(projectRegularSavings(500, 0, 25)).toBe(150_000);
  });

  it("compounds contributions monthly at the supplied annual target return", () => {
    expect(projectRegularSavings(100, 12, 1)).toBe(1_268.25);
  });

  it("returns zero for zero contributions and rejects invalid inputs", () => {
    expect(projectRegularSavings(0, 6, 25)).toBe(0);
    expect(() => projectRegularSavings(-1, 6, 10)).toThrow(RangeError);
    expect(() => projectRegularSavings(100, -1200, 10)).toThrow(RangeError);
  });
});
