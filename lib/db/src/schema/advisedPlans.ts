import {
  pgTable, text, numeric, timestamp, uuid, date, boolean, integer, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const advisedPlansTable = pgTable("advised_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  advisorId: text("advisor_id").references(() => profilesTable.id),

  providerName: text("provider_name").notNull(),
  productCode: text("product_code"),
  productName: text("product_name").notNull(),
  policyNumber: text("policy_number"),
  introducerCode: text("introducer_code"),

  planType: text("plan_type").notNull().default("rsp"),
  currency: text("currency").notNull().default("USD"),
  termYears: integer("term_years"),
  annualPremium: numeric("annual_premium").notNull().default("0"),
  initialPremium: numeric("initial_premium").notNull().default("0"),
  effectiveDate: date("effective_date"),
  maturityDate: date("maturity_date"),
  // scenario (default — an advisor is modeling this for a lead, not a real
  // holding yet) | inforce (requires a non-null policyNumber — enforced
  // app-level where status is set to inforce, not a DB constraint) | matured |
  // surrender.
  status: text("status").notNull().default("scenario"),

  latestAccountValue: numeric("latest_account_value").notNull().default("0"),
  latestNetContribution: numeric("latest_net_contribution").notNull().default("0"),
  latestStatementDate: date("latest_statement_date"),

  nickname: text("nickname"),
  advisorNotes: text("advisor_notes"),
  isVisibleToClient: boolean("is_visible_to_client").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const advisedPlanStatementsTable = pgTable("advised_plan_statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  advisedPlanId: uuid("advised_plan_id").notNull().references(() => advisedPlansTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),

  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  statementDate: date("statement_date"),

  openingValue: numeric("opening_value").notNull().default("0"),
  closingValue: numeric("closing_value").notNull().default("0"),
  contributions: numeric("contributions").notNull().default("0"),
  extraAllocations: numeric("extra_allocations").notNull().default("0"),
  investmentReturns: numeric("investment_returns").notNull().default("0"),
  policyFee: numeric("policy_fee").notNull().default("0"),
  assetManagementFee: numeric("asset_management_fee").notNull().default("0"),
  adminCharges: numeric("admin_charges").notNull().default("0"),
  advisoryServicesFee: numeric("advisory_services_fee").notNull().default("0"),
  bidOfferSpread: numeric("bid_offer_spread").notNull().default("0"),
  surrenders: numeric("surrenders").notNull().default("0"),
  surrenderCharges: numeric("surrender_charges").notNull().default("0"),

  enteredBy: text("entered_by").references(() => profilesTable.id),
  entryMode: text("entry_mode").notNull().default("summary"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.advisedPlanId, t.periodStart, t.periodEnd)]);

export const advisedPlanHoldingsTable = pgTable("advised_plan_holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  statementId: uuid("statement_id").notNull().references(() => advisedPlanStatementsTable.id, { onDelete: "cascade" }),
  advisedPlanId: uuid("advised_plan_id").notNull().references(() => advisedPlansTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),

  fundCode: text("fund_code").notNull(),
  fundName: text("fund_name").notNull(),

  unitValueDate: date("unit_value_date"),
  unitValue: numeric("unit_value"),
  unitsHeld: numeric("units_held"),
  holdingValue: numeric("holding_value"),
  pendingTransactions: numeric("pending_transactions").notNull().default("0"),
  finalValue: numeric("final_value"),
  futureAllocationPct: numeric("future_allocation_pct").notNull().default("0"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const advisedPlanTransactionsTable = pgTable("advised_plan_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  statementId: uuid("statement_id").notNull().references(() => advisedPlanStatementsTable.id, { onDelete: "cascade" }),
  advisedPlanId: uuid("advised_plan_id").notNull().references(() => advisedPlansTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),

  fundCode: text("fund_code").notNull(),
  fundName: text("fund_name"),
  transactionDate: date("transaction_date").notNull(),
  description: text("description").notNull(),
  netAmount: numeric("net_amount").notNull(),
  unitValue: numeric("unit_value"),
  unitsThisTransaction: numeric("units_this_transaction"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdvisedPlanSchema = createInsertSchema(advisedPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdvisedPlanStatementSchema = createInsertSchema(advisedPlanStatementsTable).omit({ id: true, createdAt: true });
export const insertAdvisedPlanHoldingSchema = createInsertSchema(advisedPlanHoldingsTable).omit({ id: true, createdAt: true });
export const insertAdvisedPlanTransactionSchema = createInsertSchema(advisedPlanTransactionsTable).omit({ id: true, createdAt: true });

export type AdvisedPlan = typeof advisedPlansTable.$inferSelect;
export type InsertAdvisedPlan = z.infer<typeof insertAdvisedPlanSchema>;
export type AdvisedPlanStatement = typeof advisedPlanStatementsTable.$inferSelect;
export type InsertAdvisedPlanStatement = z.infer<typeof insertAdvisedPlanStatementSchema>;
export type AdvisedPlanHolding = typeof advisedPlanHoldingsTable.$inferSelect;
export type InsertAdvisedPlanHolding = z.infer<typeof insertAdvisedPlanHoldingSchema>;
export type AdvisedPlanTransaction = typeof advisedPlanTransactionsTable.$inferSelect;
export type InsertAdvisedPlanTransaction = z.infer<typeof insertAdvisedPlanTransactionSchema>;
