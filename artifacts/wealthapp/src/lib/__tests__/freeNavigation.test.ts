import { describe, expect, it } from "vitest";
import { FREE_PRIMARY_NAV, getFreeNavigationState } from "../freeNavigation";

describe("free plan navigation", () => {
  it("has the five primary places with Sol between Wealth and Goals", () => {
    expect(FREE_PRIMARY_NAV.map(item => item.label)).toEqual([
      "Home",
      "Budget",
      "Wealth",
      "Goals",
      "Advisor",
    ]);
    expect(FREE_PRIMARY_NAV.map(item => item.id)).toEqual([
      "home",
      "budget",
      "wealth",
      "goals",
      "advisor",
    ]);
  });

  it("selects the active wealth and goals tab from the URL", () => {
    expect(getFreeNavigationState("/free/portfolio").activeTabId).toBe("portfolio");
    expect(getFreeNavigationState("/free/pathway").activeTabId).toBe("pathway");
    expect(getFreeNavigationState("/free/milestones").activeTabId).toBe("milestones");
  });
});
