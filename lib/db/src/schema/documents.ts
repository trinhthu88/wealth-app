import { pgTable, text, bigint, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  uploadedBy: text("uploaded_by"),
  title: text("title").notNull(),
  category: text("category").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  isAdminUploaded: boolean("is_admin_uploaded").notNull().default(false),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, uploadedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
