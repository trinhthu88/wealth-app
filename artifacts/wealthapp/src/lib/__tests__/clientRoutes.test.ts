import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_SCREEN_ROLES } from "../clientRoutes";

describe("client route allow-list", () => {
  it("lets free users, clients and super admins in, and keeps advisors out", () => {
    expect(CLIENT_SCREEN_ROLES).toEqual(["free_user", "investment_client", "super_admin"]);
    expect(CLIENT_SCREEN_ROLES).not.toContain("advisor");
  });

  it("guards every /client screen in App.tsx, so a new route can't skip it", () => {
    const app = readFileSync(path.join(__dirname, "../../App.tsx"), "utf8");
    const screens = app.split("\n").filter((line) => /path="\/client\//.test(line) && line.includes("ProtectedRoute"));
    expect(screens.length).toBeGreaterThan(15);
    for (const line of screens) expect(line).toContain("role={CLIENT_SCREEN_ROLES}");
  });

  it("has no inline route components, which would remount the page on every re-render", () => {
    const app = readFileSync(path.join(__dirname, "../../App.tsx"), "utf8");
    expect(app).not.toMatch(/component=\{\s*\(/);
  });
});
