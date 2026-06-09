import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const medicationsTable = pgTable("medications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  frequency: text("frequency").notNull(),
  instructions: text("instructions"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  color: text("color").notNull().default("#06b6d4"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMedicationSchema = createInsertSchema(medicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medicationsTable.$inferSelect;
