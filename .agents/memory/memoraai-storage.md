---
name: MemoraAI object storage TS cast
description: objectStorage.ts response.json() returns unknown; needs explicit cast
---

In `artifacts/api-server/src/lib/objectStorage.ts`, the line:
```typescript
const { signed_url: signedURL } = await response.json();
```
fails with TS2339 because `response.json()` returns `unknown`.

Fix:
```typescript
const json = await response.json() as { signed_url: string };
const signedURL = json.signed_url;
```

**Why:** The template was written before strict unknown inference on `fetch().json()` was enforced. TypeScript strict mode rejects property access on `unknown`.
