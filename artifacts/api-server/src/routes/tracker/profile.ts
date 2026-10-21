import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, membersTable, profileSetupLocksTable } from "@workspace/db";
import {
  GetMyProfileResponse,
  SaveMyProfileBody,
  SaveMyProfileResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";
import { currentUserId } from "./helpers";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;

  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, userId))
    .limit(1);

  if (!member) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }

  res.json(GetMyProfileResponse.parse(member));
});

router.put("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = currentUserId(req, res);
  if (!userId) return;

  const parsed = SaveMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, username, firstName, lastName } = parsed.data;
  const [usernameOwner] = await db
    .select({ id: membersTable.id })
    .from(membersTable)
    .where(
      and(
        sql`lower(${membersTable.username}) = ${username.toLowerCase()}`,
        sql`${membersTable.id} <> ${userId}`,
      ),
    )
    .limit(1);
  if (usernameOwner) {
    res.status(409).json({ error: "That username is already in use." });
    return;
  }

  const member = await db.transaction(async (tx) => {
    await tx
      .insert(profileSetupLocksTable)
      .values({ id: "first-member" })
      .onDuplicateKeyUpdate({ set: { id: "first-member" } });
    await tx
      .select()
      .from(profileSetupLocksTable)
      .where(eq(profileSetupLocksTable.id, "first-member"))
      .for("update");
    const [existing] = await tx
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, userId))
      .limit(1);

    if (existing) {
      await tx
        .update(membersTable)
        .set({ email, username, firstName, lastName })
        .where(eq(membersTable.id, userId));
      const [updated] = await tx
        .select()
        .from(membersTable)
        .where(eq(membersTable.id, userId))
        .limit(1);
      return updated;
    }

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(membersTable);
    const role = countRow.count === 0 ? "supervisor" : "employee";
    await tx
      .insert(membersTable)
      .values({ id: userId, email, username, firstName, lastName, role });
    const [created] = await tx
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, userId))
      .limit(1);
    return created;
  });

  res.json(SaveMyProfileResponse.parse(member));
});

export default router;
