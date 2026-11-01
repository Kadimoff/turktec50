# TÜRKTECH 50 — Build conventions (read fully before writing code)

Project: role-based project-tracking MVP for the TÜRKTECH 50 technology-competition academy (ASOIU/ADNSU pilot).
Stack: **Next.js 16.4 (App Router, Turbopack) · React 19.3 · TypeScript · Tailwind v4 · shadcn (Base UI flavour) · Prisma 7 + PostgreSQL · next-intl 4 · zod 4 · lucide-react · recharts 3 · date-fns 4.**

Core product rule (must be visible in UI where relevant): **the system never makes selection or jury decisions.** It records, surfaces and reports; humans decide. No automatic accept/reject, no auto-ranking that implies a decision. Show `<HumanControlNote />` on selection / jury / evaluation screens.

## 0. Working in a shared tree (parallel agents!)
- Several agents work **in the same directory at the same time**. Only create/edit the files listed as *yours* in your brief. Never edit shared files (`src/lib/*`, `src/components/ui/*`, `src/components/shared/*`, `src/components/shell/*`, `src/i18n/*`, `prisma/*`, `messages/*/{common,nav,auth,enums}.json`, layouts, `package.json`). If you truly need a change there, **do not make it** — work around it locally and report the request in your final message.
- Put module-specific components under `src/components/<your-module>/` and server actions in `src/app/(app)/<route>/actions.ts` (or `src/lib/actions/<module>.ts` — but only a file you own).
- Do **not** install npm packages, do **not** change the Prisma schema or run migrations / `db:seed` / `db:reset`.
- A dev server is **already running at http://localhost:3000** (HMR). Do not start another one, do not run `next build` (it would clash with the dev server's `.next`).
- Type-check with `npx tsc --noEmit` — fix errors in *your* files only; ignore transient errors in other agents' files.
- Lint: `npx eslint <your files>`.
- Commit nothing; the lead will commit.

