# MemoraAI

A personal AI-powered second-brain app for capturing notes, managing tasks, storing memories, tracking medications, managing photos, and getting AI companion chat support.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/memoraai run dev` — run the React frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild composite libs (run before artifact typechecks after schema changes)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (bcryptjs + jsonwebtoken), token stored in localStorage as `memora_token`
- AI: OpenAI (gpt-4o-mini) via direct API key
- Storage: Replit Object Storage (GCS presigned URLs) for photos
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all endpoints)
- `lib/db/src/schema/` — Drizzle table schemas (users, notes, tasks, memories, photos, medications, sos_contacts, conversations, messages)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware + `signToken`
- `artifacts/memoraai/src/pages/` — React page components
- `artifacts/memoraai/src/components/layout.tsx` — sidebar navigation layout
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit manually)

## Architecture decisions

- JWT tokens sent as `Authorization: Bearer <token>` header; no sessions/cookies
- `custom-fetch.ts` in `lib/api-client-react` attaches token automatically to all generated hooks
- AI SSE streaming endpoints (`/api/ai/conversations/:id/messages`) use raw fetch on the client — Orval cannot generate hooks for SSE
- Photo uploads use two-step presigned URL flow: request URL → upload directly to GCS → save objectPath to DB
- Conversations table has `userId` column (template default didn't — was added manually)

## Product

- Login / Register with JWT auth
- Task Alarms — datetime-local field on tasks; browser alarm fires (Web Audio + Notifications) when a task comes due; overdue badge shown in task list
- AI Persistent Memory — `ai_memories` table; Gemini extracts facts after each reply; memories injected into system prompt; Memory Bank panel in AI companion to view/delete facts

## Original features
- Dashboard with live counts and recent items
- Notes — full CRUD with search and pin
- Tasks — full CRUD with priority, due dates, status filter
- Memories — searchable cards with tags
- AI Companion — streaming chat with gpt-4o-mini, multi-conversation
- Photos — gallery with GCS upload, lightbox
- Medications — color-coded tracker with active/inactive toggle
- Emergency SOS — contact list with call buttons + SOS panic button

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After adding new tables to `lib/db/src/schema/`, must run `pnpm run typecheck:libs` before artifact typechecks
- The `conversations` table template didn't include `userId` — was added manually; both `conversationsTable` and `messagesTable` names were renamed from template defaults (`conversations`, `messages`)
- `MessageSquareTerminal` does not exist in the installed lucide-react version — use `Bot` instead
- Object storage `objectStorage.ts` has a `response.json()` typed as `unknown` — cast explicitly: `const json = await response.json() as { signed_url: string }`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
