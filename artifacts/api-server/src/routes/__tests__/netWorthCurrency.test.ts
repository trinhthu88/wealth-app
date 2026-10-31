import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({ userId: req.headers["x-test-user-id"] ?? null }),
}));

const { default: app } = await import("../../app");
const { db, profilesTable, clientHoldingsTable, liabilitiesTable, netWorthSnapshotsTable } =
  await import("@workspace/db");
const { eq } = await import("drizzle-orm");

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clientId = `currency-networth-${RUN_ID}`;

function asUser(userId: string) {
  return { "x-test-user-id": userId };
}

beforeAll(async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ rates: { USD: 1, VND: 25_400, EUR: 0.92 } }),
  }) as unknown as Response));

  await db.insert(profilesTable).values({
    id: clientId,
    email: `${clientId}@test.local`,
    role: "investment_client",
  });
  await db.insert(clientHoldingsTable).values({
    userId: clientId,
    holdingType: "property",
    label: "VND property",
    currentEstimatedValue: "2540000",
    outstandingMortgage: "0",
    currency: "VND",
    isActive: true,
  });
  await db.insert(liabilitiesTable).values({
    userId: clientId,
    name: "EUR liability",
    category: "personal_loan",
    balanceUsd: "92",
    balanceOriginal: "92",
    currencyOriginal: "EUR",
  });
});

afterAll(async () => {
  await db.delete(netWorthSnapshotsTable).where(eq(netWorthSnapshotsTable.userId, clientId));
  await db.delete(clientHoldingsTable).where(eq(clientHoldingsTable.userId, clientId));
  await db.delete(liabilitiesTable).where(eq(liabilitiesTable.userId, clientId));
  await db.delete(profilesTable).where(eq(profilesTable.id, clientId));
  vi.unstubAllGlobals();
});

describe("server net-worth currency conversion", () => {
  it("converts a VND property and EUR liability to USD totals", async () => {
    const response = await request(app)
      .get("/api/client/networth/summary")
      .set(asUser(clientId))
      .expect(200);

    expect(response.body).toMatchObject({
      currency: "USD",
      totalAssets: 100,
      totalLiabilities: 100,
      netWorth: 0,
      portfolio: { selfManaged: 100, advised: 0, total: 100 },
    });
    expect(response.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "VND property", value: 100, currency: "USD" }),
      expect.objectContaining({ label: "EUR liability", value: 100, currency: "USD" }),
    ]));
  });
});
