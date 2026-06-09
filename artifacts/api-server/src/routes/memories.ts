import { Router, type IRouter } from "express";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { db, memoriesTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/memories", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;

  let baseCondition = eq(memoriesTable.userId, user.userId);

  let memories;
  if (search && tag) {
    memories = await db.select().from(memoriesTable).where(
      and(baseCondition, ilike(memoriesTable.title, `%${search}%`), sql`${tag} = ANY(${memoriesTable.tags})`)
    ).orderBy(desc(memoriesTable.updatedAt));
  } else if (search) {
    memories = await db.select().from(memoriesTable).where(
      and(baseCondition, ilike(memoriesTable.title, `%${search}%`))
    ).orderBy(desc(memoriesTable.updatedAt));
  } else if (tag) {
    memories = await db.select().from(memoriesTable).where(
      and(baseCondition, sql`${tag} = ANY(${memoriesTable.tags})`)
    ).orderBy(desc(memoriesTable.updatedAt));
  } else {
    memories = await db.select().from(memoriesTable).where(baseCondition).orderBy(desc(memoriesTable.updatedAt));
  }

  res.json(memories.map(m => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  })));
});

router.post("/memories", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const { title, content, tags } = req.body;

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const [memory] = await db.insert(memoriesTable).values({
    userId: user.userId,
    title,
    content: content ?? "",
    tags: Array.isArray(tags) ? tags : [],
  }).returning();

  res.status(201).json({
    ...memory,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  });
});

router.get("/memories/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [memory] = await db.select().from(memoriesTable).where(
    and(eq(memoriesTable.id, id), eq(memoriesTable.userId, user.userId))
  );

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  res.json({
    ...memory,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  });
});

router.patch("/memories/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { title, content, tags } = req.body;
  const updates: Partial<{ title: string; content: string; tags: string[] }> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];

  const [memory] = await db.update(memoriesTable)
    .set(updates)
    .where(and(eq(memoriesTable.id, id), eq(memoriesTable.userId, user.userId)))
    .returning();

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  res.json({
    ...memory,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  });
});

router.delete("/memories/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [memory] = await db.delete(memoriesTable)
    .where(and(eq(memoriesTable.id, id), eq(memoriesTable.userId, user.userId)))
    .returning();

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
