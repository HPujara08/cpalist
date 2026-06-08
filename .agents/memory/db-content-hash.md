---
name: jobs.content_hash must have UNIQUE constraint
description: ON CONFLICT (content_hash) silently fails without a UNIQUE constraint on the column
---

The jobs table uses `ON CONFLICT (content_hash) DO UPDATE` for deduplication. PostgreSQL requires the conflict target column to have a UNIQUE constraint — without it, the statement executes silently with no insert and no error.

**Schema fix:** Add `.unique()` to the Drizzle column definition:
```typescript
contentHash: text("content_hash").notNull().unique(),
```

**DB migration:** `ALTER TABLE jobs ADD CONSTRAINT jobs_content_hash_unique UNIQUE (content_hash);`

**Why:** This caused all seeded jobs to silently not insert during initial setup. The bug is hard to notice because there's no error thrown.
