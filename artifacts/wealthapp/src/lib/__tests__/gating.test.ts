import { describe, expect, it } from "vitest";
import { resolveGatedView } from "../gating";

describe("resolveGatedView", () => {
  const loaded = { isLoading: false };

  it.each([
    ["full", false, "children"],
    ["limited", false, "children"],
    ["limited", true, "children_with_notice"],
    ["preview", false, "preview"],
    ["locked", false, "locked"],
    ["after_assign", false, "locked"],
  ] as const)("%s at cap=%s renders %s", (gate, atCap, view) => {
    expect(resolveGatedView(gate, atCap, loaded)).toBe(view);
  });

  it("renders nothing while entitlements load", () => {
    expect(resolveGatedView(null, false, { isLoading: true })).toBe("loading");
  });

  it("renders the screen when entitlements failed, leaving enforcement to the API", () => {
    expect(resolveGatedView(null, false, loaded)).toBe("children");
  });
});
