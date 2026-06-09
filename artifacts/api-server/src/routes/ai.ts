import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are Memora, a warm, intelligent AI companion embedded in the user's personal second-brain app. You have access to the context of being their personal memory assistant — helping them think through ideas, reflect on their day, organize thoughts, and provide thoughtful conversation. Be concise but thoughtful. Never use emojis. Be direct and human.`;

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

  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));

  const chatMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });

    if (convo.title === "New conversation" && history.length === 1) {
      const titleSnippet = content.slice(0, 60);
      await db.update(conversationsTable).set({ title: titleSnippet }).where(eq(conversationsTable.id, id));
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    logger.error({ err }, "AI stream error");
    res.write(`data: ${JSON.stringify({ error: "AI error" })}\n\n`);
  }

  res.end();
});

export default router;
