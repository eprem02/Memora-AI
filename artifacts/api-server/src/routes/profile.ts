import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    bio: u.bio,
    avatarInitials: u.avatarInitials,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
  if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }
  res.json(formatUser(dbUser));
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const { name, bio, avatarInitials, avatarUrl } = req.body;

  const updates: Partial<{
    name: string; bio: string; avatarInitials: string; avatarUrl: string;
  }> = {};
  if (name !== undefined) updates.name = name;
  if (bio !== undefined) updates.bio = bio;
  if (avatarInitials !== undefined) updates.avatarInitials = avatarInitials;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  const [dbUser] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, user.userId))
    .returning();
  if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }
  res.json(formatUser(dbUser));
});

// Returns a presigned PUT URL the client can upload an avatar image directly to GCS
router.post("/profile/avatar-upload-url", requireAuth, async (req, res): Promise<void> => {
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err) {
    req.log.error({ err }, "Failed to generate avatar upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

export default router;
