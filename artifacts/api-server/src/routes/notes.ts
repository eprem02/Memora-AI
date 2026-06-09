import { Router, type IRouter } from "express";
import { eq, and, ilike, desc } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  let query = db.select().from(notesTable).where(
    search
      ? and(eq(notesTable.userId, user.userId), ilike(notesTable.title, `%${search}%`))
      : eq(notesTable.userId, user.userId)
  ).$dynamic();

  const notes = await query.orderBy(desc(notesTable.updatedAt));

  res.json(notes.map(n => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  })));
});

router.post("/notes", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const { title, content, isPinned } = req.body;

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const [note] = await db.insert(notesTable).values({
    userId: user.userId,
    title,
    content: content ?? "",
    isPinned: isPinned ?? false,
  }).returning();

  res.status(201).json({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
});

router.get("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [note] = await db.select().from(notesTable).where(
    and(eq(notesTable.id, id), eq(notesTable.userId, user.userId))
  );

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
});

router.patch("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { title, content, isPinned } = req.body;
  const updates: Partial<{ title: string; content: string; isPinned: boolean }> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (isPinned !== undefined) updates.isPinned = isPinned;

  const [note] = await db.update(notesTable)
    .set(updates)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, user.userId)))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json({
    ...note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
});

router.delete("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [note] = await db.delete(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, user.userId)))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
