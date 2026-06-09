import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const photosTable = pgTable("photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  caption: text("caption"),
  objectPath: text("object_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPhotoSchema = createInsertSchema(photosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photosTable.$inferSelect;
