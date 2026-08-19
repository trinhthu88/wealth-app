import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const leadsTable = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  source: text("source"),
  quizResult: text("quiz_result"),
  healthScore: integer("health_score"),
  status: text("status").notNull().default("new"),
  assignedAdvisorId: text("assigned_advisor_id"),
  notes: text("notes"),
  // Set when this lead is converted into a real client account (POST
  // /leads/:id/convert) — the link that used to be missing entirely, so a
  // converted lead and its resulting client profile were two disconnected
  // records with no way to trace one back to the other.
  convertedUserId: text("converted_user_id").references(() => profilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
