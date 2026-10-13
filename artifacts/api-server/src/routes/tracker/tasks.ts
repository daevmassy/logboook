import { Router, type IRouter } from "express";
import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import {
  AddTaskCommentBody,
  AddTaskCommentParams,
  AddTaskCommentResponse,
  CreateTaskBody,
  CreateTaskResponse,
  DeleteTaskParams,
  ListTasksQueryParams,
  ListTasksResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import { db, membersTable, taskCommentsTable, tasksTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { normalizeDateOnlyQuery } from "./date-query";
import {
  currentUserId,
  getCurrentMember,
  requireProfile,
  requireSupervisor,
  tasksWithDetails,
} from "./helpers";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/tasks", async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const member = await getCurrentMember(userId);
  if (!requireProfile(member, res)) return;

  const parsed = ListTasksQueryParams.safeParse(
    normalizeDateOnlyQuery(req.query, ["from", "to"]),
  );
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { from, to, status, memberId } = parsed.data;
  const isSupervisor = member.role === "supervisor";
  if (memberId && !isSupervisor && memberId !== userId) {
    res.status(403).json({ error: "You can only view your own task logs." });
    return;
  }

  const conditions: SQL[] = [];
  if (!isSupervisor) conditions.push(eq(tasksTable.memberId, userId));
  else if (memberId) conditions.push(eq(tasksTable.memberId, memberId));
  if (from) conditions.push(gte(tasksTable.date, from.toISOString().slice(0, 10)));
  if (to) conditions.push(lte(tasksTable.date, to.toISOString().slice(0, 10)));
  if (status) conditions.push(eq(tasksTable.status, status));

  res.json(ListTasksResponse.parse(await tasksWithDetails(conditions)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const member = await getCurrentMember(userId);
  if (!requireProfile(member, res)) return;

  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db
    .insert(tasksTable)
    .values({
      memberId: userId,
      ...parsed.data,
      date: parsed.data.date.toISOString().slice(0, 10),
    })
    .returning();
  const [task] = await tasksWithDetails([eq(tasksTable.id, created.id)]);
  res.status(201).json(CreateTaskResponse.parse(task));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const member = await getCurrentMember(userId);
  if (!requireProfile(member, res)) return;

  const params = UpdateTaskParams.safeParse(req.params);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Task not found." });
    return;
  }
  if (existing.memberId !== userId) {
    res.status(403).json({ error: "You can only update your own task logs." });
    return;
  }

  const { date, ...changes } = parsed.data;
  const [updated] = await db
    .update(tasksTable)
    .set({
      ...changes,
      ...(date ? { date: date.toISOString().slice(0, 10) } : {}),
    })
    .where(eq(tasksTable.id, params.data.id))
    .returning();
  const [task] = await tasksWithDetails([eq(tasksTable.id, updated.id)]);
  res.json(UpdateTaskResponse.parse(task));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const member = await getCurrentMember(userId);
  if (!requireProfile(member, res)) return;

  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.memberId, userId)))
    .returning({ id: tasksTable.id });
  if (!deleted) {
    const [exists] = await db
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.id, params.data.id))
      .limit(1);
    res.status(exists ? 403 : 404).json({
      error: exists ? "You can only delete your own task logs." : "Task not found.",
    });
    return;
  }
  res.sendStatus(204);
});

router.post("/tasks/:id/comments", async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const member = await getCurrentMember(userId);
  if (!requireSupervisor(member, res)) return;

  const params = AddTaskCommentParams.safeParse(req.params);
  const parsed = AddTaskCommentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(eq(tasksTable.id, params.data.id))
    .limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found." });
    return;
  }

  const [comment] = await db
    .insert(taskCommentsTable)
    .values({
      taskId: params.data.id,
      supervisorId: userId,
      comment: parsed.data.comment,
    })
    .returning();
  res.status(201).json(
    AddTaskCommentResponse.parse({
      ...comment,
      supervisorName: `${member.firstName} ${member.lastName}`,
    }),
  );
});

export default router;
