import { pgTable, text, integer, timestamp, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientProfilesTable = pgTable("client_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  advisorId: text("advisor_id"),
  kycStatus: text("kyc_status").notNull().default("not_started"),
  riskProfile: text("risk_profile"),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  relationshipStartDate: date("relationship_start_date"),
  annualReviewDate: date("annual_review_date"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const kycDocumentsTable = pgTable("kyc_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  documentType: text("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const financialPlansTable = pgTable("financial_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull(),
  advisorId: text("advisor_id"),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  planData: text("plan_data"),
  nextReviewDate: date("next_review_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const planMilestonesTable = pgTable("plan_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull(),
  title: text("title").notNull(),
  targetDate: date("target_date"),
  status: text("status").notNull().default("upcoming"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientProfileSchema = createInsertSchema(clientProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKycDocumentSchema = createInsertSchema(kycDocumentsTable).omit({ id: true, uploadedAt: true });
export const insertFinancialPlanSchema = createInsertSchema(financialPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanMilestoneSchema = createInsertSchema(planMilestonesTable).omit({ id: true, createdAt: true });

export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;
export type ClientProfile = typeof clientProfilesTable.$inferSelect;
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type KycDocument = typeof kycDocumentsTable.$inferSelect;
export type InsertFinancialPlan = z.infer<typeof insertFinancialPlanSchema>;
export type FinancialPlan = typeof financialPlansTable.$inferSelect;
export type InsertPlanMilestone = z.infer<typeof insertPlanMilestoneSchema>;
export type PlanMilestone = typeof planMilestonesTable.$inferSelect;
