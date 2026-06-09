import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, photosTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/photos", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const photos = await db.select().from(photosTable)
    .where(eq(photosTable.userId, user.userId))
    .orderBy(desc(photosTable.createdAt));
  res.json(photos.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() })));
});

router.post("/photos", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const { title, caption, objectPath } = req.body;
  if (!title || !objectPath) {
    res.status(400).json({ error: "Title and objectPath are required" });
    return;
  }
  const [photo] = await db.insert(photosTable).values({
    userId: user.userId, title, caption: caption ?? null, objectPath,
  }).returning();
  res.status(201).json({ ...photo, createdAt: photo.createdAt.toISOString(), updatedAt: photo.updatedAt.toISOString() });
});

router.patch("/photos/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { title, caption } = req.body;
  const updates: Partial<{ title: string; caption: string | null }> = {};
  if (title !== undefined) updates.title = title;
  if (caption !== undefined) updates.caption = caption;

  const [photo] = await db.update(photosTable).set(updates)
    .where(and(eq(photosTable.id, id), eq(photosTable.userId, user.userId))).returning();
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }
  res.json({ ...photo, createdAt: photo.createdAt.toISOString(), updatedAt: photo.updatedAt.toISOString() });
});

router.delete("/photos/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [photo] = await db.delete(photosTable)
    .where(and(eq(photosTable.id, id), eq(photosTable.userId, user.userId))).returning();
  if (!photo) { res.status(404).json({ error: "Photo not found" }); return; }
  res.sendStatus(204);
});

export default router;
