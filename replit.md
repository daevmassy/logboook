# Daybook | Daily Task Tracker

Daybook lets employees record daily work and gives supervisors a shared view of task status, review comments, and weekly team performance.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/daily-task-tracker` — employee, supervisor, and public web experience
- `artifacts/api-server/src/routes/tracker` — authenticated profile, task, team, and report APIs
- `lib/api-spec/openapi.yaml` — API contract source of truth; regenerate clients with the codegen command above
- `lib/db/src/schema/tracker.ts` — PostgreSQL schema for team members, task logs, and supervisor comments

## Architecture decisions

- Clerk manages sign-in; the app stores its own team profile keyed by Clerk's user ID and never handles Google passwords.
- The first completed profile becomes the initial supervisor; later profiles start as employees, and supervisors grant or remove access.
- Weekly reports use Monday-to-Sunday ranges and calculate completion metrics from saved task logs.

## Product

- The root route is the employee sign-up/login screen; double-tapping the Daybook logo opens supervisor sign-in, with role checks still enforced.
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
