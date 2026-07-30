import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lessonPlansTable = pgTable("lesson_plans", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lessonDaysTable = pgTable("lesson_days", {
  id: serial("id").primaryKey(),
  lessonPlanId: integer("lesson_plan_id").notNull().references(() => lessonPlansTable.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  title: text("title").notNull(),
  lessonContent: text("lesson_content").notNull(),
  quiz: jsonb("quiz").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLessonPlanSchema = createInsertSchema(lessonPlansTable).omit({ id: true, createdAt: true });
export type InsertLessonPlan = z.infer<typeof insertLessonPlanSchema>;
export type LessonPlan = typeof lessonPlansTable.$inferSelect;

export const insertLessonDaySchema = createInsertSchema(lessonDaysTable).omit({ id: true, createdAt: true });
export type InsertLessonDay = z.infer<typeof insertLessonDaySchema>;
export type LessonDay = typeof lessonDaysTable.$inferSelect;
