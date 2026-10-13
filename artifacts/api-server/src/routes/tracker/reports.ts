import { Router, type IRouter } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  GetWeeklyReportQueryParams,
  GetWeeklyReportResponse,
} from "@workspace/api-zod";
import { db, membersTable, tasksTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { normalizeDateOnlyQuery } from "./date-query";
import {
  currentUserId,
  getCurrentMember,
  requireProfile,
} from "./helpers";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/reports/weekly", async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const currentMember = await getCurrentMember(userId);
  if (!requireProfile(currentMember, res)) return;

  const parsed = GetWeeklyReportQueryParams.safeParse(
    normalizeDateOnlyQuery(req.query, ["weekStart"]),
  );
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const weekStart = parsed.data.weekStart.toISOString().slice(0, 10);
  const startDate = new Date(`${weekStart}T00:00:00.000Z`);
  if (startDate.getUTCDay() !== 1) {
    res.status(400).json({ error: "weekStart must be a Monday." });
    return;
  }
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const weekEnd = endDate.toISOString().slice(0, 10);
  const isSupervisor = currentMember.role === "supervisor";

  const [members, tasks] = await Promise.all([
    isSupervisor
      ? db
          .select()
          .from(membersTable)
          .orderBy(membersTable.lastName, membersTable.firstName)
      : Promise.resolve([currentMember]),
    db
      .select()
      .from(tasksTable)
      .where(
        isSupervisor
          ? and(gte(tasksTable.date, weekStart), lte(tasksTable.date, weekEnd))
          : and(
              gte(tasksTable.date, weekStart),
              lte(tasksTable.date, weekEnd),
              eq(tasksTable.memberId, userId),
            ),
        ),
  ]);

  const performance = new Map<
    string,
    { totalTasks: number; completedTasks: number; pendingTasks: number }
  >();
  for (const task of tasks) {
    const row = performance.get(task.memberId) ?? {
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
    };
    row.totalTasks += 1;
    if (task.status === "done") row.completedTasks += 1;
    else row.pendingTasks += 1;
    performance.set(task.memberId, row);
  }

  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const pendingTasks = tasks.length - completedTasks;
  const report = {
    weekStart,
    weekEnd,
    totalTasks: tasks.length,
    completedTasks,
    pendingTasks,
    completionRate:
      tasks.length === 0
        ? 0
        : Math.round((completedTasks / tasks.length) * 100),
    members: members.map((member) => {
      const row = performance.get(member.id) ?? {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
      };
      return {
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        role: member.role,
        ...row,
        completionRate:
          row.totalTasks === 0
            ? 0
            : Math.round((row.completedTasks / row.totalTasks) * 100),
      };
    }),
  };

  res.json(GetWeeklyReportResponse.parse(report));
});

export default router;
