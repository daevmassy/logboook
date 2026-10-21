import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import {
  ListMembersResponse,
  UpdateMemberRoleBody,
  UpdateMemberRoleParams,
  UpdateMemberRoleResponse,
} from "@workspace/api-zod";
import { db, membersTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import {
  currentUserId,
  getCurrentMember,
  requireSupervisor,
} from "./helpers";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/members", async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const currentMember = await getCurrentMember(userId);
  if (!requireSupervisor(currentMember, res)) return;

  const members = await db
    .select()
    .from(membersTable)
    .orderBy(membersTable.lastName, membersTable.firstName);
  res.json(ListMembersResponse.parse(members));
});

router.patch("/members/:id/role", async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;
  const currentMember = await getCurrentMember(userId);
  if (!requireSupervisor(currentMember, res)) return;

  const params = UpdateMemberRoleParams.safeParse(req.params);
  const parsed = UpdateMemberRoleBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, params.data.id))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Member not found." });
    return;
  }

  if (target.role === "supervisor" && parsed.data.role === "employee") {
    const [supervisorCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(membersTable)
      .where(eq(membersTable.role, "supervisor"));
    if (supervisorCount.count <= 1) {
      res.status(400).json({ error: "At least one supervisor must remain." });
      return;
    }
  }

  await db
    .update(membersTable)
    .set({ role: parsed.data.role })
    .where(eq(membersTable.id, target.id));
  const [updated] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, target.id))
    .limit(1);
  res.json(UpdateMemberRoleResponse.parse(updated));
});

export default router;
