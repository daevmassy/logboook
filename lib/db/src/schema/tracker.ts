import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const membersTable = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    username: varchar("username", { length: 40 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    role: text("role").notNull().default("employee"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("members_username_lower_unique").on(sql`lower(${table.username})`)],
);

export const tasksTable = pgTable("task_logs", {
  id: serial("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  time: varchar("time", { length: 5 }).notNull(),
  activity: varchar("activity", { length: 300 }).notNull(),
  department: varchar("department", { length: 120 }).notNull(),
  issue: text("issue").notNull().default(""),
  actionTaken: text("action_taken").notNull().default(""),
  status: text("status").notNull().default("pending"),
  remarks: text("remarks").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskCommentsTable = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  supervisorId: text("supervisor_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ createdAt: true });
export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export const insertTaskCommentSchema = createInsertSchema(taskCommentsTable).omit({ id: true, createdAt: true });

export type InsertMember = z.infer<typeof insertMemberSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type Member = typeof membersTable.$inferSelect;
export type TaskLog = typeof tasksTable.$inferSelect;
export type TaskComment = typeof taskCommentsTable.$inferSelect;
