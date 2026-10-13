import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { Request, Response } from "express";
import { db, membersTable, taskCommentsTable, tasksTable } from "@workspace/db";

export async function getCurrentMember(userId: string) {
  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, userId))
    .limit(1);
  return member ?? null;
}

export function requireSupervisor(
  member: { role: string } | null,
  res: Response,
): boolean {
  if (!member || member.role !== "supervisor") {
    res.status(member ? 403 : 404).json({
      error: member ? "Supervisor access is required." : "Complete your profile first.",
    });
    return false;
  }
  return true;
}

export function requireProfile(
  member: { role: string } | null,
  res: Response,
): member is NonNullable<typeof member> {
  if (!member) {
    res.status(409).json({ error: "Complete your profile before using the task tracker." });
    return false;
  }
  return true;
}

export async function tasksWithDetails(
  conditions: SQL[],
): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select()
    .from(tasksTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(tasksTable.date, tasksTable.time, tasksTable.id);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const memberIds = [...new Set(rows.map((row) => row.memberId))];
  const [members, comments] = await Promise.all([
    db
      .select({
        id: membersTable.id,
        firstName: membersTable.firstName,
        lastName: membersTable.lastName,
      })
      .from(membersTable)
      .where(inArray(membersTable.id, memberIds)),
    db
      .select()
      .from(taskCommentsTable)
      .where(inArray(taskCommentsTable.taskId, ids))
      .orderBy(taskCommentsTable.createdAt),
  ]);

  const memberById = new Map(members.map((member) => [member.id, member]));
  const missingSupervisorIds = [
    ...new Set(
      comments
        .map((comment) => comment.supervisorId)
        .filter((id) => !memberById.has(id)),
    ),
  ];
  if (missingSupervisorIds.length > 0) {
    const supervisors = await db
      .select({
        id: membersTable.id,
        firstName: membersTable.firstName,
        lastName: membersTable.lastName,
      })
      .from(membersTable)
      .where(inArray(membersTable.id, missingSupervisorIds));
    for (const supervisor of supervisors) memberById.set(supervisor.id, supervisor);
  }

  const commentsByTask = new Map<number, Array<Record<string, unknown>>>();
  for (const comment of comments) {
    const supervisor = memberById.get(comment.supervisorId);
    const list = commentsByTask.get(comment.taskId) ?? [];
    list.push({
      ...comment,
      supervisorName: supervisor
        ? `${supervisor.firstName} ${supervisor.lastName}`
        : "Supervisor",
    });
    commentsByTask.set(comment.taskId, list);
  }

  return rows.map((row) => {
    const member = memberById.get(row.memberId);
    return {
      ...row,
      memberName: member ? `${member.firstName} ${member.lastName}` : "Team member",
      comments: commentsByTask.get(row.id) ?? [],
    };
  });
}

export function currentUserId(req: Request, res: Response): string | null {
  if (!req.userId) {
    res.status(401).json({ error: "Sign in is required." });
    return null;
  }
  return req.userId;
}
