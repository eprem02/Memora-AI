import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;

  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
  if (!dbUser) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    bio: dbUser.bio,
    avatarInitials: dbUser.avatarInitials,
    createdAt: dbUser.createdAt.toISOString(),
  });
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const { name, bio, avatarInitials } = req.body;

  const updates: Partial<{ name: string; bio: string; avatarInitials: string }> = {};
  if (name !== undefined) updates.name = name;
  if (bio !== undefined) updates.bio = bio;
  if (avatarInitials !== undefined) updates.avatarInitials = avatarInitials;

  const [dbUser] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, user.userId))
    .returning();

  if (!dbUser) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    bio: dbUser.bio,
    avatarInitials: dbUser.avatarInitials,
    createdAt: dbUser.createdAt.toISOString(),
  });
});

export default router;
