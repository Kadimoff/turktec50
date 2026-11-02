/* Idempotent, non-destructive process (workflow) sync — safe on the live database after `prisma migrate deploy`:
 *   - creates any missing default system stages (existing / renamed stages are left untouched),
 *   - assigns a stage to every application / project that has none (derived from status / stage / result),
 *   - back-fills a starting history for records that have none.
 * Nothing is deleted and no existing column is changed.   Usage:  npm run workflow:sync  [-- --dry-run]
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncWorkflow } from "../src/lib/workflow-core";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const dry = process.argv.includes("--dry-run");
  const before = await Promise.all([
    prisma.workflowStage.count(),
    prisma.application.count({ where: { workflowStageId: null } }),
    prisma.project.count({ where: { workflowStageId: null } }),
    prisma.workflowTransition.count(),
  ]);
  console.log(`before: stages=${before[0]} unmappedApplications=${before[1]} unmappedProjects=${before[2]} transitions=${before[3]}`);
  if (dry) return;
  const r = await syncWorkflow(prisma);
  console.log(`sync: stagesCreated=${r.stagesCreated} applicationsMapped=${r.applicationsMapped} projectsMapped=${r.projectsMapped} historyRows=${r.historyRows}`);
  const byStage = await prisma.workflowStage.findMany({
    orderBy: [{ scope: "asc" }, { order: "asc" }],
    select: { scope: true, systemKey: true, nameAz: true, active: true, _count: { select: { applications: true, projects: true } } },
  });
  for (const s of byStage) console.log(`  ${s.scope.padEnd(11)} ${(s.systemKey ?? "(custom)").padEnd(20)} ${String(s.scope === "APPLICATION" ? s._count.applications : s._count.projects).padStart(4)}  ${s.nameAz}${s.active ? "" : " (inactive)"}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
