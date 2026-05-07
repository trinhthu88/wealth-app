import { pgTable, text, numeric, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfolioHoldingsTable = pgTable("portfolio_holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  assetName: text("asset_name").notNull(),
  assetClass: text("asset_class").notNull(),
  currentValueUsd: numeric("current_value_usd").notNull(),
  currencyOriginal: text("currency_original").notNull().default("USD"),
  valueOriginal: numeric("value_original"),
  weightPercent: numeric("weight_percent"),
  isAdvisorManaged: boolean("is_advisor_managed").notNull().default(false),
  tickerSymbol: text("ticker_symbol"),
  notes: text("notes"),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldingsTable).omit({ id: true, createdAt: true });
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;
export type PortfolioHolding = typeof portfolioHoldingsTable.$inferSelect;
