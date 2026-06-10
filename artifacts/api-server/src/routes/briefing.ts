import { Router, type IRouter } from "express";
import { eq, desc, asc, and } from "drizzle-orm";
import {
  db,
  usersTable,
  notesTable,
  tasksTable,
  memoriesTable,
  medicationsTable,
  aiMemoriesTable,
} from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

router.get("/briefing", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const uid = user.userId;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayStr = todayStart.toISOString().slice(0, 10); // YYYY-MM-DD

  // Fetch everything in parallel
  const [profile, tasks, notes, memories, medications, aiMemories] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, uid)).then(r => r[0] ?? null),
    db.select().from(tasksTable)
      .where(eq(tasksTable.userId, uid))
      .orderBy(asc(tasksTable.completed), desc(tasksTable.createdAt))
      .limit(50),
    db.select().from(notesTable)
      .where(eq(notesTable.userId, uid))
      .orderBy(desc(notesTable.updatedAt))
      .limit(5),
    db.select().from(memoriesTable)
      .where(eq(memoriesTable.userId, uid))
      .orderBy(desc(memoriesTable.updatedAt))
      .limit(5),
    db.select().from(medicationsTable)
      .where(and(eq(medicationsTable.userId, uid), eq(medicationsTable.isActive, true)))
      .orderBy(asc(medicationsTable.name)),
    db.select().from(aiMemoriesTable)
      .where(eq(aiMemoriesTable.userId, uid))
      .orderBy(desc(aiMemoriesTable.createdAt))
      .limit(10),
  ]);

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedToday = tasks.filter(t => {
    if (!t.completed) return false;
    const upd = (t as any).updatedAt;
    if (!upd) return false;
    const d = new Date(upd).toISOString().slice(0, 10);
    return d === todayStr;
  });
  const dueTodayTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    return t.dueDate.slice(0, 10) === todayStr;
  });
  const overdueTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    return t.dueDate < todayStart.toISOString();
  });

  // Build AI summary
  let aiSummary: string | null = null;
  try {
    const name = profile?.name || "there";
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const context = [
      `User: ${name}`,
      `Today: ${dayOfWeek}, ${dateStr}`,
      `Pending tasks: ${pendingTasks.length} (${dueTodayTasks.length} due today, ${overdueTasks.length} overdue)`,
      `Active medications: ${medications.length} — ${medications.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join("; ") || "none"}`,
      `Recent notes: ${notes.map(n => n.title).join(", ") || "none"}`,
      `Recent memories: ${memories.map(m => m.title).join(", ") || "none"}`,
      aiMemories.length > 0 ? `Known facts: ${aiMemories.slice(0, 5).map(m => m.content).join("; ")}` : "",
      dueTodayTasks.length > 0 ? `Tasks due today: ${dueTodayTasks.map(t => t.title).join(", ")}` : "",
      overdueTasks.length > 0 ? `Overdue tasks: ${overdueTasks.map(t => t.title).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `You are Memora, a personal AI assistant. Write a warm, concise daily briefing for the user. It should feel like a thoughtful morning message from a trusted assistant — not a list, but natural prose in 3–4 short paragraphs. Cover: a greeting, key things to focus on today (tasks/medications), a note about recent activity, and a brief motivational close. Be specific — use their actual data. No emojis. Keep it under 180 words.

User data:
${context}`;

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    aiSummary = response.text?.trim() ?? null;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Briefing AI summary failed — returning data without summary");
  }

  res.json({
    date: new Date().toISOString(),
    profile: profile ? { name: profile.name, email: profile.email } : null,
    summary: aiSummary,
    tasks: {
      dueToday: dueTodayTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate })),
      overdue: overdueTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate })),
      pending: pendingTasks.filter(t => !t.dueDate).slice(0, 10).map(t => ({ id: t.id, title: t.title, priority: t.priority })),
      completedToday: completedToday.map(t => ({ id: t.id, title: t.title })),
    },
    medications: medications.map(m => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      instructions: m.instructions,
      color: m.color,
    })),
    notes: notes.map(n => ({
      id: n.id,
      title: n.title,
      content: n.content?.slice(0, 120) ?? "",
      isPinned: n.isPinned,
      updatedAt: n.updatedAt.toISOString(),
    })),
    memories: memories.map(m => ({
      id: m.id,
      title: m.title,
      content: m.content?.slice(0, 120) ?? "",
      tags: m.tags,
      updatedAt: m.updatedAt.toISOString(),
    })),
  });
});

export default router;
