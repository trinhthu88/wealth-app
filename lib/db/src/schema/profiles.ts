import { pgTable, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull().default("free_user"),
  avatarUrl: text("avatar_url"),
  preferredCurrency: text("preferred_currency").notNull().default("USD"),
  countryCode: text("country_code"),
  isExpat: boolean("is_expat").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  riskProfile: text("risk_profile"),
  totalSavings: numeric("total_savings").notNull().default("0"),
  totalInvestments: numeric("total_investments").notNull().default("0"),
  savingsRatePercent: numeric("savings_rate_percent").notNull().default("4.0"),
  investmentRatePercent: numeric("investment_rate_percent").notNull().default("7.0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ createdAt: true, updatedAt: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
