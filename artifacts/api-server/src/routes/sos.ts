import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, sosContactsTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/sos-contacts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const contacts = await db.select().from(sosContactsTable)
    .where(eq(sosContactsTable.userId, user.userId))
    .orderBy(desc(sosContactsTable.createdAt));
  res.json(contacts.map(c => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })));
});

router.post("/sos-contacts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const { name, phone, relationship, notes } = req.body;
  if (!name || !phone || !relationship) {
    res.status(400).json({ error: "Name, phone and relationship are required" });
    return;
  }
  const [contact] = await db.insert(sosContactsTable).values({
    userId: user.userId, name, phone, relationship, notes: notes ?? null,
  }).returning();
  res.status(201).json({ ...contact, createdAt: contact.createdAt.toISOString(), updatedAt: contact.updatedAt.toISOString() });
});

router.patch("/sos-contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, phone, relationship, notes } = req.body;
  const updates: Partial<{ name: string; phone: string; relationship: string; notes: string | null }> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (relationship !== undefined) updates.relationship = relationship;
  if (notes !== undefined) updates.notes = notes;

  const [contact] = await db.update(sosContactsTable).set(updates)
    .where(and(eq(sosContactsTable.id, id), eq(sosContactsTable.userId, user.userId))).returning();
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json({ ...contact, createdAt: contact.createdAt.toISOString(), updatedAt: contact.updatedAt.toISOString() });
});

router.delete("/sos-contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [contact] = await db.delete(sosContactsTable)
    .where(and(eq(sosContactsTable.id, id), eq(sosContactsTable.userId, user.userId))).returning();
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  res.sendStatus(204);
});

export default router;
