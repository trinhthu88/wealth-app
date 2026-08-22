import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

// status: unassigned (default — anonymous quiz-capture, or not yet reviewed by a
// super admin) → active (assigned to an advisor, relationship in progress) →
// cold | churned | client. Pre-redesign values (new/contacted/qualified/lost/
// converted) are remapped by scripts/src/migrate-leads-status.ts — see that
// script for the exact mapping and its audit log.
//
// source is free text; values in active use include the anonymous quiz funnel
// plus the authenticated-CTA sources added for the lead pipeline redesign:
// "goal_scenario_cta" (GoalScenarioCTA.tsx) and "smart_upgrade_card"
// (SmartUpgradeCard.tsx).
export const leadsTable = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  source: text("source"),
  quizResult: text("quiz_result"),
  healthScore: integer("health_score"),
  status: text("status").notNull().default("unassigned"),
  assignedAdvisorId: text("assigned_advisor_id"),
  notes: text("notes"),
  // Set for an already-authenticated lead (a free_user or investment_client who
  // clicked an interest CTA) — nullable so the anonymous quiz-capture path stays
  // a separate, lower-stakes top-of-funnel source: an anonymous quiz-taker is a
  // lead with userId = null until/unless they create an account and get linked.
  userId: text("user_id").references(() => profilesTable.id),
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
