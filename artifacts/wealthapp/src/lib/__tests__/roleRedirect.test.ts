import { describe, expect, it } from "vitest";
import { resolveRoleRedirectPath } from "../roleRedirect";

describe("resolveRoleRedirectPath", () => {
  it("sends an investment_client with incomplete onboarding to /client/onboarding", () => {
    expect(resolveRoleRedirectPath("investment_client", "not_started")).toBe("/client/onboarding");
    expect(resolveRoleRedirectPath("investment_client", "profile")).toBe("/client/onboarding");
  });

  it("sends an investment_client with completed onboarding to /client/dashboard", () => {
    expect(resolveRoleRedirectPath("investment_client", "complete")).toBe("/client/dashboard");
  });

  it("sends a super_admin to /admin/dashboard regardless of onboarding flag", () => {
    expect(resolveRoleRedirectPath("super_admin", "not_started")).toBe("/admin/dashboard");
  });

  it("sends an advisor to /advisor/dashboard regardless of onboarding flag", () => {
    expect(resolveRoleRedirectPath("advisor", "not_started")).toBe("/advisor/dashboard");
  });

  it("sends a free_user to the client screens, onboarding first", () => {
    expect(resolveRoleRedirectPath("free_user", "not_started")).toBe("/client/onboarding");
    expect(resolveRoleRedirectPath("free_user", "profile")).toBe("/client/onboarding");
    expect(resolveRoleRedirectPath("free_user", "complete")).toBe("/client/dashboard");
  });
});

describe("resolveRoleRedirectPath with a pending membership", () => {
  it("sends a promoted client to activation, whatever their onboarding stage", () => {
    expect(resolveRoleRedirectPath("investment_client", "complete", true)).toBe("/client/activate");
    expect(resolveRoleRedirectPath("investment_client", "not_started", true)).toBe("/client/activate");
  });
  it("leaves everyone else where they were", () => {
    expect(resolveRoleRedirectPath("investment_client", "complete", false)).toBe("/client/dashboard");
    expect(resolveRoleRedirectPath("advisor", "complete", false)).toBe("/advisor/dashboard");
  });
});
