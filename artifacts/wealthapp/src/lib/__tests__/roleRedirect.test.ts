import { describe, expect, it } from "vitest";
import { resolveRoleRedirectPath } from "../roleRedirect";

describe("resolveRoleRedirectPath", () => {
  it("sends an investment_client with incomplete onboarding to /client/onboarding", () => {
    expect(resolveRoleRedirectPath("investment_client", false)).toBe("/client/onboarding");
  });

  it("sends an investment_client with completed onboarding to /client/dashboard", () => {
    expect(resolveRoleRedirectPath("investment_client", true)).toBe("/client/dashboard");
  });

  it("sends a super_admin to /admin/dashboard regardless of onboarding flag", () => {
    expect(resolveRoleRedirectPath("super_admin", false)).toBe("/admin/dashboard");
  });

  it("sends an advisor to /advisor/dashboard regardless of onboarding flag", () => {
    expect(resolveRoleRedirectPath("advisor", false)).toBe("/advisor/dashboard");
  });

  it("sends a free_user to /free/dashboard", () => {
    expect(resolveRoleRedirectPath("free_user", false)).toBe("/free/dashboard");
  });
});
