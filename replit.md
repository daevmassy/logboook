# Daybook | Daily Task Tracker

Daybook lets employees record daily work and gives supervisors a shared view of task status, review comments, and weekly team performance.

## Run & Operate

- `pnpm run build` then `pnpm start` — build and run the web app and API together on `PORT`
- `render.yaml` — Render Blueprint for the `logboook` web service. Set `DATABASE_URL` to a reachable MySQL/MariaDB connection string and enter Clerk keys as secrets; never commit them.
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- For XAMPP, start MySQL and create the database in phpMyAdmin using `CREATE DATABASE logbook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`. Set `DATABASE_URL=mysql://root@127.0.0.1:3306/logbook` in `artifacts/api-server/.env.local` (add the XAMPP MySQL password after `root:` if one is configured), then run `pnpm --filter @workspace/db run push` to create/update tables.
- Required env: `DATABASE_URL` — MySQL/MariaDB connection string; `VITE_CLERK_PUBLISHABLE_KEY` — frontend Clerk key; `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` — API Clerk credentials. Render needs a publicly reachable MySQL/MariaDB host; a local XAMPP server is not reachable by Render by default. Without the frontend key, the web app displays a setup message instead of generating an unusable `clerk.localhost` key.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: MySQL/MariaDB + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/daily-task-tracker` — employee, supervisor, and public web experience
- `artifacts/api-server/src/routes/tracker` — authenticated profile, task, team, and report APIs
- `lib/api-spec/openapi.yaml` — API contract source of truth; regenerate clients with the codegen command above
- `lib/db/src/schema/tracker.ts` — MySQL schema for team members, task logs, and supervisor comments

## Architecture decisions

- Clerk manages sign-in; the app stores its own team profile keyed by Clerk's user ID and never handles Google passwords.
- The first completed profile becomes the initial supervisor; later profiles start as employees, and supervisors grant or remove access.
- Weekly reports use Monday-to-Sunday ranges and calculate completion metrics from saved task logs.

## Product

- Employee sign-in is at `/sign-in`; double-tapping the Daybook logo on that page opens the separate `/admin/sign-in` supervisor portal. Both use Clerk accounts, and supervisor authorization is still enforced by the member role and API checks.
- Employees sign in, complete a profile, and create, edit, filter, and delete their daily task logs.
- Supervisors can review all team task logs, leave comments, manage supervisor access, and compare weekly completion across members.
- Task logs include date, time, activity, department, issue/request context, action taken, pending/done status, and remarks.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Keep Clerk's API proxy mounted before Express body parsers and preserve cookie-based auth for web requests.
- After changing OpenAPI operations or schemas, rerun API codegen before typechecking or consuming generated hooks.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
