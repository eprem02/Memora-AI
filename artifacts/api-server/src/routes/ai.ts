import { Router, type IRouter } from "express";
import { eq, and, asc, desc, ilike, or } from "drizzle-orm";
import {
  db,
  conversationsTable,
  messagesTable,
  aiMemoriesTable,
  notesTable,
  tasksTable,
  memoriesTable,
  medicationsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

// ─── Intent detection ─────────────────────────────────────────────────────────
type DataIntent = "profile" | "notes" | "tasks" | "medications" | "memories";

function detectIntents(message: string): Set<DataIntent> {
  const m = message.toLowerCase();
  const intents = new Set<DataIntent>();

  if (/\b(my name|who am i|what('s| is) my name|call me|about me|my profile|my email)\b/.test(m)) {
    intents.add("profile");
  }
  if (/\b(note|notes|wrote|written|jot|jotted|document)\b/.test(m)) {
    intents.add("notes");
  }
  if (/\b(task|tasks|todo|to-do|to do|reminder|reminders|pending|overdue|due|assignment|work item)\b/.test(m)) {
    intents.add("tasks");
  }
  if (/\b(medication|medications|medicine|medicines|drug|drugs|prescription|prescriptions|pill|pills|dose|dosage|treatment)\b/.test(m)) {
    intents.add("medications");
  }
  if (/\b(memor|remember|memories|recall|stored|saved|know about me)\b/.test(m)) {
    intents.add("memories");
  }

  // Broad "what do I have", "show me", "tell me about", "summarize", "list my" → fetch everything
  if (/\b(everything|all my|summarize|overview|what do i have|what('s| is) in|show me|tell me about myself|my data)\b/.test(m)) {
    intents.add("profile");
    intents.add("notes");
    intents.add("tasks");
    intents.add("medications");
    intents.add("memories");
  }

  return intents;
}

// ─── Context builder ───────────────────────────────────────────────────────────
async function buildPersonalContext(
  userId: number,
  intents: Set<DataIntent>,
): Promise<string> {
  if (intents.size === 0) return "";

  const fetches: Promise<string>[] = [];

  if (intents.has("profile")) {
    fetches.push(
      db.select().from(usersTable).where(eq(usersTable.id, userId)).then(([user]) => {
        if (!user) return "";
        const parts: string[] = ["## User Profile"];
        if (user.name) parts.push(`- Name: ${user.name}`);
        if (user.email) parts.push(`- Email: ${user.email}`);
        if (user.bio) parts.push(`- Bio: ${user.bio}`);
        return parts.length > 1 ? parts.join("\n") : "";
      }),
    );
  }

  if (intents.has("notes")) {
    fetches.push(
      db
        .select()
        .from(notesTable)
        .where(eq(notesTable.userId, userId))
        .orderBy(desc(notesTable.updatedAt))
        .limit(15)
        .then((notes) => {
          if (!notes.length) return "## Notes\n- (no notes saved)";
          const lines = notes.map(
            (n) => `- **${n.title}**${n.content ? `: ${n.content.slice(0, 200)}${n.content.length > 200 ? "…" : ""}` : ""}`,
          );
          return `## Notes (${notes.length})\n${lines.join("\n")}`;
        }),
    );
  }

  if (intents.has("tasks")) {
    fetches.push(
      db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.userId, userId))
        .orderBy(asc(tasksTable.completed), desc(tasksTable.createdAt))
        .limit(30)
        .then((tasks) => {
          if (!tasks.length) return "## Tasks\n- (no tasks saved)";
          const pending = tasks.filter((t) => !t.completed);
          const done = tasks.filter((t) => t.completed);
          const fmt = (t: typeof tasks[0]) => {
            let line = `- [${t.completed ? "x" : " "}] **${t.title}** (${t.priority} priority)`;
            if (t.description) line += ` — ${t.description.slice(0, 100)}`;
            if (t.dueDate) line += ` | due: ${t.dueDate}`;
            return line;
          };
          const sections: string[] = [`## Tasks — ${pending.length} pending, ${done.length} completed`];
          if (pending.length) sections.push("### Pending\n" + pending.map(fmt).join("\n"));
          if (done.length) sections.push("### Completed\n" + done.slice(0, 10).map(fmt).join("\n"));
          return sections.join("\n");
        }),
    );
  }

  if (intents.has("medications")) {
    fetches.push(
      db
        .select()
        .from(medicationsTable)
        .where(eq(medicationsTable.userId, userId))
        .orderBy(desc(medicationsTable.isActive), asc(medicationsTable.name))
        .then((meds) => {
          if (!meds.length) return "## Medications\n- (no medications saved)";
          const active = meds.filter((m) => m.isActive);
          const inactive = meds.filter((m) => !m.isActive);
          const fmt = (m: typeof meds[0]) => {
            let line = `- **${m.name}** — ${m.dosage}, ${m.frequency}`;
            if (m.instructions) line += ` (${m.instructions})`;
            return line;
          };
          const sections: string[] = [`## Medications — ${active.length} active, ${inactive.length} inactive`];
          if (active.length) sections.push("### Active\n" + active.map(fmt).join("\n"));
          if (inactive.length) sections.push("### Inactive\n" + inactive.map(fmt).join("\n"));
          return sections.join("\n");
        }),
    );
  }

  if (intents.has("memories")) {
    fetches.push(
      db
        .select()
        .from(memoriesTable)
        .where(eq(memoriesTable.userId, userId))
        .orderBy(desc(memoriesTable.updatedAt))
        .limit(20)
        .then((mems) => {
          if (!mems.length) return "## Memories\n- (no memories saved)";
          const lines = mems.map(
            (m) =>
              `- **${m.title}**${m.tags?.length ? ` [${m.tags.join(", ")}]` : ""}${m.content ? `: ${m.content.slice(0, 200)}${m.content.length > 200 ? "…" : ""}` : ""}`,
          );
          return `## Memories (${mems.length})\n${lines.join("\n")}`;
        }),
    );
  }

  const sections = (await Promise.all(fetches)).filter(Boolean);
  if (!sections.length) return "";

  return (
    "\n\n---\n**Personal data retrieved from the user's second-brain — use it to answer accurately:**\n\n" +
    sections.join("\n\n") +
    "\n---"
  );
}

// ─── System prompt ─────────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `You are Memora, a warm, intelligent AI companion embedded in the user's personal second-brain app. You help them think through ideas, reflect on their day, organize thoughts, and provide thoughtful conversation.

When personal data is provided below (notes, tasks, medications, memories, profile), use it to answer accurately and specifically — never say "I don't know" when the data is right there. Be concise but thorough. Never use emojis. Be direct and human.`;

function buildSystemPrompt(aiMemories: string[], personalContext: string): string {
  let prompt = BASE_SYSTEM_PROMPT;

  if (aiMemories.length > 0) {
    prompt += "\n\n**Things you remember about this user (learned from past conversations):**\n";
    prompt += aiMemories.map((m, i) => `${i + 1}. ${m}`).join("\n");
  }

  if (personalContext) {
    prompt += personalContext;
  }

  return prompt;
}

// ─── AI Memories CRUD ─────────────────────────────────────────────────────────
router.get("/ai/memories", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const memories = await db
    .select()
    .from(aiMemoriesTable)
    .where(eq(aiMemoriesTable.userId, user.userId))
    .orderBy(desc(aiMemoriesTable.createdAt));
  res.json(
    memories.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

router.delete("/ai/memories/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [mem] = await db
    .delete(aiMemoriesTable)
    .where(and(eq(aiMemoriesTable.id, id), eq(aiMemoriesTable.userId, user.userId)))
    .returning();
  if (!mem) { res.status(404).json({ error: "Memory not found" }); return; }
  res.sendStatus(204);
});

// ─── Conversations ────────────────────────────────────────────────────────────
router.get("/ai/conversations", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const convos = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, user.userId))
    .orderBy(desc(conversationsTable.createdAt));
  res.json(
    convos.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.post("/ai/conversations", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const [convo] = await db
    .insert(conversationsTable)
    .values({ userId: user.userId, title: "New conversation" })
    .returning();
  res.status(201).json({
    id: convo.id,
    title: convo.title,
    createdAt: convo.createdAt.toISOString(),
  });
});

router.get("/ai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [convo] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, user.userId)));
  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));

  res.json({
    id: convo.id,
    title: convo.title,
    createdAt: convo.createdAt.toISOString(),
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

router.delete("/ai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [convo] = await db
    .delete(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, user.userId)))
    .returning();
  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

// ─── Send message (streaming) ─────────────────────────────────────────────────
router.post(
  "/ai/conversations/:id/messages",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as typeof req & { user: AuthPayload }).user;
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { content } = req.body;
    if (!content || typeof content !== "string") {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    const [convo] = await db
      .select()
      .from(conversationsTable)
      .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, user.userId)));
    if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

    // Save user message
    await db.insert(messagesTable).values({ conversationId: id, role: "user", content });

    // Detect what personal data the user is asking about
    const intents = detectIntents(content);

    // Load history, ai memories, and personal context — all in parallel
    const [history, aiMemories, personalContext] = await Promise.all([
      db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, id))
        .orderBy(asc(messagesTable.createdAt)),
      db
        .select()
        .from(aiMemoriesTable)
        .where(eq(aiMemoriesTable.userId, user.userId))
        .orderBy(asc(aiMemoriesTable.createdAt)),
      buildPersonalContext(user.userId, intents),
    ]);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    try {
      const contents = history.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));

      const systemInstruction = buildSystemPrompt(
        aiMemories.map((m) => m.content),
        personalContext,
      );

      const stream = await genai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents,
        config: { systemInstruction },
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

      await db.insert(messagesTable).values({
        conversationId: id,
        role: "assistant",
        content: fullResponse,
      });

      // Auto-title the conversation from the first user message
      if (convo.title === "New conversation" && history.length === 1) {
        const titleSnippet = content.slice(0, 60);
        await db
          .update(conversationsTable)
          .set({ title: titleSnippet })
          .where(eq(conversationsTable.id, id));
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);

      // Background: extract memorable facts from this exchange
      extractAndStoreMemories(user.userId, content, fullResponse).catch((err) =>
        logger.error({ err }, "Memory extraction error"),
      );
    } catch (err: any) {
      logger.error({ err }, "Gemini stream error");
      // Surface rate-limit errors as in-chat messages so the user understands
      const msg = err?.message ?? "";
      const is429 = err?.status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
      const friendlyText = is429
        ? "I've hit the Gemini API rate limit for now. Please wait a minute and try again, or reduce the frequency of requests."
        : "Something went wrong on my end. Please try again.";
      if (!fullResponse) {
        // Nothing streamed yet — send as a content chunk so it appears as a message
        res.write(`data: ${JSON.stringify({ content: friendlyText })}\n\n`);
        fullResponse = friendlyText;
        await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }

    res.end();
  },
);

// ─── Background memory extraction ─────────────────────────────────────────────
async function extractAndStoreMemories(
  userId: number,
  userMsg: string,
  assistantMsg: string,
) {
  const prompt = `You are extracting memorable personal facts from a conversation snippet.

User said: "${userMsg}"
Assistant replied: "${assistantMsg}"

Extract ONLY concrete, durable facts about the user worth remembering long-term (e.g. name, job, location, preferences, goals, family, health conditions, hobbies).
If there are no memorable facts, respond with exactly: NONE
Otherwise respond with one fact per line, plain text, no bullet points, no numbering. Maximum 3 facts.`;

  const response = await genai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = response.text?.trim() ?? "";
  if (!text || text === "NONE") return;

  const facts = text
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.length > 5 && f !== "NONE")
    .slice(0, 3);

  for (const fact of facts) {
    const existing = await db
      .select()
      .from(aiMemoriesTable)
      .where(eq(aiMemoriesTable.userId, userId));
    const isDuplicate = existing.some((m) =>
      m.content.toLowerCase().includes(fact.toLowerCase().slice(0, 20)),
    );
    if (!isDuplicate) {
      await db.insert(aiMemoriesTable).values({ userId, content: fact });
    }
  }
}

export default router;
