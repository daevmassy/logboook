import { createInsertSchema } from "drizzle-zod";
import {
  date,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const membersTable = mysqlTable(
  "members",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    email: text("email").notNull(),
    username: varchar("username", { length: 40 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    role: varchar("role", { length: 40 }).notNull().default("employee"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("members_username_unique").on(table.username)],
);

export const tasksTable = mysqlTable("task_logs", {
  id: int("id").autoincrement().primaryKey(),
  memberId: varchar("member_id", { length: 191 })
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  time: varchar("time", { length: 5 }).notNull(),
  activity: varchar("activity", { length: 300 }).notNull(),
  department: varchar("department", { length: 120 }).notNull(),
  issue: text("issue").notNull(),
  actionTaken: text("action_taken").notNull(),
  status: varchar("status", { length: 40 }).notNull().default("pending"),
  remarks: text("remarks").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const taskCommentsTable = mysqlTable("task_comments", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  supervisorId: varchar("supervisor_id", { length: 191 })
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const profileSetupLocksTable = mysqlTable("profile_setup_locks", {
  id: varchar("id", { length: 40 }).primaryKey(),
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
