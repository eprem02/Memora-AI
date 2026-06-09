import { Router, type IRouter } from "express";
import { eq, and, count, desc } from "drizzle-orm";
import { db, notesTable, tasksTable, memoriesTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const uid = user.userId;

  const [notesCount] = await db.select({ count: count() }).from(notesTable).where(eq(notesTable.userId, uid));
  const [tasksCount] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.userId, uid));
  const [completedCount] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.userId, uid), eq(tasksTable.completed, true)));
  const [memoriesCount] = await db.select({ count: count() }).from(memoriesTable).where(eq(memoriesTable.userId, uid));

  const recentNotes = await db.select().from(notesTable).where(eq(notesTable.userId, uid)).orderBy(desc(notesTable.updatedAt)).limit(3);
  const recentTasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, uid)).orderBy(desc(tasksTable.createdAt)).limit(3);
  const recentMemories = await db.select().from(memoriesTable).where(eq(memoriesTable.userId, uid)).orderBy(desc(memoriesTable.updatedAt)).limit(3);

  res.json({
    totalNotes: Number(notesCount.count),
    totalTasks: Number(tasksCount.count),
    completedTasks: Number(completedCount.count),
    totalMemories: Number(memoriesCount.count),
    recentNotes: recentNotes.map(n => ({ ...n, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() })),
    recentTasks: recentTasks.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })),
    recentMemories: recentMemories.map(m => ({ ...m, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() })),
  });
});

export default router;
