import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db, profilesTable, assetsTable, liabilitiesTable, clientHoldingsTable,
} from "@workspace/db";
import { getNetWorthSnapshotUserIds } from "@workspace/net-worth";

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const assetUser = `snapshot-asset-${RUN_ID}`;
const liabilityUser = `snapshot-liability-${RUN_ID}`;
const holdingUser = `snapshot-holding-${RUN_ID}`;
const investmentClient = `snapshot-client-${RUN_ID}`;
const emptyFreeUser = `snapshot-empty-${RUN_ID}`;
const testUsers = [assetUser, liabilityUser, holdingUser, investmentClient, emptyFreeUser];

beforeAll(async () => {
  await db.insert(profilesTable).values(testUsers.map((id) => ({
    id,
    email: `${id}@test.local`,
    role: id === investmentClient ? "investment_client" as const : "free_user" as const,
  })));
  await db.insert(assetsTable).values({
    userId: assetUser, name: "Test asset", category: "other_asset", valueUsd: "100",
  });
  await db.insert(liabilitiesTable).values({
    userId: liabilityUser, name: "Test liability", category: "personal_loan", balanceUsd: "25",
  });
  await db.insert(clientHoldingsTable).values({
    userId: holdingUser, holdingType: "cash", label: "Test holding", currentBalance: "50",
  });
});

afterAll(async () => {
  await db.delete(assetsTable).where(inArray(assetsTable.userId, testUsers));
  await db.delete(liabilitiesTable).where(inArray(liabilitiesTable.userId, testUsers));
  await db.delete(clientHoldingsTable).where(inArray(clientHoldingsTable.userId, testUsers));
  await db.delete(profilesTable).where(inArray(profilesTable.id, testUsers));
});

describe("net-worth snapshot user selection", () => {
  it("includes free users with any wealth data and investment clients without wealth rows", async () => {
    const selected = await getNetWorthSnapshotUserIds();
    expect(selected).toEqual(expect.arrayContaining([
      assetUser, liabilityUser, holdingUser, investmentClient,
    ]));
    expect(selected).not.toContain(emptyFreeUser);
    expect(selected.filter((userId) => testUsers.includes(userId))).toHaveLength(4);
  });
});
