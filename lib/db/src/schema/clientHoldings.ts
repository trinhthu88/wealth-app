import {
  pgTable, text, numeric, timestamp, uuid, date, boolean, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const clientHoldingsTable = pgTable("client_holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),

  holdingType: text("holding_type").notNull(),
  label: text("label").notNull(),
  currency: text("currency").notNull().default("USD"),
  purchaseDate: date("purchase_date"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),

  // Client's own expected-return override, used for projections instead of the
  // asset-class benchmark when set. Nullable — most holdings rely on the benchmark.
  expectedAnnualReturnPct: numeric("expected_annual_return_pct"),

  // stock_etf + crypto
  ticker: text("ticker"),
  brokerPlatform: text("broker_platform"),
  unitsHeld: numeric("units_held"),
  averageCostPrice: numeric("average_cost_price"),

  // crypto
  coinSymbol: text("coin_symbol"),
  exchangeName: text("exchange_name"),

  // property
  propertyAddress: text("property_address"),
  // Property benchmark is a single USD-denominated global figure for now (see
  // asset_class_benchmarks.global_property) — country is stored but not yet used
  // to select a localized benchmark. Not inferred from propertyAddress.
  country: text("country"),
  purchasePrice: numeric("purchase_price"),
  currentEstimatedValue: numeric("current_estimated_value"),
  outstandingMortgage: numeric("outstanding_mortgage").default("0"),
  monthlyRentalIncome: numeric("monthly_rental_income").default("0"),

  // cash
  bankName: text("bank_name"),
  accountType: text("account_type"),
  currentBalance: numeric("current_balance"),
  interestRatePct: numeric("interest_rate_pct"),

  // pension
  schemeName: text("scheme_name"),
  pensionCountry: text("pension_country"),
  currentBalancePension: numeric("current_balance_pension"),
  monthlyContribution: numeric("monthly_contribution").default("0"),
  employerContribution: numeric("employer_contribution").default("0"),

  // other
  currentValueOther: numeric("current_value_other"),
  totalInvestedOther: numeric("total_invested_other"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Money-in/money-out ledger for a self-tracked holding. `source` distinguishes
// client-entered rows ("manual") from rows written by the budget save flow
// ("budget_contribution" — a client-attributed monthly contribution,
// "surplus_sweep" — unattributed monthly surplus auto-routed to a cash
// holding). The (holdingId, sourceMonth, source) uniqueness is what lets the
// budget save flow upsert idempotently instead of appending a new row every
// time a month is re-saved.
export const clientHoldingTransactionsTable = pgTable("client_holding_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  holdingId: uuid("holding_id").notNull().references(() => clientHoldingsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),

  type: text("type").notNull(), // "in" | "out"
  amount: numeric("amount").notNull(), // always positive; direction carried by `type`
  source: text("source").notNull(), // "manual" | "budget_contribution" | "surplus_sweep"
  sourceMonth: date("source_month"),
  description: text("description"),
  transactionDate: date("transaction_date").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.holdingId, t.sourceMonth, t.source)]);

export const priceCacheTable = pgTable("price_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  symbol: text("symbol").notNull(),
  symbolType: text("symbol_type").notNull(),
  priceUsd: numeric("price_usd").notNull(),
  change1dPct: numeric("change_1d_pct").default("0"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.symbol, t.symbolType)]);

// Admin-managed expected-return benchmarks, one row per asset class. USD-denominated
// global figures for now — no per-country variants (see country comment above).
export const assetClassBenchmarksTable = pgTable("asset_class_benchmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetClass: text("asset_class").notNull().unique(),
  label: text("label").notNull(),
  tenYearCagrPct: numeric("ten_year_cagr_pct").notNull(),
  source: text("source"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Admin-managed "if brought under management" target return per advised plan/package
// type (rsp / lump_sum / combination) — used by the self-tracked-holding "bring under
// management" comparison. Distinct axis from asset_class_benchmarks (plan type vs.
// asset class), so kept as its own table rather than forced into that one.
export const advisedStrategyReturnsTable = pgTable("advised_strategy_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  planType: text("plan_type").notNull().unique(),
  label: text("label").notNull(),
  targetAnnualReturnPct: numeric("target_annual_return_pct").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientHoldingSchema = createInsertSchema(clientHoldingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientHoldingTransactionSchema = createInsertSchema(clientHoldingTransactionsTable).omit({ id: true, createdAt: true });
export const insertPriceCacheSchema = createInsertSchema(priceCacheTable).omit({ id: true });
export const insertAssetClassBenchmarkSchema = createInsertSchema(assetClassBenchmarksTable).omit({ id: true, updatedAt: true });
export const insertAdvisedStrategyReturnSchema = createInsertSchema(advisedStrategyReturnsTable).omit({ id: true, updatedAt: true });

export type ClientHolding = typeof clientHoldingsTable.$inferSelect;
export type InsertClientHolding = z.infer<typeof insertClientHoldingSchema>;
export type ClientHoldingTransaction = typeof clientHoldingTransactionsTable.$inferSelect;
export type InsertClientHoldingTransaction = z.infer<typeof insertClientHoldingTransactionSchema>;
export type PriceCache = typeof priceCacheTable.$inferSelect;
export type InsertPriceCache = z.infer<typeof insertPriceCacheSchema>;
export type AssetClassBenchmark = typeof assetClassBenchmarksTable.$inferSelect;
export type InsertAssetClassBenchmark = z.infer<typeof insertAssetClassBenchmarkSchema>;
export type AdvisedStrategyReturn = typeof advisedStrategyReturnsTable.$inferSelect;
export type InsertAdvisedStrategyReturn = z.infer<typeof insertAdvisedStrategyReturnSchema>;
