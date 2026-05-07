import { pgTable, text, numeric, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const netWorthSnapshotsTable = pgTable("net_worth_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  totalAssetsUsd: numeric("total_assets_usd").notNull().default("0"),
  totalLiabilitiesUsd: numeric("total_liabilities_usd").notNull().default("0"),
  netWorthUsd: numeric("net_worth_usd").notNull().default("0"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assetsTable = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  valueUsd: numeric("value_usd").notNull(),
  currencyOriginal: text("currency_original").notNull().default("USD"),
  valueOriginal: numeric("value_original"),
  asOfDate: date("as_of_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const liabilitiesTable = pgTable("liabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  balanceUsd: numeric("balance_usd").notNull(),
  interestRatePercent: numeric("interest_rate_percent"),
  monthlyPaymentUsd: numeric("monthly_payment_usd"),
  currencyOriginal: text("currency_original").notNull().default("USD"),
  balanceOriginal: numeric("balance_original"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNetWorthSnapshotSchema = createInsertSchema(netWorthSnapshotsTable).omit({ id: true, createdAt: true });
export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLiabilitySchema = createInsertSchema(liabilitiesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertNetWorthSnapshot = z.infer<typeof insertNetWorthSnapshotSchema>;
export type NetWorthSnapshot = typeof netWorthSnapshotsTable.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
export type InsertLiability = z.infer<typeof insertLiabilitySchema>;
export type Liability = typeof liabilitiesTable.$inferSelect;
