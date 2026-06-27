---
name: Digest triple-send bug
description: The daily digest was sending 3 emails per day due to duplicate triggers from the route handler, in-process cron, and background job.
---

## Rule
There must be exactly ONE trigger for the daily digest. GitHub Actions calling `POST /api/cron/daily` is the sole trigger. No in-process cron for the digest. The route must not call `runDailyJob()` after responding.

**Why:** Three sends were happening:
1. Route handler → `sendDigestFromDb()` → email #1
2. Same route → `runDailyJob()` background → `buildAndSendDigest()` after scrape → email #2
3. In-process `node-cron "0 5 * * *"` → `sendDigestFromDb()` → email #3

**How to apply:**
- `POST /api/cron/daily` route: call `sendDigestFromDb()` once, then kick off `scrapeNextBatch(21)` in background (no re-email)
- `cron.ts`: only registers the hourly batch scrape, NOT the digest cron
- GitHub Actions `daily-digest.yml` at `7 5 * * *` is the sole digest scheduler
