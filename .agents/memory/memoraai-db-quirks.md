---
name: MemoraAI DB schema quirks
description: Conversations table required userId; template exports differ from project naming conventions
---

The AI integration template ships `conversations` and `messages` tables without a `userId` column and exports them as `conversations`/`messages` (not `conversationsTable`/`messagesTable`). Both were patched:

1. Added `userId` FK referencing `usersTable` to `conversations`
2. Renamed exports to `conversationsTable` and `messagesTable` to match project convention
3. Updated `messages.ts` to import from `./conversations` (not the old default)

**Why:** The project convention is `<name>Table` for all Drizzle table exports. The template used bare names, causing import mismatches in routes.

**How to apply:** Any time the AI integration template is copied in, rename both table exports and add userId before running `db push`.
