import {
  pgTable, text, numeric, timestamp, uuid, date, jsonb, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const clientBudgetMonthsTable = pgTable("client_budget_months", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  month: date("month").notNull(),
  currency: text("currency").notNull().default("USD"),

  primaryIncome: numeric("primary_income").notNull().default("0"),
  secondaryIncome: numeric("secondary_income").notNull().default("0"),
  rentalIncome: numeric("rental_income").notNull().default("0"),
  otherIncome: numeric("other_income").notNull().default("0"),

  housing: numeric("housing").notNull().default("0"),
  utilities: numeric("utilities").notNull().default("0"),
  transport: numeric("transport").notNull().default("0"),
  insurance: numeric("insurance").notNull().default("0"),

  foodDining: numeric("food_dining").notNull().default("0"),
  entertainment: numeric("entertainment").notNull().default("0"),
  shopping: numeric("shopping").notNull().default("0"),
  health: numeric("health").notNull().default("0"),
  education: numeric("education").notNull().default("0"),
  otherExpenses: numeric("other_expenses").notNull().default("0"),

  // Auto-synced from the sum of client_liabilities.monthly_payment_usd at
  // save time (see /client/budget) — not a user-entered category, so it has
  // no keypad row of its own on the budget page, just a read-only synced row.
  debtPayments: numeric("debt_payments").notNull().default("0"),

  investmentContributions: jsonb("investment_contributions").notNull().default([]),

  totalIncome: numeric("total_income").notNull().default("0"),
  totalExpenses: numeric("total_expenses").notNull().default("0"),
  totalInvestments: numeric("total_investments").notNull().default("0"),
  netSurplus: numeric("net_surplus").notNull().default("0"),
  savingsRatePct: numeric("savings_rate_pct").notNull().default("0"),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [unique().on(t.userId, t.month)]);

export const insertClientBudgetMonthSchema = createInsertSchema(clientBudgetMonthsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ClientBudgetMonth = typeof clientBudgetMonthsTable.$inferSelect;
export type InsertClientBudgetMonth = z.infer<typeof insertClientBudgetMonthSchema>;
