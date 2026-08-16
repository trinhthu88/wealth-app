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

export const priceCacheTable = pgTable("price_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  symbol: text("symbol").notNull(),
  symbolType: text("symbol_type").notNull(),
  priceUsd: numeric("price_usd").notNull(),
  change1dPct: numeric("change_1d_pct").default("0"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.symbol, t.symbolType)]);

export const insertClientHoldingSchema = createInsertSchema(clientHoldingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPriceCacheSchema = createInsertSchema(priceCacheTable).omit({ id: true });

export type ClientHolding = typeof clientHoldingsTable.$inferSelect;
export type InsertClientHolding = z.infer<typeof insertClientHoldingSchema>;
export type PriceCache = typeof priceCacheTable.$inferSelect;
export type InsertPriceCache = z.infer<typeof insertPriceCacheSchema>;
