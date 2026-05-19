import {
  pgTable, text, numeric, timestamp, uuid, boolean, integer, date, jsonb, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fundsTable = pgTable("funds", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ticker: text("ticker"),
  isin: text("isin"),
  assetClass: text("asset_class").notNull(),
  geography: text("geography"),
  currency: text("currency").notNull().default("USD"),
  fundManager: text("fund_manager"),
  fundType: text("fund_type"),
  expenseRatio: numeric("expense_ratio"),
  benchmarkIndex: text("benchmark_index"),
  factsheetUrl: text("factsheet_url"),
  priceApiSymbol: text("price_api_symbol"),
  priceApiExchange: text("price_api_exchange"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fundPricesTable = pgTable("fund_prices", {
  id: uuid("id").primaryKey().defaultRandom(),
  fundId: uuid("fund_id").notNull().references(() => fundsTable.id),
  priceDate: date("price_date").notNull(),
  priceNative: numeric("price_native").notNull(),
  priceUsd: numeric("price_usd").notNull(),
  priceVnd: numeric("price_vnd"),
  change1d: numeric("change_1d"),
  change1dPercent: numeric("change_1d_percent"),
  source: text("source").notNull().default("api"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.fundId, t.priceDate)]);

export const clientFinancialSnapshotsTable = pgTable("client_financial_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  monthlyIncome: numeric("monthly_income"),
  savingsRange: text("savings_range"),
  hasInvestments: boolean("has_investments").notNull().default(false),
  investmentsRoughValue: numeric("investments_rough_value"),
  hasDebts: boolean("has_debts").notNull().default(false),
  debtsRoughValue: numeric("debts_rough_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const clientPackagesTable = pgTable("client_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  advisorId: text("advisor_id"),
  goalId: uuid("goal_id"),
  nickname: text("nickname").notNull(),
  status: text("status").notNull().default("pending_setup"),
  type: text("type").notNull(),
  monthlyAmount: numeric("monthly_amount"),
  lumpSumAmount: numeric("lump_sum_amount"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  currency: text("currency").notNull().default("USD"),
  expectedAnnualReturn: numeric("expected_annual_return").notNull().default("7.0"),
  advisorNotes: text("advisor_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const packageAllocationsTable = pgTable("package_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientPackageId: uuid("client_package_id").notNull().references(() => clientPackagesTable.id, { onDelete: "cascade" }),
  fundId: uuid("fund_id").notNull().references(() => fundsTable.id),
  weightPercent: numeric("weight_percent").notNull(),
  unitsHeld: numeric("units_held").notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  setBy: text("set_by"),
  effectiveFrom: date("effective_from"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const packageTransactionsTable = pgTable("package_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientPackageId: uuid("client_package_id").notNull().references(() => clientPackagesTable.id),
  userId: text("user_id").notNull(),
  fundId: uuid("fund_id").references(() => fundsTable.id),
  transactionDate: date("transaction_date").notNull(),
  transactionType: text("transaction_type").notNull(),
  amountUsd: numeric("amount_usd").notNull(),
  units: numeric("units"),
  pricePerUnitUsd: numeric("price_per_unit_usd"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const portfolioSnapshotsTable = pgTable("portfolio_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientPackageId: uuid("client_package_id").notNull().references(() => clientPackagesTable.id),
  userId: text("user_id").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  totalInvestedUsd: numeric("total_invested_usd").notNull(),
  totalValueUsd: numeric("total_value_usd").notNull(),
  totalReturnPercent: numeric("total_return_percent"),
  fundBreakdown: jsonb("fund_breakdown"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.clientPackageId, t.snapshotDate)]);

export const scenariosTable = pgTable("scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  scenarioType: text("scenario_type").notNull(),
  linkedGoalId: uuid("linked_goal_id"),
  linkedPackageId: uuid("linked_package_id").references(() => clientPackagesTable.id),
  inputData: jsonb("input_data").notNull(),
  outputData: jsonb("output_data").notNull(),
  isAdvisorPushed: boolean("is_advisor_pushed").notNull().default(false),
  advisorNote: text("advisor_note"),
  status: text("status").notNull().default("viewed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFundSchema = createInsertSchema(fundsTable).omit({ id: true, createdAt: true });
export const insertFundPriceSchema = createInsertSchema(fundPricesTable).omit({ id: true, createdAt: true });
export const insertClientFinancialSnapshotSchema = createInsertSchema(clientFinancialSnapshotsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientPackageSchema = createInsertSchema(clientPackagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPackageAllocationSchema = createInsertSchema(packageAllocationsTable).omit({ id: true, createdAt: true });
export const insertPackageTransactionSchema = createInsertSchema(packageTransactionsTable).omit({ id: true, createdAt: true });
export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshotsTable).omit({ id: true, createdAt: true });
export const insertScenarioSchema = createInsertSchema(scenariosTable).omit({ id: true, createdAt: true });

export type Fund = typeof fundsTable.$inferSelect;
export type FundPrice = typeof fundPricesTable.$inferSelect;
export type ClientFinancialSnapshot = typeof clientFinancialSnapshotsTable.$inferSelect;
export type ClientPackage = typeof clientPackagesTable.$inferSelect;
export type PackageAllocation = typeof packageAllocationsTable.$inferSelect;
export type PackageTransaction = typeof packageTransactionsTable.$inferSelect;
export type PortfolioSnapshot = typeof portfolioSnapshotsTable.$inferSelect;
export type Scenario = typeof scenariosTable.$inferSelect;
