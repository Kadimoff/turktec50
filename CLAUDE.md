# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

**Read `docs/CONVENTIONS.md` before writing code.** It contains the binding rules: Base UI shadcn usage, RBAC/audit requirements, shared modules (§3b), i18n, and the design system. Its §0 (shared tree, "don't touch shared files", dev server on :3000) and §6 (screenshot helper path) apply only to parallel-agent runs that a lead agent briefs.

## What this is
TÜRKTECH 50 is a role-based project-tracking MVP for a technology-competition academy (ASOIU/ADNSU pilot), merged with the former Python "ADNSU TEKNOFEST 2027 Academy" panel. Product rule: **the system never makes selection or jury decisions.** It records, surfaces and reports; humans decide. UI languages are az (default), tr and en; the visual identity is purple. The README (in Turkish) has the module table, demo accounts and root-account rules.

## Commands
```bash
npm run db:up                 # Postgres 17 in Docker (port from docker-compose.yml / an untracked override; check DATABASE_URL in .env)
npx prisma migrate deploy     # apply migrations
npm run db:seed               # demo data — WIPES ALL TABLES (ask first if someone may be using the DB)
npm run dev                   # next dev (Turbopack); add `-H 0.0.0.0 -p <port>` + ALLOWED_DEV_ORIGINS for LAN devices
npm run typecheck             # tsc --noEmit
npm run lint                  # eslint (or: npx eslint src prisma / npx eslint <files>)
npm run build                 # don't run while a dev server is using .next
npm run root:sync             # re-sync the root account from ROOT_* in .env without touching data
```
- There is **no automated test suite** and no test runner. Verify with `typecheck` and `lint`, then by running the app (demo accounts use password `Demo2026!`; see README / `docs/USERS.md`).
- **Schema changes:** `prisma migrate dev` needs an interactive TTY and fails in agent shells. Write the migration SQL yourself, then apply it:
  ```bash
  mkdir prisma/migrations/<yyyymmddhhmmss>_<name>
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<…>/migration.sql
  npx prisma migrate deploy && npx prisma generate
  ```
  Then restart the dev server: the Prisma client is cached on `globalThis`.
- The Prisma client is generated into `src/generated/prisma`. Import from `@/generated/prisma/client` and `@/generated/prisma/enums`, never from `@prisma/client`. Config lives in `prisma.config.ts`, which loads `.env` via dotenv.
- Turbopack sometimes serves stale CSS: new Tailwind utilities or token changes don't appear. Fix it by stopping the dev server, `rm -rf .next/dev`, and restarting.

## Architecture (big picture)
**Request path:**
1. `src/proxy.ts`: Next 16's replacement for `middleware`. It checks only that the session cookie exists, keeps the `AUTH` pages (`/login`) for signed-out users, and leaves `OPEN` (`/apply/**`, public, POST body ≤ 64KB) open to everyone.
2. `requireUser(roles?)` (`src/lib/auth.ts`): call it at the top of every page and every server action. It verifies the JWT (`src/lib/session.ts`, cookie `t50_session`) and loads the user from the DB. It rejects tokens issued before `User.passwordChangedAt` (session revocation) and redirects to `/login?expired=1`.
3. `src/lib/rbac.ts`: `projectScope(user)` is the Prisma `where` that every project-related query must compose. `getProjectAccess` / `assertProjectAccess` return per-project capability flags.
4. Prisma (`src/lib/db.ts`, pg adapter).

**Route groups (`src/app`):**
- `(app)`: the signed-in shell (sidebar from `src/lib/nav.ts` `navFor(role)`). Its layout also forces `/account/password` while `mustChangePassword` is set. That check runs only in the page layout, not in server actions.
- `(auth)`: login and own-password change.
- `(public)/apply`: the no-login student intake form, tracking page `/apply/status/<token>`, and lookup.
- `api/documents/[id]`: the only route handler. It streams uploaded files from `UPLOAD_DIR`, scoped by `projectScope`; jury members never receive confidential documents.
- `app/actions/auth.ts`: login, logout, change-password.

**Module layout:** each feature is split three ways:
- `src/app/(app)/<module>/page.tsx`: async Server Component;
- `actions.ts` next to the route: `"use server"`, zod validation, returns `ActionState` from `@/lib/action-state`;
- `src/components/<module>/`: UI plus `server-only` loaders (`server.ts`, `queries.ts` or `data.ts`).

Every mutation calls `logAudit` (typed action keys in `src/lib/audit.ts`) and then `revalidateSets(...)` (`src/lib/revalidate.ts`).

**Two domains share one DB:**
- **TÜRKTECH 50 program:** applications (rubric scoring → human decision) become projects. Each project has stages, tasks, mentor sessions, a document checklist, risks, jury evaluations and KPI.
- **Academy (`/academy/*`):** TEKNOFEST competition catalog (`prisma/data/teknofest-catalog-2026.json`, seeded; `Competition.ruleStatus` tracks the 2027 rules), students, teams, registry (faculties, labs, partners), trainings, resource requests and announcements. Team-membership and eligibility rules exist only in `src/lib/academy/rules.ts`.
- **How they connect:**
  - A public intake request (`IntakeRequest`, codes `HZ-xxxx`; only the sha256 of its tracking token is stored, see `src/components/intake/token.ts`) is reviewed at `/academy/intake`.
  - Accepting it creates an active Academy team and starts rule tracking for its competition.
  - An Academy team can then create a TÜRKTECH application. That is a separate step, not automatic.

**Cross-cutting invariants** (details in CONVENTIONS §3b):
- **Time zone:** all dates are Asia/Baku (fixed UTC+04:00). Use `@/lib/dates` and `@/lib/format`, never raw `new Date("…T…")` or date-fns `format` on an instant. The app must render the same under server `TZ=UTC`.
- **Status changes:** use conditional `updateMany` and check that exactly one row changed.
- **Codes:** generate them via `@/lib/codes` inside the transaction.
- **CSV exports:** go through `@/lib/csv` (formula-injection guard).
- **Rate limits:** DB-backed (`RateEvent`) via `@/lib/rate-limit`.
- **i18n:** every namespace has `messages/{az,tr,en}/<ns>.json` with identical keys, registered in `src/i18n/namespaces.ts`. The locale comes from a cookie; there is no URL routing.
