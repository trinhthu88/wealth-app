import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { annualSavingPct, formatStripeAmount } from "../formatPrice";

describe("formatStripeAmount", () => {
  it("reads Stripe's smallest unit in the price's own currency", () => {
    expect(formatStripeAmount(1250, "usd")).toBe("$12.50");
    expect(formatStripeAmount(1250, "sgd")).toBe("SGD 12.50".replace(" ", " "));
  });

  it("does not divide a zero-decimal currency by 100", () => {
    expect(formatStripeAmount(120000, "vnd")).toContain("120,000");
  });
});

describe("annualSavingPct", () => {
  it("is computed from the real amounts", () => {
    expect(annualSavingPct(1000, 10000)).toBe(17);
  });

  it("claims nothing when annual saves nothing", () => {
    expect(annualSavingPct(1000, 12000)).toBeNull();
    expect(annualSavingPct(1000, 15000)).toBeNull();
    expect(annualSavingPct(0, 100)).toBeNull();
  });
});

describe("the frontend", () => {
  it("has no hard-coded membership price", () => {
    const srcRoot = path.join(__dirname, "../..");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
      return /\.tsx?$/.test(name) ? [full] : [];
    });
    const offenders = walk(srcRoot).filter((file) => /\b4\.99\b|\b49\.90?\b/.test(readFileSync(file, "utf8")));
    expect(offenders.map((f) => path.relative(srcRoot, f))).toEqual([]);
  });
});
