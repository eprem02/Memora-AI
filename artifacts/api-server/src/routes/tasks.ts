import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const status = typeof req.query.status === "string" ? req.query.status : "all";

  let condition;
  if (status === "pending") {
    condition = and(eq(tasksTable.userId, user.userId), eq(tasksTable.completed, false));
  } else if (status === "completed") {
    condition = and(eq(tasksTable.userId, user.userId), eq(tasksTable.completed, true));
  } else {
    condition = eq(tasksTable.userId, user.userId);
  }

  const tasks = await db.select().from(tasksTable).where(condition).orderBy(desc(tasksTable.createdAt));

  res.json(tasks.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const { title, description, completed, priority, dueDate } = req.body;

  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const [task] = await db.insert(tasksTable).values({
    userId: user.userId,
    title,
    description: description ?? null,
    completed: completed ?? false,
    priority: priority ?? "medium",
    dueDate: dueDate ?? null,
  }).returning();

  res.status(201).json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.get("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(
    and(eq(tasksTable.id, id), eq(tasksTable.userId, user.userId))
  );

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { title, description, completed, priority, dueDate } = req.body;
  const updates: Partial<{
    title: string;
    description: string | null;
    completed: boolean;
    priority: string;
    dueDate: string | null;
  }> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (completed !== undefined) updates.completed = completed;
  if (priority !== undefined) updates.priority = priority;
  if (dueDate !== undefined) updates.dueDate = dueDate;

  const [task] = await db.update(tasksTable)
    .set(updates)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, user.userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [task] = await db.delete(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.userId, user.userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