## 1. Next.js 16 specifics (differs from older training data)
- `params` and `searchParams` are **Promises**: `export default async function Page(props: PageProps<"/projects/[id]">) { const { id } = await props.params; const sp = await props.searchParams; }`. `PageProps`/`LayoutProps` are global generated types (run `npx next typegen` if a new route's type is missing).
- `cookies()` / `headers()` are async.
- `middleware` is now `src/proxy.ts` (already done — auth redirect).
- Docs for this exact version live in `node_modules/next/dist/docs/` — check them when unsure.
- Server Actions: `"use server"` files; call `revalidatePath(...)` after mutations. Use `useActionState` (from `react`) + `useFormStatus` for pending state in client forms. Keep heavy data fetching in Server Components.

## 2. shadcn here is the **Base UI** flavour (not Radix)
- No `asChild`. Use the `render` prop: `<Button render={<Link href="/x" />}>Open</Button>`, `<DropdownMenuTrigger render={<Button variant="ghost" />}>…</DropdownMenuTrigger>`, `<DialogTrigger render={<Button />}>…</DialogTrigger>`.
- Read the component file in `src/components/ui/` before using it (props differ from Radix shadcn).
- `DropdownMenuLabel` must be inside `DropdownMenuGroup`.
- For selects inside server-action forms prefer `NativeSelect` from `@/components/shared/form` (submits with the form, accessible). The Base UI `Select` is fine for client-controlled filters.
- Button sizes: `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg`; variants: `default | outline | secondary | ghost | destructive | link`.

## 3. Data access, auth, RBAC, audit
- DB: `import { prisma } from "@/lib/db"`; types/enums: `import type { Prisma } from "@/generated/prisma/client"`, `import type { Role, TaskStatus } from "@/generated/prisma/enums"` (enums are also runtime objects there).
- Schema: `prisma/schema.prisma` (read it). Seed content: `prisma/seed.ts` (read to know demo data).
- Auth: `const user = await requireUser()` or `requireUser(["ADMIN"])` at the top of **every** page and **every** server action. `CurrentUser = { id, name, email, role, title, locale, universityId }`.
- Visibility: `projectScope(user)` → Prisma `where` for projects the user may see. **Always** compose it into project/task/session/document/risk queries, e.g. `prisma.task.findMany({ where: { project: projectScope(user) } })`.
  - ADMIN all; TEAM only own project(s); MENTOR only assigned projects; JURY only assigned projects (read-only + evaluations).
- Per-project pages: `const access = await getProjectAccess(user, id)` (404s when not visible). Flags: `isAdmin isMember isMentor isJury canWork canReview canManage canEvaluate tabs`.
- Server actions on a project: `await assertProjectAccess(user, projectId)` then check the needed flag; throw/return error otherwise. Validate all input with zod.
- **Every mutation must call** `logAudit({ actorId: user.id, action, entity, entityId, projectId, summary })` from `@/lib/audit`. Use these action keys (translated by the audit module):
  `auth.login auth.logout application.evaluate application.decide project.create project.update project.stage project.assign_mentor project.unassign_mentor project.assign_jury project.unassign_jury project.flags task.create task.update task.status task.delete session.create session.update session.complete session.cancel session.convert_step document.upload document.delete checklist.review checklist.add risk.create risk.update risk.close evaluation.save evaluation.submit user.create user.update user.deactivate user.activate`
- Notifications (in-app only): `notify(userIds, type, params, href)` with types already translated in `common.notifications.*`: `task_assigned{title} task_done{title} session_planned{topic} session_notes{topic} document_reviewed{title,status} document_uploaded{title} risk_high{title} stage_changed{project,stage} evaluation_submitted{project} assigned_project{project} application_decided{team}`.
- Helpers: `@/lib/kpi` (`getProgramKpis`, `readinessFromChecklist`, `weightedScore`), `@/lib/constants` (`KPI_TARGETS`, `PROGRAM`, `currentWeek`, `currentMonth`, `CATEGORIES`, `STAGE_ORDER`, `CHECKLIST_TEMPLATE`, `RUBRICS`, `UPLOAD`), `@/lib/format` (`fmtDate fmtDay fmtDateTime fmtRelative fmtPct fmtBytes initials`), `@/lib/tones` (enum → tone maps).

## 4. i18n — three languages, always (az default, tr, en)
- next-intl without URL routing; locale from cookie. Server: `const t = await getTranslations("tasks")`; client: `useTranslations("tasks")`. Locale: `getLocale()` / `useLocale()`; pass it to `fmtDate(d, locale)`.
- Each module owns `messages/{az,tr,en}/<namespace>.json` (currently `{}`). **All three files must have exactly the same keys.** No hard-coded user-facing strings in TSX — everything through `t()`. (Demo *data* such as project titles stays as stored.)
- Shared namespaces you may read but not edit: `common` (actions, states, categories, countries, phases, notifications, theme…), `nav`, `auth`, `enums` (every Prisma enum value, e.g. `t("enums.TaskStatus.DONE")` via `getTranslations("enums")`).
- Use ICU plurals: `"{count, plural, one {# task} other {# tasks}}"`.
- Azerbaijani UI terminology (keep consistent with the submitted prototype): İcmal, Layihə, Tapşırıq, Mentor sessiyası, Sənəd checklist-i, Risk reyestri, Münsif, Rubrik, Mərhələ, Hazırlıq, Son tarix, Məsul, Prioritet, Meyar (acceptance criterion), Yumşaltma (mitigation). Turkish: Genel bakış, Proje, Görev, Mentor oturumu, Belge kontrol listesi, Risk kaydı, Jüri, Rubrik, Aşama, Hazırlık, Son tarih, Sorumlu, Öncelik, Kabul ölçütü, Azaltma.
- **Never use CSS `uppercase`/`capitalize` on translated text** — Chrome does not upper-case Azerbaijani `ə`. Use sentence-case labels styled with `text-xs font-semibold tracking-wide text-muted-foreground`.

## 5. Design system (generated with ui-ux-pro-max → "Data-Dense Dashboard", institutional)
- Identity: navy sidebar `#0f2840`, teal primary, Inter font. Tokens only — **never raw hex** in components. Available Tailwind colors: `background foreground card muted muted-foreground primary primary-foreground secondary accent accent-foreground border input ring destructive` + status tones `success|warning|danger|info|neutral` and their `*-soft` backgrounds (e.g. `bg-success-soft text-success`), `chart-1..5`. All pairs are ≥4.5:1 in light and dark. Dark mode must work (class strategy) — test both.
- Shared components (use them, don't re-invent):
  - `PageHeader { eyebrow?, title, description?, actions? }` — every top-level page starts with it.
  - `StatCard { label, value, hint?, icon?, tone?, target?, current? }` — KPI tiles (4-up grid: `grid gap-4 sm:grid-cols-2 xl:grid-cols-4`).
  - `EnumBadge { enumName, value }` (server) / `ToneBadge { tone, children }` (client-safe) — status pills; text always present (color is never the only signal).
  - `ProgressBar { value, label, tone? }`, `UserAvatar { name, size }`, `EmptyState { icon, title, description?, action? }`, `HumanControlNote`, `DemoNote`.
  - Forms: `Field { label, htmlFor, hint?, error?, required? }`, `SubmitButton { pendingLabel? }`, `NativeSelect`.
- Layout: content area already has max width 1440 and padding. Section rhythm `space-y-6`. Cards: `rounded-xl border bg-card shadow-card` with `p-4`/`p-5`; card titles `text-sm font-semibold`, subtitles `text-xs text-muted-foreground`.
- Tables: shadcn `Table`; header cells `text-xs font-semibold text-muted-foreground`; rows ~44px; numbers `tabular`; row hover `hover:bg-muted/50`; wrap wide tables in `overflow-x-auto` (no page-level horizontal scroll at 375px). On mobile, consider stacked cards instead of very wide tables.
- Interaction: min touch target 40–44px for primary controls; visible focus rings (already in components); `cursor-pointer` handled globally; transitions 150–200ms on color/opacity only; respect reduced motion (global CSS does). Loading feedback on every async action (SubmitButton / `useTransition` pending). Toasts via `import { toast } from "sonner"` after client actions.
- Forms: visible labels (never placeholder-only), inline error under the field, helper text for non-obvious fields, required marker, confirm destructive actions with `AlertDialog`.
- Icons: lucide only, `aria-hidden` when decorative, `aria-label` on icon-only buttons. No emoji as icons.
- Empty states for every list. Dates: relative + absolute (e.g. "2 gün qalıb · 20 okt"). Overdue items in `text-danger`.
- Charts (recharts, client components): colors from `var(--chart-1..5)` / status tokens, always with legend or direct labels + accessible text fallback (e.g. sr-only table or visible numbers). Load the `dataviz` skill before writing charts if available to you.

## 6. Verifying your UI
- Screenshot helper (headless Chromium, logs in with demo accounts):
  `node /tmp/claude-1000/-home-k4/87ec2d5a-da49-46f6-beb7-f5b8f9b3e394/scratchpad/shot/shot.mjs --as admin|team|mentor|jury --path /tasks --out /tmp/claude-1000/-home-k4/87ec2d5a-da49-46f6-beb7-f5b8f9b3e394/scratchpad/<name>.png [--width 390 --height 844] [--theme dark] [--locale en|tr|az] [--full]`
  Prints final URL, HTTP status, console/page errors and whether there is horizontal overflow. Then view the PNG with the Read tool. Check at least: desktop light, mobile 390px, dark, and one non-az locale; and every role that can reach your pages (and that roles that must NOT reach them get redirected / 404).
- Demo accounts (password `Demo2026!`): admin `koordinator@turktech50.az` (Aysel Sadıqova), team `rena.mammadli@student.asoiu.az` (AgroSense lead), mentor `elvin.quliyev@mentor.turktech50.az`, jury `sebine.kerimova@jury.turktech50.az`.
- Mutations you test will change the shared dev DB — keep test edits small and revert them (or leave data sensible), because other agents are screenshotting too.
