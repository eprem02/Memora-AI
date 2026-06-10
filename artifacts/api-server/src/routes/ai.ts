import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import { db, conversationsTable, messagesTable, aiMemoriesTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

const SYSTEM_PROMPT = `You are Memora, a warm, intelligent AI companion embedded in the user's personal second-brain app. You have access to the context of being their personal memory assistant — helping them think through ideas, reflect on their day, organize thoughts, and provide thoughtful conversation. Be concise but thoughtful. Never use emojis. Be direct and human.`;

function buildSystemPrompt(memories: string[]): string {
  if (memories.length === 0) return SYSTEM_PROMPT;
  const memoryBlock = memories.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return `${SYSTEM_PROMPT}\n\nThings you remember about this user:\n${memoryBlock}\n\nUse these memories naturally to personalise your responses when relevant.`;
}

// ── AI Memories CRUD ─────────────────────────────────────────────────────────
router.get("/ai/memories", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const memories = await db.select().from(aiMemoriesTable)
    .where(eq(aiMemoriesTable.userId, user.userId))
    .orderBy(desc(aiMemoriesTable.createdAt));
  res.json(memories.map(m => ({ id: m.id, content: m.content, createdAt: m.createdAt.toISOString() })));
});

router.delete("/ai/memories/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [mem] = await db.delete(aiMemoriesTable)
    .where(and(eq(aiMemoriesTable.id, id), eq(aiMemoriesTable.userId, user.userId)))
    .returning();
  if (!mem) { res.status(404).json({ error: "Memory not found" }); return; }
  res.sendStatus(204);
});

// ── Conversations ────────────────────────────────────────────────────────────
router.get("/ai/conversations", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const convos = await db.select().from(conversationsTable)
    .where(eq(conversationsTable.userId, user.userId))
    .orderBy(desc(conversationsTable.createdAt));
  res.json(convos.map(c => ({ id: c.id, title: c.title, createdAt: c.createdAt.toISOString() })));
});

router.post("/ai/conversations", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const [convo] = await db.insert(conversationsTable).values({
    userId: user.userId,
    title: "New conversation",
  }).returning();
  res.status(201).json({ id: convo.id, title: convo.title, createdAt: convo.createdAt.toISOString() });
});

router.get("/ai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [convo] = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, user.userId)));
  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));

  res.json({
    id: convo.id,
    title: convo.title,
    createdAt: convo.createdAt.toISOString(),
    messages: msgs.map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() })),
  });
});

router.delete("/ai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [convo] = await db.delete(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, user.userId))).returning();
  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

// ── Send message (streaming) ─────────────────────────────────────────────────
router.post("/ai/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { content } = req.body;
  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  const [convo] = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, user.userId)));
  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(messagesTable).values({ conversationId: id, role: "user", content });

  // Load history + user memories in parallel
  const [history, userMemories] = await Promise.all([
    db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(asc(messagesTable.createdAt)),
    db.select().from(aiMemoriesTable)
      .where(eq(aiMemoriesTable.userId, user.userId))
      .orderBy(asc(aiMemoriesTable.createdAt)),
  ]);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const contents = history.map(m => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

    const stream = await genai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: buildSystemPrompt(userMemories.map(m => m.content)),
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });

    if (convo.title === "New conversation" && history.length === 1) {
      const titleSnippet = content.slice(0, 60);
      await db.update(conversationsTable).set({ title: titleSnippet }).where(eq(conversationsTable.id, id));
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

    // Async: extract memorable facts from this exchange (fire-and-forget)
    extractAndStoreMemories(user.userId, content, fullResponse).catch(err =>
      logger.error({ err }, "Memory extraction error")
    );

  } catch (err) {
    logger.error({ err }, "Gemini stream error");
    res.write(`data: ${JSON.stringify({ error: "AI error" })}\n\n`);
  }

  res.end();
});

// ── Background memory extraction ─────────────────────────────────────────────
async function extractAndStoreMemories(userId: number, userMsg: string, assistantMsg: string) {
  const prompt = `You are extracting memorable personal facts from a conversation snippet.

User said: "${userMsg}"
Assistant replied: "${assistantMsg}"

Extract ONLY concrete, durable facts about the user worth remembering long-term (e.g. name, job, location, preferences, goals, family, health conditions, hobbies). 
If there are no memorable facts, respond with exactly: NONE
Otherwise respond with one fact per line, plain text, no bullet points, no numbering. Maximum 3 facts.`;

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = response.text?.trim() ?? "";
  if (!text || text === "NONE") return;

  const facts = text.split("\n").map(f => f.trim()).filter(f => f.length > 5 && f !== "NONE").slice(0, 3);

  for (const fact of facts) {
    // Avoid storing near-duplicates by checking existing memories
    const existing = await db.select().from(aiMemoriesTable)
      .where(eq(aiMemoriesTable.userId, userId));
    const isDuplicate = existing.some(m =>
      m.content.toLowerCase().includes(fact.toLowerCase().slice(0, 20))
    );
    if (!isDuplicate) {
      await db.insert(aiMemoriesTable).values({ userId, content: fact });
    }
  }
}

export default router;
