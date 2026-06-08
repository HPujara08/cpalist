# CPA Intern Radar

A job intelligence pipeline that monitors top accounting firm career pages, detects their ATS provider, pulls internship postings via their APIs, and surfaces a clean daily digest.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/cpa-intern-radar run dev` — run the frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Wouter routing, TanStack Query, shadcn/ui)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema: `lib/db/src/schema/` — `firms.ts`, `jobs.ts`
- API contract: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/generated/`
- ATS scrapers: `artifacts/api-server/src/lib/ats-scrapers.ts`
- API routes: `artifacts/api-server/src/routes/` — firms, jobs, scrape, stats
- Frontend pages: `artifacts/cpa-intern-radar/src/pages/`

## Architecture decisions

- Contract-first OpenAPI spec gates all codegen; never hand-write types the spec already generates.
- ATS detection follows redirects on `careers_url` and classifies by domain (myworkdayjobs.com → workday, boards.greenhouse.io → greenhouse, etc.).
- Each ATS scraper targets the provider's JSON API endpoint instead of scraping HTML — more reliable and no JavaScript rendering needed.
- Job deduplication uses a `content_hash` (title + ATS slug + location) so re-scraped jobs update `last_seen` without creating duplicates.
- Scraping is triggered manually via the UI or via API; daily scheduling can be added via cron/GitHub Actions calling `POST /api/scrape/run`.

## Product

- **Dashboard** (`/`) — Stats overview: firms tracked, active jobs, new today, scans today. ATS breakdown chart. Feed of recent postings.
- **Firms** (`/firms`) — Table of all 25 tracked CPA firms with rank, HQ, ATS type badge, last scan time, active job count. Per-firm "Scrape Now" button. Add/edit firms.
- **Jobs** (`/jobs`) — Filterable list of all active internship postings. Filter by keyword, firm, ATS source, term (summer/winter/fall/spring).
- **Digest** (`/digest`) — Daily newsletter view: "New Today" and "Still Open" sections.

## ATS Support

| ATS | Method | Slug extraction |
|---|---|---|
| Greenhouse | Public JSON API | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` |
| Lever | Public JSON API | `api.lever.co/v0/postings/{slug}` |
| Workday | JSON POST endpoint | `{subdomain}.wd5.myworkdayjobs.com` |
| Ashby | GraphQL API | `jobs.ashbyhq.com` |
| SmartRecruiters | REST API | `api.smartrecruiters.com` |
| iCIMS, Jobvite, Custom | Detection only | Manual scraping TBD |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before touching routes or hooks.
- ATS URL slugs are extracted from `ats_url` at scrape time — if a firm's ATS URL changes, update `ats_url` in the DB.
- Workday's JSON endpoint uses a POST with `{"searchText": "intern"}` — not a standard GET.
- Never use `console.log` in server code — use `req.log` in handlers or the singleton `logger`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
