import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, medicationsTable } from "@workspace/db";
import { requireAuth, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/medications", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const meds = await db.select().from(medicationsTable)
    .where(eq(medicationsTable.userId, user.userId))
    .orderBy(desc(medicationsTable.createdAt));
  res.json(meds.map(m => ({ ...m, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() })));
});

router.post("/medications", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const { name, dosage, frequency, instructions, startDate, endDate, isActive, color } = req.body;
  if (!name || !dosage || !frequency) {
    res.status(400).json({ error: "Name, dosage and frequency are required" });
    return;
  }
  const [med] = await db.insert(medicationsTable).values({
    userId: user.userId, name, dosage, frequency,
    instructions: instructions ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    isActive: isActive ?? true,
    color: color ?? "#06b6d4",
  }).returning();
  res.status(201).json({ ...med, createdAt: med.createdAt.toISOString(), updatedAt: med.updatedAt.toISOString() });
});

router.patch("/medications/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { name, dosage, frequency, instructions, startDate, endDate, isActive, color } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (dosage !== undefined) updates.dosage = dosage;
  if (frequency !== undefined) updates.frequency = frequency;
  if (instructions !== undefined) updates.instructions = instructions;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (isActive !== undefined) updates.isActive = isActive;
  if (color !== undefined) updates.color = color;

  const [med] = await db.update(medicationsTable).set(updates)
    .where(and(eq(medicationsTable.id, id), eq(medicationsTable.userId, user.userId))).returning();
  if (!med) { res.status(404).json({ error: "Medication not found" }); return; }
  res.json({ ...med, createdAt: med.createdAt.toISOString(), updatedAt: med.updatedAt.toISOString() });
});

router.delete("/medications/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user: AuthPayload }).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [med] = await db.delete(medicationsTable)
    .where(and(eq(medicationsTable.id, id), eq(medicationsTable.userId, user.userId))).returning();
  if (!med) { res.status(404).json({ error: "Medication not found" }); return; }
  res.sendStatus(204);
});

export default router;
