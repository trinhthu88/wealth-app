import { describe, expect, it } from "vitest";
import {
  CLIENT_PRIMARY_NAV,
  getClientNavigationState,
  resolveLegacyClientLocation,
} from "../clientNavigation";

describe("investment client navigation", () => {
  it.each([
    ["/client/portfolio", "/client/wealth/investments", "wealth", "investments"],
    ["/client/portfolio/holding/holding-123", "/client/wealth/investments/holding/holding-123", "wealth", "investments"],
    ["/client/portfolio/plan-456", "/client/wealth/investments/plan-456", "wealth", "investments"],
    ["/client/portfolio/plan-456/funds/fund-789", "/client/wealth/investments/plan-456/funds/fund-789", "wealth", "investments"],
    ["/client/networth", "/client/wealth/overview", "wealth", "overview"],
    ["/client/plan", "/client/goals/my-plan", "goals", "my-plan"],
    ["/client/pathway", "/client/goals/my-plan", "goals", "my-plan"],
    ["/client/goals", "/client/goals/goals", "goals", "goals"],
    ["/client/scenarios", "/client/goals/what-if", "goals", "what-if"],
    ["/client/messages", "/client/advisor/messages", "advisor", "messages"],
    ["/client/documents", "/client/advisor/documents", "advisor", "documents"],
    ["/client/budget", "/client/money", "home", null],
    ["/client/packages", "/client/wealth/investments", "wealth", "investments"],
    ["/client/transactions", "/client/wealth/investments", "wealth", "investments"],
    ["/client/packages/package-456", "/client/wealth/investments/packages/package-456", "wealth", "investments"],
  ] as const)("redirects %s to %s and selects its destination tab", (oldLocation, expected, primaryId, activeTabId) => {
    const redirected = resolveLegacyClientLocation(oldLocation);
    expect(redirected).toBe(expected);
    const state = getClientNavigationState(redirected ?? "");
    expect(state.primaryId).toBe(primaryId);
    expect(state.activeTabId).toBe(activeTabId);
  });

  it("preserves setup and scenario deep-link query parameters", () => {
    expect(resolveLegacyClientLocation("/client/goals?openLink=goal-123"))
      .toBe("/client/goals/goals?openLink=goal-123");
    expect(resolveLegacyClientLocation("/client/scenarios?goalId=goal-123&type=retire_earlier"))
      .toBe("/client/goals/what-if?goalId=goal-123&type=retire_earlier");
    expect(resolveLegacyClientLocation("/client/messages?about=investment"))
      .toBe("/client/advisor/messages?about=investment");
  });

  it("shows the four primary places (Sol sits between Portfolio and Goals in the shell)", () => {
    expect(CLIENT_PRIMARY_NAV.map(item => item.label)).toEqual([
      "Home", "Portfolio", "Goals", "Advisor",
    ]);
    expect(CLIENT_PRIMARY_NAV).toHaveLength(4);
  });

  it("opens Portfolio on investments and keeps the budget under Home", () => {
    expect(CLIENT_PRIMARY_NAV.find(item => item.id === "wealth")?.href).toBe("/client/wealth/investments");
    expect(getClientNavigationState("/client/money").primaryId).toBe("home");
  });

  it("provides the required linkable tabs for each grouped destination", () => {
    expect(getClientNavigationState("/client/wealth/overview").tabs?.map(tab => tab.label))
      .toEqual(["Investments", "Net worth", "Property & debts"]);
    expect(getClientNavigationState("/client/goals/goals").tabs?.map(tab => tab.label))
      .toEqual(["Goals", "My plan", "What-if"]);
    expect(getClientNavigationState("/client/advisor/messages").tabs?.map(tab => tab.label))
      .toEqual(["Messages", "Documents"]);
  });
});
